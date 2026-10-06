import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, logAudit } from '../db/index.js';
import { signToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { authRateLimiter, setupRateLimiter, passwordChangeRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Check if initial admin has been created
router.get('/setup-status', (req, res) => {
  try {
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    return res.json({ initialized: Boolean(admin) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Setup initial admin on clean installation
router.post('/setup', setupRateLimiter, (req, res) => {
  try {
    const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (existingAdmin) {
      return res.status(400).json({ error: 'El sistema ya ha sido inicializado.' });
    }

    const username = (req.body.username || 'admin').trim();
    const password = req.body.password || 'Admin123';
    const email = (req.body.email || `${username}@elys.local`).trim();

    if (!username) {
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const hash = bcrypt.hashSync(password, 10);

    // Initial admin starts with must_change_password = 1 for safety
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, is_active, must_change_password, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', 1, 1, ?, ?)
    `).run(id, username, email, hash, now, now);

    logAudit({
      action: 'SYSTEM_SETUP',
      entity_type: 'system',
      entity_name: 'ELYS',
      username,
      details: 'Inicialización de instalación limpia y creación del usuario administrador principal',
    });

    const authUser = {
      id,
      username,
      email,
      role: 'admin' as const,
      mustChangePassword: true,
    };

    const token = signToken(authUser);
    return res.json({
      message: 'Administrador configurado con éxito',
      token,
      user: authUser,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', authRateLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username) as any;
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'La cuenta de usuario está desactivada' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const authUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    mustChangePassword: Boolean(user.must_change_password),
  };

  const token = signToken(authUser);
  return res.json({ token, user: authUser });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db.prepare('SELECT id, username, email, role, is_active, must_change_password, created_at, updated_at FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  return res.json({
    ...user,
    mustChangePassword: Boolean(user.must_change_password),
  });
});

router.post('/change-password', requireAuth, passwordChangeRateLimiter, (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(hash, now, req.user!.id);

  logAudit({
    action: 'PASSWORD_CHANGED',
    entity_type: 'user',
    entity_id: req.user!.id,
    entity_name: req.user!.username,
    username: req.user!.username,
    details: 'Contraseña cambiada con éxito',
  });

  const authUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    mustChangePassword: false,
  };

  const token = signToken(authUser);
  return res.json({
    message: 'Contraseña actualizada con éxito',
    token,
    user: authUser,
  });
});

export default router;
