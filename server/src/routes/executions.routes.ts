import { Router } from 'express';
import { db, getExecutionLogs, logAudit } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { cancelExecution } from '../scheduler/index.js';

const router = Router();

// GET executions with pagination and filters
router.get('/', requireAuth, (req, res) => {
  const { status, taskId, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT e.*, t.name as current_task_name
    FROM executions e
    LEFT JOIN tasks t ON e.task_id = t.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    query += ` AND e.status = ?`;
    params.push(status);
  }

  if (taskId) {
    query += ` AND e.task_id = ?`;
    params.push(taskId);
  }

  query += ` ORDER BY e.started_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const executions = db.prepare(query).all(...params);

  const countQuery = `
    SELECT COUNT(*) as total FROM executions WHERE 1=1
    ${status ? 'AND status = ?' : ''}
    ${taskId ? 'AND task_id = ?' : ''}
  `;
  const countParams: any[] = [];
  if (status) countParams.push(status);
  if (taskId) countParams.push(taskId);

  const total = (db.prepare(countQuery).get(...countParams) as { total: number }).total;

  return res.json({
    data: executions,
    total,
    limit: Number(limit),
    offset: Number(offset),
  });
});

// GET single execution detail with structured logs
router.get('/:id', requireAuth, (req, res) => {
  const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const execution = db.prepare(`
    SELECT e.*, t.name as current_task_name, t.task_type
    FROM executions e
    LEFT JOIN tasks t ON e.task_id = t.id
    WHERE e.id = ?
  `).get(executionId) as any;

  if (!execution) {
    return res.status(404).json({ error: 'Ejecución no encontrada' });
  }

  const logs = getExecutionLogs(executionId);

  return res.json({ ...execution, logs });
});

// GET execution logs
router.get('/:id/logs', requireAuth, (req, res) => {
  const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const logs = getExecutionLogs(executionId);
  return res.json(logs);
});

// DOWNLOAD execution logs (Section 24: TXT, JSON, CSV)
router.get('/:id/download', requireAuth, (req, res) => {
  const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const format = String(req.query.format || 'txt').toLowerCase();

  const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any;
  if (!execution) {
    return res.status(404).json({ error: 'Ejecución no encontrada' });
  }

  const logs = getExecutionLogs(executionId);

  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="execution_${executionId}.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify({ execution, logs }, null, 2));
  } else if (format === 'csv') {
    res.setHeader('Content-Disposition', `attachment; filename="execution_${executionId}.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    let csv = 'Timestamp,Level,Message,Details\n';
    for (const l of logs) {
      csv += `"${l.timestamp}","${l.level}","${(l.message || '').replace(/"/g, '""')}","${(l.details || '').replace(/"/g, '""')}"\n`;
    }
    return res.send(csv);
  } else {
    // Default TXT
    res.setHeader('Content-Disposition', `attachment; filename="execution_${executionId}.log"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    let txt = `========================================================\n`;
    txt += `ELYS EXECUTION LOG REPORT\n`;
    txt += `ID: ${execution.id}\n`;
    txt += `Tarea: ${execution.task_name} (${execution.task_id})\n`;
    txt += `Destino: ${execution.destination_name || 'Local'} (${execution.destination_os || 'Local Host'})\n`;
    txt += `Método: ${execution.execution_method}\n`;
    txt += `Estado: ${execution.status.toUpperCase()}\n`;
    txt += `Inicio: ${execution.started_at}\n`;
    txt += `Fin: ${execution.finished_at || 'En curso'}\n`;
    txt += `Duración: ${execution.duration_ms ? execution.duration_ms + 'ms' : 'N/A'}\n`;
    txt += `Código de Salida: ${execution.exit_code !== null ? execution.exit_code : 'N/A'}\n`;
    txt += `========================================================\n\n`;

    txt += `[REGISTROS DE EJECUCIÓN]\n`;
    for (const l of logs) {
      txt += `[${l.timestamp}] [${l.level}] ${l.message} ${l.details ? '- ' + l.details : ''}\n`;
    }

    txt += `\n[SALIDA ESTÁNDAR (STDOUT)]\n`;
    txt += execution.output || '(Vacío)';

    txt += `\n\n[SALIDA DE ERROR (STDERR)]\n`;
    txt += execution.error_output || '(Vacío)';

    return res.send(txt);
  }
});

// CANCEL running execution
router.post('/:id/cancel', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { reason } = req.body || {};

  const success = cancelExecution(executionId, req.user?.username, reason);
  if (!success) {
    return res.status(400).json({ error: 'No se pudo cancelar o la ejecución ya no está en curso' });
  }

  logAudit({
    action: 'cancel_execution',
    entity_type: 'execution',
    entity_id: executionId,
    username: req.user?.username || 'user',
    details: `Ejecución cancelada manualmente: ${reason || 'Sin motivo especificado'}`,
    ip_address: req.ip,
  });

  return res.json({ message: 'Ejecución cancelada con éxito' });
});

// PRUNE old logs (Section 25: log retention)
router.post('/prune', requireAuth, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { days = 30 } = req.body || {};
  const cutoff = new Date(Date.now() - Number(days) * 86400 * 1000).toISOString();

  const deletedLogs = db.prepare(`
    DELETE FROM execution_logs
    WHERE execution_id IN (SELECT id FROM executions WHERE started_at < ?)
  `).run(cutoff);

  const deletedExecs = db.prepare('DELETE FROM executions WHERE started_at < ?').run(cutoff);

  logAudit({
    action: 'prune_logs',
    entity_type: 'execution',
    username: req.user?.username || 'admin',
    details: `Limpieza de logs anteriores a ${days} días: ${deletedExecs.changes} ejecuciones y ${deletedLogs.changes} registros eliminados`,
    ip_address: req.ip,
  });

  return res.json({
    message: `Limpieza completada: ${deletedExecs.changes} ejecuciones eliminadas.`,
    deletedExecutions: deletedExecs.changes,
    deletedLogs: deletedLogs.changes,
  });
});

export default router;
