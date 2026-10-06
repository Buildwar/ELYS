import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET audit logs with search & filters (Admin and Operator)
router.get('/', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const { search, action, entity_type, limit = 100 } = req.query;

  let query = `
    SELECT id, action, entity_type, entity_id, entity_name, user_id, username, details, ip_address, created_at
    FROM audit_logs
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (entity_name LIKE ? OR username LIKE ? OR details LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (action) {
    query += ` AND action = ?`;
    params.push(action);
  }

  if (entity_type) {
    query += ` AND entity_type = ?`;
    params.push(entity_type);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Number(limit) || 100);

  const logs = db.prepare(query).all(...params);
  return res.json(logs);
});

export default router;
