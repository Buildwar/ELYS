import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db, logAudit } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Only admin can manage users
router.use(requireAuth, requireRole(['admin']));

// GET all users
router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT id, username, email, role, is_active, created_at, updated_at
    FROM users
    ORDER BY created_at ASC
  `).all();
  return res.json(users);
});

// CREATE user
router.post('/', (req: AuthenticatedRequest, res) => {
  const { username, email, password, role = 'user', isActive = 1 } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Usuario, email y contraseña requeridos' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(400).json({ error: 'Ya existe un usuario con ese nombre de usuario o email' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, email, passwordHash, role, isActive ? 1 : 0, now, now);

  logAudit({
    action: 'create_user',
    entity_type: 'user',
    entity_id: id,
    entity_name: username,
    user_id: req.user?.id,
    username: req.user?.username || 'admin',
    details: `Usuario "${username}" creado con rol "${role}"`,
    ip_address: req.ip,
  });

  const created = db.prepare('SELECT id, username, email, role, is_active, created_at FROM users WHERE id = ?').get(id);
  return res.status(201).json(created);
});

// UPDATE user
router.put('/:id', (req: AuthenticatedRequest, res) => {
  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { username, email, password, role, isActive } = req.body;
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // Prevent admin from deactivating or demoting themselves
  if (req.user!.id === userId) {
    if (isActive === 0) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta de administrador' });
    }
    if (role && role !== 'admin') {
      return res.status(400).json({ error: 'No puedes revocar tu propio rol de administrador' });
    }
  }

  let passwordHash = existing.password_hash;
  if (password && password.trim().length >= 6) {
    passwordHash = bcrypt.hashSync(password, 10);
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users SET
      username = ?, email = ?, password_hash = ?, role = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(
    username || existing.username,
    email || existing.email,
    passwordHash,
    role || existing.role,
    isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
    now,
    userId
  );

  logAudit({
    action: 'update_user',
    entity_type: 'user',
    entity_id: userId,
    entity_name: username || existing.username,
    user_id: req.user?.id,
    username: req.user?.username || 'admin',
    details: `Usuario "${username || existing.username}" modificado`,
    ip_address: req.ip,
  });

  const updated = db.prepare('SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = ?').get(userId);
  return res.json(updated);
});

// DELETE user
router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (req.user!.id === userId) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  const existing = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;

  const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  logAudit({
    action: 'delete_user',
    entity_type: 'user',
    entity_id: userId,
    entity_name: existing?.username || userId,
    user_id: req.user?.id,
    username: req.user?.username || 'admin',
    details: `Usuario "${existing?.username || userId}" eliminado del sistema`,
    ip_address: req.ip,
  });

  return res.json({ message: 'Usuario eliminado exitosamente' });
});

export default router;
