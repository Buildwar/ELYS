import { Router } from 'express';
import { db, logAudit } from '../db/index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET all settings
router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, any> = {};

  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }

  // Mask sensitive values for non-admin users
  if (req.user?.role !== 'admin') {
    if (settings.integrations) {
      if (settings.integrations.telegram_bot_token) {
        settings.integrations.telegram_bot_token = '••••••••••••';
      }
      if (settings.integrations.smtp_pass) {
        settings.integrations.smtp_pass = '••••••••••••';
      }
    }
  }

  return res.json(settings);
});

// UPDATE setting (Appearance can be updated by any user. All other settings are admin-only.)
router.put('/:key', requireAuth, (req: AuthenticatedRequest, res) => {
  const keyParam = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const key = String(keyParam);
  const value = req.body;

  if (key !== 'appearance' && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden modificar esta configuración' });
  }

  const now = new Date().toISOString();
  const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, valueStr, now);

  logAudit({
    action: 'update_setting',
    entity_type: 'setting',
    entity_name: key,
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: `Configuración "${key}" actualizada`,
    ip_address: req.ip,
  });

  return res.json({ key, value });
});

export default router;
