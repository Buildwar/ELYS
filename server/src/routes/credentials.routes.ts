import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { encryptSecret } from '../utils/crypto.js';

const router = Router();

// Only Admin and Operator can access credentials
router.use(requireAuth, requireRole(['admin', 'operator']));

// GET all credentials (masking secrets)
router.get('/', (req, res) => {
  const credentials = db.prepare(`
    SELECT id, name, type, username, domain, description, created_at, updated_at,
      '••••••••••••' as secret_masked,
      (SELECT COUNT(*) FROM destinations d WHERE d.credential_id = credentials.id) as used_in_destinations,
      (SELECT COUNT(*) FROM tasks t WHERE t.credential_id = credentials.id) as used_in_tasks
    FROM credentials
    ORDER BY name ASC
  `).all();
  return res.json(credentials);
});

// CREATE credential
router.post('/', (req: AuthenticatedRequest, res) => {
  const { name, type = 'ssh_password', username, secret, domain, description } = req.body;
  if (!name || !username || !secret) {
    return res.status(400).json({ error: 'Nombre, usuario y secreto/contraseña son obligatorios' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const encryptedSecret = encryptSecret(secret.trim());

  db.prepare(`
    INSERT INTO credentials (id, name, type, username, secret_encrypted, domain, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), type, username.trim(), encryptedSecret, domain ? domain.trim() : null, description || null, now, now);

  logAudit({
    action: 'create',
    entity_type: 'credential',
    entity_id: id,
    entity_name: name.trim(),
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: `Credencial creada (${type}) para usuario ${username}`,
    ip_address: req.ip,
  });

  const created = db.prepare(`
    SELECT id, name, type, username, domain, description, created_at, updated_at, '••••••••••••' as secret_masked
    FROM credentials WHERE id = ?
  `).get(id);

  return res.status(201).json(created);
});

// UPDATE credential
router.put('/:id', (req: AuthenticatedRequest, res) => {
  const credId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = db.prepare('SELECT * FROM credentials WHERE id = ?').get(credId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Credencial no encontrada' });
  }

  const { name = existing.name, type = existing.type, username = existing.username, secret, domain = existing.domain, description = existing.description } = req.body;
  const now = new Date().toISOString();

  let secretToSave = existing.secret_encrypted;
  if (secret && secret !== '••••••••••••') {
    secretToSave = encryptSecret(secret.trim());
  }

  db.prepare(`
    UPDATE credentials SET
      name = ?, type = ?, username = ?, secret_encrypted = ?, domain = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).run(name, type, username, secretToSave, domain, description, now, credId);

  logAudit({
    action: 'update',
    entity_type: 'credential',
    entity_id: credId,
    entity_name: name,
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: `Credencial actualizada (${type})`,
    ip_address: req.ip,
  });

  const updated = db.prepare(`
    SELECT id, name, type, username, domain, description, created_at, updated_at, '••••••••••••' as secret_masked
    FROM credentials WHERE id = ?
  `).get(credId);

  return res.json(updated);
});

// DELETE credential
router.delete('/:id', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const credId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = db.prepare('SELECT * FROM credentials WHERE id = ?').get(credId) as any;
  const result = db.prepare('DELETE FROM credentials WHERE id = ?').run(credId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Credencial no encontrada' });
  }

  logAudit({
    action: 'delete',
    entity_type: 'credential',
    entity_id: credId,
    entity_name: existing?.name || credId,
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: 'Credencial eliminada',
    ip_address: req.ip,
  });

  return res.json({ message: 'Credencial eliminada exitosamente' });
});

export default router;
