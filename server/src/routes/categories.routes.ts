import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET all categories with count of tasks
router.get('/', requireAuth, (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(t.id) as task_count
    FROM categories c
    LEFT JOIN tasks t ON t.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();
  return res.json(categories);
});

// CREATE category
router.post('/', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const { name, description, color = '#00f0ff', icon = 'folder' } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
  }

  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
  if (existing) {
    return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO categories (id, name, description, color, icon, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, description || null, color, icon, now);

  const created = db.prepare('SELECT *, 0 as task_count FROM categories WHERE id = ?').get(id);
  return res.status(201).json(created);
});

// UPDATE category
router.put('/:id', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
  const { name, description, color, icon } = req.body;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }

  if (name && name !== existing.name) {
    const duplicate = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name, req.params.id);
    if (duplicate) {
      return res.status(400).json({ error: 'Ya existe otra categoría con ese nombre' });
    }
  }

  db.prepare(`
    UPDATE categories
    SET name = ?, description = ?, color = ?, icon = ?
    WHERE id = ?
  `).run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    color || existing.color,
    icon || existing.icon,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT c.*, COUNT(t.id) as task_count
    FROM categories c
    LEFT JOIN tasks t ON t.category_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(req.params.id);

  return res.json(updated);
});

// DELETE category
router.delete('/:id', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
  // Set tasks with this category to NULL before deleting
  db.prepare('UPDATE tasks SET category_id = NULL WHERE category_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }

  return res.json({ message: 'Categoría eliminada con éxito' });
});

export default router;
