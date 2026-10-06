import { Router } from 'express';
import crypto from 'crypto';
import net from 'net';
import { db, logAudit } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET all destinations with filters
router.get('/', requireAuth, (req, res) => {
  const { system_type, category, search, active } = req.query;

  let query = `
    SELECT d.*, c.name as credential_name, c.username as credential_username,
      (SELECT COUNT(*) FROM task_destinations td WHERE td.destination_id = d.id) as task_count
    FROM destinations d
    LEFT JOIN credentials c ON d.credential_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (system_type) {
    query += ` AND d.system_type = ?`;
    params.push(system_type);
  }

  if (category) {
    query += ` AND d.category = ?`;
    params.push(category);
  }

  if (active !== undefined && active !== '') {
    query += ` AND d.is_active = ?`;
    params.push(active === 'true' || active === '1' ? 1 : 0);
  }

  if (search) {
    query += ` AND (d.name LIKE ? OR d.hostname LIKE ? OR d.ip_address LIKE ? OR d.os_name LIKE ? OR d.tags LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  query += ` ORDER BY d.name ASC`;

  const destinations = db.prepare(query).all(...params);
  return res.json(destinations);
});

// GET destination details
router.get('/:id', requireAuth, (req, res) => {
  const destinationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const destination = db.prepare(`
    SELECT d.*, c.name as credential_name, c.username as credential_username
    FROM destinations d
    LEFT JOIN credentials c ON d.credential_id = c.id
    WHERE d.id = ?
  `).get(destinationId);

  if (!destination) {
    return res.status(404).json({ error: 'Destino no encontrado' });
  }

  // Get associated tasks
  const tasks = db.prepare(`
    SELECT t.id, t.name, t.task_type, t.command_type, t.schedule_expression, t.is_active, t.last_status, t.next_run_at
    FROM tasks t
    JOIN task_destinations td ON td.task_id = t.id
    WHERE td.destination_id = ?
  `).all(destinationId);

  // Get recent executions on this destination
  const recentExecutions = db.prepare(`
    SELECT e.* FROM executions e
    WHERE e.destination_id = ?
    ORDER BY e.started_at DESC
    LIMIT 10
  `).all(destinationId);

  return res.json({
    ...destination,
    tasks,
    recentExecutions,
  });
});

// CREATE destination
router.post('/', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const {
    name,
    hostname,
    ip_address,
    system_type = 'linux',
    os_name,
    os_version,
    category = 'Servidor',
    description,
    is_active = 1,
    connection_method = 'ssh',
    credential_id,
    port,
    domain,
    tags = [],
  } = req.body;

  if (!name || !hostname || !os_name) {
    return res.status(400).json({ error: 'Nombre, hostname y sistema operativo son obligatorios' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');

  db.prepare(`
    INSERT INTO destinations (
      id, name, hostname, ip_address, system_type, os_name, os_version,
      category, description, is_active, connection_method, credential_id,
      port, domain, tags, created_at, last_used_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name.trim(),
    hostname.trim(),
    ip_address ? ip_address.trim() : null,
    system_type,
    os_name.trim(),
    os_version ? os_version.trim() : null,
    category || 'Servidor',
    description || null,
    is_active ? 1 : 0,
    connection_method,
    credential_id || null,
    port ? Number(port) : (connection_method === 'ssh' ? 22 : 5985),
    domain || null,
    tagsStr,
    now,
    null
  );

  const created = db.prepare('SELECT * FROM destinations WHERE id = ?').get(id);

  logAudit({
    action: 'create',
    entity_type: 'destination',
    entity_id: id,
    entity_name: name.trim(),
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: `Destino creado: ${hostname} (${os_name})`,
    ip_address: req.ip,
  });

  return res.status(201).json(created);
});

// UPDATE destination
router.put('/:id', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const destinationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = db.prepare('SELECT * FROM destinations WHERE id = ?').get(destinationId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Destino no encontrado' });
  }

  const {
    name = existing.name,
    hostname = existing.hostname,
    ip_address = existing.ip_address,
    system_type = existing.system_type,
    os_name = existing.os_name,
    os_version = existing.os_version,
    category = existing.category,
    description = existing.description,
    is_active = existing.is_active,
    connection_method = existing.connection_method,
    credential_id = existing.credential_id,
    port = existing.port,
    domain = existing.domain,
    tags = existing.tags,
  } = req.body;

  const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');

  db.prepare(`
    UPDATE destinations SET
      name = ?, hostname = ?, ip_address = ?, system_type = ?, os_name = ?, os_version = ?,
      category = ?, description = ?, is_active = ?, connection_method = ?, credential_id = ?,
      port = ?, domain = ?, tags = ?
    WHERE id = ?
  `).run(
    name,
    hostname,
    ip_address,
    system_type,
    os_name,
    os_version,
    category,
    description,
    is_active ? 1 : 0,
    connection_method,
    credential_id || null,
    port ? Number(port) : null,
    domain,
    tagsStr,
    destinationId
  );

  logAudit({
    action: 'update',
    entity_type: 'destination',
    entity_id: destinationId,
    entity_name: name,
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: 'Destino actualizado',
    ip_address: req.ip,
  });

  const updated = db.prepare('SELECT * FROM destinations WHERE id = ?').get(destinationId);
  return res.json(updated);
});

// DELETE destination
router.delete('/:id', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const destinationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = db.prepare('SELECT * FROM destinations WHERE id = ?').get(destinationId) as any;
  const result = db.prepare('DELETE FROM destinations WHERE id = ?').run(destinationId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Destino no encontrado' });
  }

  logAudit({
    action: 'delete',
    entity_type: 'destination',
    entity_id: destinationId,
    entity_name: existing?.name || destinationId,
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: 'Destino eliminado',
    ip_address: req.ip,
  });

  return res.json({ message: 'Destino eliminado con éxito' });
});

// TEST connection / ping to destination
router.post('/:id/test', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
  const destinationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const dest = db.prepare('SELECT * FROM destinations WHERE id = ?').get(destinationId) as any;
  if (!dest) {
    return res.status(404).json({ error: 'Destino no encontrado' });
  }

  const startTime = Date.now();
  const method = (dest.connection_method || 'local').toLowerCase();
  const port = dest.port || (method === 'ssh' ? 22 : 5985);
  const targetHost = dest.hostname || dest.ip_address || 'localhost';

  if (method === 'local' || targetHost === 'localhost' || targetHost === '127.0.0.1') {
    return res.json({
      success: true,
      destination: dest.name,
      hostname: targetHost,
      method: dest.connection_method.toUpperCase(),
      port,
      duration_ms: Math.max(1, Date.now() - startTime),
      message: `Conectado correctamente con ${dest.name}`,
      details: `Host local verificado correctamente. Tiempo de respuesta: ${Math.max(1, Date.now() - startTime)}ms.`,
      testedAt: new Date().toISOString(),
    });
  }

  // Socket TCP connection test with 3-second timeout
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(3000);

    socket.on('connect', () => {
      if (isResolved) return;
      isResolved = true;
      const durationMs = Date.now() - startTime;
      socket.destroy();
      return resolve(res.json({
        success: true,
        destination: dest.name,
        hostname: targetHost,
        method: dest.connection_method.toUpperCase(),
        port,
        duration_ms: durationMs,
        message: `Conectado correctamente con ${dest.name}`,
        details: `Conexión TCP establecida con ${targetHost}:${port} (${dest.connection_method.toUpperCase()}). Latencia: ${durationMs}ms.`,
        testedAt: new Date().toISOString(),
      }));
    });

    const handleError = (errMsg: string) => {
      if (isResolved) return;
      isResolved = true;
      socket.destroy();
      return resolve(res.status(400).json({
        success: false,
        destination: dest.name,
        hostname: targetHost,
        method: dest.connection_method.toUpperCase(),
        port,
        duration_ms: Date.now() - startTime,
        message: `No se pudo conectar con ${dest.name}`,
        details: `Fallo al conectar con ${targetHost}:${port}. ${errMsg}. Comprueba el destino, puerto o credencial.`,
        testedAt: new Date().toISOString(),
      }));
    };

    socket.on('timeout', () => handleError('Tiempo de espera agotado (timeout de 3000ms)'));
    socket.on('error', (err) => handleError(err.message || 'Error de socket de red'));

    socket.connect(port, targetHost);
  });
});

export default router;
