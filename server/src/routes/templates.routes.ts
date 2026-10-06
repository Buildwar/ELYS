import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET all templates
router.get('/', requireAuth, (req, res) => {
  const { system_type, command_type, search } = req.query;

  let query = `
    SELECT t.*,
      (SELECT COUNT(*) FROM tasks tk WHERE tk.template_id = t.id) as task_count
    FROM templates t
    WHERE 1=1
  `;
  const params: any[] = [];

  if (system_type) {
    query += ` AND t.system_type = ?`;
    params.push(system_type);
  }

  if (command_type) {
    query += ` AND t.command_type = ?`;
    params.push(command_type);
  }

  if (search) {
    query += ` AND (t.name LIKE ? OR t.description LIKE ? OR t.tags LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += ` ORDER BY t.name ASC`;

  const templates = db.prepare(query).all(...params);
  return res.json(templates);
});

// CREATE template
router.post('/', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const { name, description, system_type = 'windows_server', command_type = 'powershell', command_template, default_timeout = 300, tags = [] } = req.body;
  if (!name || !command_template) {
    return res.status(400).json({ error: 'Nombre y comando de la plantilla son obligatorios' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');

  db.prepare(`
    INSERT INTO templates (id, name, description, system_type, command_type, command_template, default_timeout, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), description || null, system_type, command_type, command_template.trim(), Number(default_timeout), tagsStr, now);

  const created = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  return res.status(201).json(created);
});

// UPDATE template
router.put('/:id', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const templateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Plantilla no encontrada' });
  }

  const {
    name = existing.name,
    description = existing.description,
    system_type = existing.system_type,
    command_type = existing.command_type,
    command_template = existing.command_template,
    default_timeout = existing.default_timeout,
    tags = existing.tags,
  } = req.body;

  const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');

  db.prepare(`
    UPDATE templates SET
      name = ?, description = ?, system_type = ?, command_type = ?, command_template = ?,
      default_timeout = ?, tags = ?
    WHERE id = ?
  `).run(name, description, system_type, command_type, command_template, Number(default_timeout), tagsStr, templateId);

  const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId);
  return res.json(updated);
});

// DELETE template
router.delete('/:id', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
  const templateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = db.prepare('DELETE FROM templates WHERE id = ?').run(templateId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Plantilla no encontrada' });
  }
  return res.json({ message: 'Plantilla eliminada exitosamente' });
});

export default router;
