import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit, logTaskHistory } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { calculateNextRun, executeTask } from '../scheduler/index.js';
import {
  addTaskDependency,
  getTaskDependencies,
  getTaskDependents,
} from '../scheduler/dependencies.js';
import { resolveVariables, maskSecretsInText } from '../scheduler/variables.js';

const router = Router();

// GET all tasks (excludes trashed tasks by default)
router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const { search, category, status, type, destination, tag, state, favorite, trashed } = req.query;

  let query = `
    SELECT t.*, c.name as category_name, c.color as category_color, u.username as creator_username,
      cr.name as credential_name,
      (
        SELECT json_group_array(json_object('id', d.id, 'name', d.name, 'os_name', d.os_name, 'system_type', d.system_type))
        FROM task_destinations td
        JOIN destinations d ON td.destination_id = d.id
        WHERE td.task_id = t.id
      ) as destinations_json
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN credentials cr ON t.credential_id = cr.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Trashed filter
  if (trashed === '1' || trashed === 'true') {
    query += ` AND t.is_trashed = 1`;
  } else {
    query += ` AND (t.is_trashed = 0 OR t.is_trashed IS NULL)`;
  }

  if (search) {
    query += ` AND (t.name LIKE ? OR t.description LIKE ? OR t.tags LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (category) {
    query += ` AND t.category_id = ?`;
    params.push(category);
  }

  if (status !== undefined && status !== '') {
    if (status === 'active') {
      query += ` AND t.is_active = 1`;
    } else if (status === 'disabled') {
      query += ` AND t.is_active = 0`;
    }
  }

  if (state) {
    query += ` AND t.state = ?`;
    params.push(state);
  }

  if (favorite === '1' || favorite === 'true') {
    query += ` AND t.is_favorite = 1`;
  }

  if (tag) {
    query += ` AND t.tags LIKE ?`;
    params.push(`%"${tag}"%`);
  }

  if (type) {
    query += ` AND (t.task_type = ? OR t.command_type = ?)`;
    params.push(type, type);
  }

  if (destination) {
    query += ` AND EXISTS (SELECT 1 FROM task_destinations td WHERE td.task_id = t.id AND td.destination_id = ?)`;
    params.push(destination);
  }

  query += ` ORDER BY t.is_favorite DESC, t.name ASC`;

  const tasks = db.prepare(query).all(...params) as any[];

  const formatted = tasks.map((task) => {
    let destinations = [];
    try {
      destinations = JSON.parse(task.destinations_json || '[]');
    } catch {
      destinations = [];
    }

    let parsedTags = [];
    try {
      parsedTags = JSON.parse(task.tags || '[]');
    } catch {
      parsedTags = [];
    }

    let parsedVariables = [];
    try {
      parsedVariables = JSON.parse(task.variables || '[]');
    } catch {
      parsedVariables = [];
    }

    let parsedTargetParams = {};
    try {
      parsedTargetParams = JSON.parse(task.target_params || '{}');
    } catch {
      parsedTargetParams = {};
    }

    return {
      ...task,
      destinations,
      tags: parsedTags,
      variables: parsedVariables,
      target_params: parsedTargetParams,
    };
  });

  return res.json(formatted);
});

// GET trash tasks
router.get('/trash', requireAuth, (req, res) => {
  const trashed = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, u.username as creator_username
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.is_trashed = 1
    ORDER BY t.deleted_at DESC
  `).all();
  return res.json(trashed);
});

// EXPORT tasks as JSON (excluding secrets)
router.post('/export', requireAuth, (req: AuthenticatedRequest, res) => {
  const { taskIds } = req.body || {};

  let tasksToExport: any[] = [];
  if (Array.isArray(taskIds) && taskIds.length > 0) {
    const placeholders = taskIds.map(() => '?').join(',');
    tasksToExport = db.prepare(`SELECT * FROM tasks WHERE id IN (${placeholders})`).all(...taskIds);
  } else {
    tasksToExport = db.prepare(`SELECT * FROM tasks WHERE is_trashed = 0`).all();
  }

  const exportPayload = {
    format: 'ELYS_TASK_EXPORT',
    version: 1,
    exported_at: new Date().toISOString(),
    exported_by: req.user?.username || 'admin',
    count: tasksToExport.length,
    tasks: tasksToExport.map((t) => {
      // Get destinations names
      const dests = db.prepare(`
        SELECT d.id, d.name, d.hostname, d.system_type FROM destinations d
        JOIN task_destinations td ON td.destination_id = d.id
        WHERE td.task_id = ?
      `).all(t.id) as any[];

      // Get dependencies
      const deps = getTaskDependencies(t.id);

      // Clean variables: strip actual secret values
      let safeVars: any[] = [];
      try {
        const parsed = JSON.parse(t.variables || '[]');
        if (Array.isArray(parsed)) {
          safeVars = parsed.map((v) => ({
            key: v.key,
            value: v.is_secret ? '' : v.value,
            is_secret: v.is_secret,
          }));
        }
      } catch {}

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        task_type: t.task_type,
        command_type: t.command_type,
        payload: t.payload,
        schedule_type: t.schedule_type,
        schedule_expression: t.schedule_expression,
        timezone: t.timezone,
        timeout_seconds: t.timeout_seconds,
        max_retries: t.max_retries,
        retry_interval_seconds: t.retry_interval_seconds,
        retry_backoff: t.retry_backoff,
        concurrency_limit: t.concurrency_limit,
        concurrency_policy: t.concurrency_policy,
        multitarget_error_policy: t.multitarget_error_policy,
        misfire_policy: t.misfire_policy,
        misfire_tolerance_minutes: t.misfire_tolerance_minutes,
        on_error: t.on_error,
        tags: t.tags,
        variables: safeVars,
        target_params: t.target_params,
        destinations: dests.map((d) => ({ name: d.name, system_type: d.system_type })),
        dependencies: deps.map((dp) => ({
          depends_on_task_name: dp.depends_on_task_name,
          condition: dp.condition,
        })),
      };
    }),
  };

  return res.json(exportPayload);
});

// IMPORT tasks from JSON
router.post('/import', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const { importData, conflictResolution = 'create_new' } = req.body;
  if (!importData || !Array.isArray(importData.tasks)) {
    return res.status(400).json({ error: 'Formato de importación inválido' });
  }

  let imported = 0;
  let skipped = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const t of importData.tasks) {
    if (!t.name || !t.schedule_expression) continue;

    const existing = db.prepare('SELECT id, name FROM tasks WHERE id = ? OR name = ?').get(t.id, t.name) as any;

    if (existing) {
      if (conflictResolution === 'skip') {
        skipped++;
        continue;
      } else if (conflictResolution === 'replace') {
        db.prepare(`
          UPDATE tasks SET
            name = ?, description = ?, task_type = ?, command_type = ?, payload = ?,
            schedule_type = ?, schedule_expression = ?, timezone = ?, timeout_seconds = ?,
            max_retries = ?, tags = ?, variables = ?, updated_at = ?
          WHERE id = ?
        `).run(
          t.name,
          t.description || null,
          t.task_type || 'command',
          t.command_type || 'powershell',
          typeof t.payload === 'object' ? JSON.stringify(t.payload) : t.payload,
          t.schedule_type || 'daily',
          t.schedule_expression,
          t.timezone || 'UTC',
          t.timeout_seconds || 300,
          t.max_retries || 0,
          typeof t.tags === 'string' ? t.tags : JSON.stringify(t.tags || []),
          typeof t.variables === 'string' ? t.variables : JSON.stringify(t.variables || []),
          now,
          existing.id
        );
        updated++;
        continue;
      }
    }

    // Default: create as new with new UUID
    const newId = crypto.randomUUID();
    const nextDate = calculateNextRun(t.schedule_type || 'daily', t.schedule_expression, t.timezone || 'UTC', new Date());

    db.prepare(`
      INSERT INTO tasks (
        id, name, description, is_active, state, task_type, command_type, payload,
        schedule_type, schedule_expression, timezone, timeout_seconds, max_retries,
        on_error, next_run_at, tags, variables, target_params, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, 1, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      existing ? `${t.name} (Importada)` : t.name,
      t.description || null,
      t.task_type || 'command',
      t.command_type || 'powershell',
      typeof t.payload === 'object' ? JSON.stringify(t.payload) : t.payload,
      t.schedule_type || 'daily',
      t.schedule_expression,
      t.timezone || 'UTC',
      t.timeout_seconds || 300,
      t.max_retries || 0,
      t.on_error || 'continue',
      nextDate ? nextDate.toISOString() : null,
      typeof t.tags === 'string' ? t.tags : JSON.stringify(t.tags || []),
      typeof t.variables === 'string' ? t.variables : JSON.stringify(t.variables || []),
      typeof t.target_params === 'string' ? t.target_params : JSON.stringify(t.target_params || {}),
      req.user!.id,
      now,
      now
    );
    imported++;
  }

  logAudit({
    action: 'import',
    entity_type: 'task',
    username: req.user?.username || 'admin',
    details: `Importación de tareas finalizada (${imported} creadas, ${updated} reemplazadas, ${skipped} omitidas)`,
    ip_address: req.ip,
  });

  return res.json({
    message: 'Importación completada con éxito',
    imported,
    updated,
    skipped,
  });
});

// BULK ACTIONS
router.post('/bulk', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const { taskIds, action, tag } = req.body;
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ error: 'No se especificaron tareas para la acción masiva' });
  }

  if (action === 'delete_permanent' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Solo los administradores pueden eliminar tareas permanentemente' });
  }

  const now = new Date().toISOString();
  let affected = 0;

  for (const tId of taskIds) {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(tId) as any;
    if (!task) continue;

    switch (action) {
      case 'activate': {
        const nextDate = calculateNextRun(task.schedule_type, task.schedule_expression, task.timezone, new Date());
        db.prepare("UPDATE tasks SET is_active = 1, state = 'ACTIVE', next_run_at = ?, updated_at = ? WHERE id = ?")
          .run(nextDate ? nextDate.toISOString() : null, now, tId);
        logTaskHistory({ taskId: tId, action: 'ACTIVATE', changedBy: req.user!.username, changeSummary: 'Activación masiva' });
        affected++;
        break;
      }
      case 'deactivate': {
        db.prepare("UPDATE tasks SET is_active = 0, state = 'DISABLED', next_run_at = NULL, updated_at = ? WHERE id = ?")
          .run(now, tId);
        logTaskHistory({ taskId: tId, action: 'DEACTIVATE', changedBy: req.user!.username, changeSummary: 'Desactivación masiva' });
        affected++;
        break;
      }
      case 'pause': {
        db.prepare("UPDATE tasks SET state = 'PAUSED', updated_at = ? WHERE id = ?").run(now, tId);
        logTaskHistory({ taskId: tId, action: 'PAUSE', changedBy: req.user!.username, changeSummary: 'Pausa masiva' });
        affected++;
        break;
      }
      case 'run': {
        executeTask(tId, 'manual', req.user!.username).catch(console.error);
        affected++;
        break;
      }
      case 'add_tag': {
        if (!tag) break;
        let tags: string[] = [];
        try { tags = JSON.parse(task.tags || '[]'); } catch {}
        if (!tags.includes(tag)) {
          tags.push(tag);
          db.prepare('UPDATE tasks SET tags = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(tags), now, tId);
          affected++;
        }
        break;
      }
      case 'remove_tag': {
        if (!tag) break;
        let tags: string[] = [];
        try { tags = JSON.parse(task.tags || '[]'); } catch {}
        tags = tags.filter((tg) => tg !== tag);
        db.prepare('UPDATE tasks SET tags = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(tags), now, tId);
        affected++;
        break;
      }
      case 'move_to_trash': {
        db.prepare('UPDATE tasks SET is_trashed = 1, deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, tId);
        logTaskHistory({ taskId: tId, action: 'TRASH', changedBy: req.user!.username, changeSummary: 'Movida a la papelera' });
        affected++;
        break;
      }
      case 'restore_trash': {
        db.prepare('UPDATE tasks SET is_trashed = 0, deleted_at = NULL, updated_at = ? WHERE id = ?').run(now, tId);
        logTaskHistory({ taskId: tId, action: 'RESTORE_TRASH', changedBy: req.user!.username, changeSummary: 'Restaurada de la papelera' });
        affected++;
        break;
      }
      case 'delete_permanent': {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(tId);
        affected++;
        break;
      }
    }
  }

  logAudit({
    action: `bulk_${action}`,
    entity_type: 'task',
    username: req.user?.username || 'admin',
    details: `Acción masiva "${action}" ejecutada en ${affected} tareas`,
    ip_address: req.ip,
  });

  return res.json({ message: `Acción "${action}" completada en ${affected} tareas`, affected });
});

// GET single task
router.get('/:id', requireAuth, (req, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, u.username as creator_username,
      cr.name as credential_name
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN credentials cr ON t.credential_id = cr.id
    WHERE t.id = ?
  `).get(taskId) as any;

  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const destinations = db.prepare(`
    SELECT d.id, d.name, d.hostname, d.os_name, d.system_type, d.connection_method, d.port, d.ip_address
    FROM destinations d
    JOIN task_destinations td ON td.destination_id = d.id
    WHERE td.task_id = ?
  `).all(taskId);

  const dependencies = getTaskDependencies(taskId);
  const dependents = getTaskDependents(taskId);

  let parsedTags = [];
  try { parsedTags = JSON.parse(task.tags || '[]'); } catch {}
  let parsedVariables = [];
  try { parsedVariables = JSON.parse(task.variables || '[]'); } catch {}
  let parsedTargetParams = {};
  try { parsedTargetParams = JSON.parse(task.target_params || '{}'); } catch {}

  return res.json({
    ...task,
    destinations,
    dependencies,
    dependents,
    tags: parsedTags,
    variables: parsedVariables,
    target_params: parsedTargetParams,
  });
});

// CREATE task
router.post('/', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const {
    name,
    description,
    categoryId,
    templateId,
    credentialId,
    targetType = 'single',
    targetGroup,
    destinationIds = [],
    taskType = 'command',
    commandType = 'powershell',
    payload,
    scheduleType = 'daily',
    scheduleExpression = '03:00',
    timezone = 'UTC',
    timeoutSeconds = 300,
    maxRetries = 0,
    retryIntervalSeconds = 60,
    retryBackoff = 'fixed',
    concurrencyLimit = 1,
    concurrencyPolicy = 'block',
    multitargetErrorPolicy = 'continue_others',
    misfirePolicy = 'run_immediately',
    misfireToleranceMinutes = 15,
    onError = 'continue',
    isActive = 1,
    tags = [],
    variables = [],
    targetParams = {},
    notifyTelegram = 0,
    notifyEmail = 0,
    notifyOnSuccess = 1,
    notifyOnFail = 1,
    dependencies = [],
  } = req.body;

  if (!name || !scheduleExpression) {
    return res.status(400).json({ error: 'El nombre y la expresión de programación son requeridos' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  let nextRunAt: string | null = null;
  if (isActive) {
    const nextDate = calculateNextRun(scheduleType, scheduleExpression, timezone, new Date());
    nextRunAt = nextDate ? nextDate.toISOString() : null;
  }

  const payloadString = typeof payload === 'object' ? JSON.stringify(payload) : (payload || '{}');
  const tagsString = Array.isArray(tags) ? JSON.stringify(tags) : '[]';
  const variablesString = Array.isArray(variables) ? JSON.stringify(variables) : '[]';
  const targetParamsString = typeof targetParams === 'object' ? JSON.stringify(targetParams) : '{}';

  db.prepare(`
    INSERT INTO tasks (
      id, name, description, category_id, template_id, credential_id,
      target_type, target_group, is_active, state, task_type, command_type, payload,
      schedule_type, schedule_expression, timezone, timeout_seconds, max_retries,
      retry_interval_seconds, retry_backoff, concurrency_limit, concurrency_policy,
      multitarget_error_policy, misfire_policy, misfire_tolerance_minutes,
      on_error, next_run_at, tags, variables, target_params,
      notify_telegram, notify_email, notify_on_success, notify_on_fail,
      created_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, 'ACTIVE', ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
  `).run(
    id,
    name.trim(),
    description || null,
    categoryId || null,
    templateId || null,
    credentialId || null,
    targetType,
    targetGroup || null,
    isActive ? 1 : 0,
    taskType,
    commandType,
    payloadString,
    scheduleType,
    scheduleExpression,
    timezone,
    Number(timeoutSeconds),
    Number(maxRetries),
    Number(retryIntervalSeconds),
    retryBackoff,
    Number(concurrencyLimit),
    concurrencyPolicy,
    multitargetErrorPolicy,
    misfirePolicy,
    Number(misfireToleranceMinutes),
    onError,
    nextRunAt,
    tagsString,
    variablesString,
    targetParamsString,
    notifyTelegram ? 1 : 0,
    notifyEmail ? 1 : 0,
    notifyOnSuccess ? 1 : 0,
    notifyOnFail ? 1 : 0,
    req.user!.id,
    now,
    now
  );

  // Link destinations
  if (Array.isArray(destinationIds) && destinationIds.length > 0) {
    const insertDest = db.prepare('INSERT OR IGNORE INTO task_destinations (task_id, destination_id) VALUES (?, ?)');
    for (const dId of destinationIds) {
      insertDest.run(id, dId);
    }
  }

  // Add dependencies
  if (Array.isArray(dependencies)) {
    for (const dep of dependencies) {
      if (dep.depends_on_task_id) {
        addTaskDependency(id, dep.depends_on_task_id, dep.condition || 'success');
      }
    }
  }

  logTaskHistory({
    taskId: id,
    action: 'CREATE',
    changedBy: req.user!.username,
    changeSummary: `Tarea creada con programación "${scheduleType}" (${scheduleExpression})`,
  });

  logAudit({
    action: 'create',
    entity_type: 'task',
    entity_id: id,
    entity_name: name.trim(),
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: `Tarea creada (${scheduleType})`,
    ip_address: req.ip,
  });

  const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return res.status(201).json(created);
});

// UPDATE task
router.put('/:id', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const {
    name = existing.name,
    description = existing.description,
    categoryId = existing.category_id,
    templateId = existing.template_id,
    credentialId = existing.credential_id,
    targetType = existing.target_type,
    targetGroup = existing.target_group,
    destinationIds,
    taskType = existing.task_type,
    commandType = existing.command_type,
    payload = existing.payload,
    scheduleType = existing.schedule_type,
    scheduleExpression = existing.schedule_expression,
    timezone = existing.timezone,
    timeoutSeconds = existing.timeout_seconds,
    maxRetries = existing.max_retries,
    retryIntervalSeconds = existing.retry_interval_seconds || 60,
    retryBackoff = existing.retry_backoff || 'fixed',
    concurrencyLimit = existing.concurrency_limit || 1,
    concurrencyPolicy = existing.concurrency_policy || 'block',
    multitargetErrorPolicy = existing.multitarget_error_policy || 'continue_others',
    misfirePolicy = existing.misfire_policy || 'run_immediately',
    misfireToleranceMinutes = existing.misfire_tolerance_minutes || 15,
    onError = existing.on_error,
    isActive = existing.is_active,
    state = existing.state || 'ACTIVE',
    tags = existing.tags,
    variables = existing.variables,
    targetParams = existing.target_params,
    notifyTelegram = existing.notify_telegram,
    notifyEmail = existing.notify_email,
    notifyOnSuccess = existing.notify_on_success,
    notifyOnFail = existing.notify_on_fail,
    dependencies,
  } = req.body;

  const now = new Date().toISOString();

  let nextRunAt: string | null = null;
  if (isActive && state !== 'PAUSED') {
    const nextDate = calculateNextRun(scheduleType, scheduleExpression, timezone, new Date());
    nextRunAt = nextDate ? nextDate.toISOString() : null;
  }

  const payloadString = typeof payload === 'object' ? JSON.stringify(payload) : payload;
  const tagsString = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');
  const variablesString = Array.isArray(variables) ? JSON.stringify(variables) : (typeof variables === 'string' ? variables : '[]');
  const targetParamsString = typeof targetParams === 'object' ? JSON.stringify(targetParams) : (typeof targetParams === 'string' ? targetParams : '{}');

  db.prepare(`
    UPDATE tasks SET
      name = ?, description = ?, category_id = ?, template_id = ?, credential_id = ?,
      target_type = ?, target_group = ?, is_active = ?, state = ?, task_type = ?, command_type = ?,
      payload = ?, schedule_type = ?, schedule_expression = ?, timezone = ?,
      timeout_seconds = ?, max_retries = ?, retry_interval_seconds = ?, retry_backoff = ?,
      concurrency_limit = ?, concurrency_policy = ?, multitarget_error_policy = ?,
      misfire_policy = ?, misfire_tolerance_minutes = ?, on_error = ?, next_run_at = ?,
      tags = ?, variables = ?, target_params = ?,
      notify_telegram = ?, notify_email = ?, notify_on_success = ?, notify_on_fail = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    name.trim(),
    description || null,
    categoryId || null,
    templateId || null,
    credentialId || null,
    targetType,
    targetGroup || null,
    isActive ? 1 : 0,
    state,
    taskType,
    commandType,
    payloadString,
    scheduleType,
    scheduleExpression,
    timezone,
    Number(timeoutSeconds),
    Number(maxRetries),
    Number(retryIntervalSeconds),
    retryBackoff,
    Number(concurrencyLimit),
    concurrencyPolicy,
    multitargetErrorPolicy,
    misfirePolicy,
    Number(misfireToleranceMinutes),
    onError,
    nextRunAt,
    tagsString,
    variablesString,
    targetParamsString,
    notifyTelegram ? 1 : 0,
    notifyEmail ? 1 : 0,
    notifyOnSuccess ? 1 : 0,
    notifyOnFail ? 1 : 0,
    now,
    taskId
  );

  // Update destinations if provided
  if (Array.isArray(destinationIds)) {
    db.prepare('DELETE FROM task_destinations WHERE task_id = ?').run(taskId);
    const insertDest = db.prepare('INSERT OR IGNORE INTO task_destinations (task_id, destination_id) VALUES (?, ?)');
    for (const dId of destinationIds) {
      insertDest.run(taskId, dId);
    }
  }

  // Update dependencies if provided
  if (Array.isArray(dependencies)) {
    db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(taskId);
    for (const dep of dependencies) {
      if (dep.depends_on_task_id) {
        addTaskDependency(taskId, dep.depends_on_task_id, dep.condition || 'success');
      }
    }
  }

  logTaskHistory({
    taskId,
    action: 'UPDATE',
    changedBy: req.user!.username,
    changeSummary: 'Configuración de tarea actualizada',
  });

  logAudit({
    action: 'update',
    entity_type: 'task',
    entity_id: taskId,
    entity_name: name.trim(),
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: 'Tarea actualizada',
    ip_address: req.ip,
  });

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  return res.json(updated);
});

// MOVE TO TRASH (Soft delete)
router.delete('/:id', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE tasks SET is_trashed = 1, deleted_at = ?, is_active = 0, next_run_at = NULL WHERE id = ?').run(now, taskId);

  logTaskHistory({
    taskId,
    action: 'TRASH',
    changedBy: req.user!.username,
    changeSummary: 'Tarea movida a la papelera',
  });

  logAudit({
    action: 'trash',
    entity_type: 'task',
    entity_id: taskId,
    entity_name: existing.name,
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: 'Tarea movida a la papelera',
    ip_address: req.ip,
  });

  return res.json({ message: 'Tarea movida a la papelera' });
});

// RESTORE FROM TRASH
router.post('/:id/restore', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const nextDate = calculateNextRun(task.schedule_type, task.schedule_expression, task.timezone, new Date());
  db.prepare("UPDATE tasks SET is_trashed = 0, deleted_at = NULL, is_active = 1, state = 'ACTIVE', next_run_at = ? WHERE id = ?")
    .run(nextDate ? nextDate.toISOString() : null, taskId);

  logTaskHistory({
    taskId,
    action: 'RESTORE_TRASH',
    changedBy: req.user!.username,
    changeSummary: 'Tarea restaurada de la papelera',
  });

  return res.json({ message: 'Tarea restaurada exitosamente' });
});

// PERMANENT DELETE
router.delete('/:id/permanent', requireAuth, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  logAudit({
    action: 'delete_permanent',
    entity_type: 'task',
    entity_id: taskId,
    entity_name: existing?.name || taskId,
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: 'Tarea eliminada permanentemente de la base de datos',
    ip_address: req.ip,
  });

  return res.json({ message: 'Tarea eliminada permanentemente' });
});

// TOGGLE FAVORITE
router.post('/:id/favorite', requireAuth, (req, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = db.prepare('SELECT id, is_favorite FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const nextFav = task.is_favorite === 1 ? 0 : 1;
  db.prepare('UPDATE tasks SET is_favorite = ? WHERE id = ?').run(nextFav, taskId);

  return res.json({ is_favorite: nextFav });
});

// PAUSE TASK
router.post('/:id/pause', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { pausedUntil } = req.body || {};

  db.prepare("UPDATE tasks SET state = 'PAUSED', paused_until = ?, next_run_at = NULL WHERE id = ?")
    .run(pausedUntil || null, taskId);

  logTaskHistory({
    taskId,
    action: 'PAUSE',
    changedBy: req.user!.username,
    changeSummary: pausedUntil ? `Pausada hasta ${pausedUntil}` : 'Pausada indefinidamente',
  });

  return res.json({ state: 'PAUSED', paused_until: pausedUntil || null });
});

// RESUME TASK
router.post('/:id/resume', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const nextDate = calculateNextRun(task.schedule_type, task.schedule_expression, task.timezone, new Date());
  db.prepare("UPDATE tasks SET state = 'ACTIVE', is_active = 1, paused_until = NULL, next_run_at = ? WHERE id = ?")
    .run(nextDate ? nextDate.toISOString() : null, taskId);

  logTaskHistory({
    taskId,
    action: 'RESUME',
    changedBy: req.user!.username,
    changeSummary: 'Tarea reanudada a estado activo',
  });

  return res.json({ state: 'ACTIVE', next_run_at: nextDate ? nextDate.toISOString() : null });
});

// PREVIEW COMMAND (Section 28)
router.post('/:id/preview', requireAuth, (req, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  let destinations = db.prepare(`
    SELECT d.* FROM destinations d
    JOIN task_destinations td ON td.destination_id = d.id
    WHERE td.task_id = ?
  `).all(taskId) as any[];

  if (destinations.length === 0) {
    destinations = [{ id: null, name: 'Local (ELYS)', hostname: 'localhost', os_name: 'ELYS Host' }];
  }

  let payloadObj: any = {};
  try {
    payloadObj = JSON.parse(task.payload);
  } catch {
    payloadObj = { command: task.payload };
  }

  const templateStr = payloadObj.command || payloadObj.url || payloadObj.script || '';

  const previews = destinations.map((dest) => {
    const varCtx = {
      task: { id: task.id, name: task.name, variables: task.variables, target_params: task.target_params },
      destination: dest,
      executionId: 'PREVIEW-SAMPLE',
      username: 'usuario',
    };
    const { resolved, secrets, resolvedMap } = resolveVariables(templateStr, varCtx);
    const maskedResolved = maskSecretsInText(resolved, secrets);

    let taskVars: any[] = [];
    try {
      taskVars = typeof task.variables === 'string' ? JSON.parse(task.variables || '[]') : (task.variables || []);
    } catch {}
    const safeMap: Record<string, string> = { ...resolvedMap };
    for (const tv of taskVars) {
      if (tv.is_secret && safeMap[tv.key]) {
        safeMap[tv.key] = '***';
      }
    }

    return {
      destination_id: dest.id,
      destination_name: dest.name,
      os_name: dest.os_name,
      resolved_command: maskedResolved,
      variables_evaluated: safeMap,
    };
  });

  return res.json(previews);
});

// GET TASK HISTORY (Section 35-36)
router.get('/:id/history', requireAuth, (req, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const history = db.prepare(`
    SELECT * FROM task_history WHERE task_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(taskId);
  return res.json(history);
});

// GET DEPENDENCIES
router.get('/:id/dependencies', requireAuth, (req, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deps = getTaskDependencies(taskId);
  const downstream = getTaskDependents(taskId);
  return res.json({ dependencies: deps, dependents: downstream });
});

// ADD DEPENDENCY
router.post('/:id/dependencies', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { dependsOnTaskId, condition = 'success' } = req.body;

  if (!dependsOnTaskId) {
    return res.status(400).json({ error: 'ID de la tarea predecesora requerido' });
  }

  const result = addTaskDependency(taskId, dependsOnTaskId, condition);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  logTaskHistory({
    taskId,
    action: 'ADD_DEPENDENCY',
    changedBy: req.user!.username,
    changeSummary: `Añadida dependencia de tarea ${dependsOnTaskId} con condición "${condition}"`,
  });

  return res.status(201).json(result.dependency);
});

// DELETE DEPENDENCY
router.delete('/:id/dependencies/:depId', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
  const depId = Array.isArray(req.params.depId) ? req.params.depId[0] : req.params.depId;
  db.prepare('DELETE FROM task_dependencies WHERE id = ?').run(depId);
  return res.json({ message: 'Dependencia eliminada' });
});

// DUPLICATE TASK (Section 32)
router.post('/:id/duplicate', requireAuth, requireRole(['admin', 'operator']), (req: AuthenticatedRequest, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const original = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!original) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const newName = `Copia de ${original.name}`;

  db.prepare(`
    INSERT INTO tasks (
      id, name, description, category_id, template_id, credential_id,
      target_type, target_group, is_active, state, task_type, command_type, payload,
      schedule_type, schedule_expression, timezone, timeout_seconds, max_retries,
      retry_interval_seconds, retry_backoff, concurrency_limit, concurrency_policy,
      multitarget_error_policy, misfire_policy, misfire_tolerance_minutes,
      on_error, next_run_at, tags, variables, target_params,
      notify_telegram, notify_email, notify_on_success, notify_on_fail,
      created_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, 0, 'DISABLED', ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, NULL, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
  `).run(
    newId,
    newName,
    original.description,
    original.category_id,
    original.template_id,
    original.credential_id,
    original.target_type,
    original.target_group,
    original.task_type,
    original.command_type,
    original.payload,
    original.schedule_type,
    original.schedule_expression,
    original.timezone,
    original.timeout_seconds,
    original.max_retries,
    original.retry_interval_seconds || 60,
    original.retry_backoff || 'fixed',
    original.concurrency_limit || 1,
    original.concurrency_policy || 'block',
    original.multitarget_error_policy || 'continue_others',
    original.misfire_policy || 'run_immediately',
    original.misfire_tolerance_minutes || 15,
    original.on_error,
    original.tags,
    original.variables,
    original.target_params,
    original.notify_telegram,
    original.notify_email,
    original.notify_on_success,
    original.notify_on_fail,
    req.user!.id,
    now,
    now
  );

  // Copy destinations
  const originalDestinations = db.prepare('SELECT destination_id FROM task_destinations WHERE task_id = ?').all(taskId) as { destination_id: string }[];
  const insertDest = db.prepare('INSERT OR IGNORE INTO task_destinations (task_id, destination_id) VALUES (?, ?)');
  for (const d of originalDestinations) {
    insertDest.run(newId, d.destination_id);
  }

  logTaskHistory({
    taskId: newId,
    action: 'DUPLICATE',
    changedBy: req.user!.username,
    changeSummary: `Duplicada desde la tarea original "${original.name}"`,
  });

  const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(newId);
  return res.status(201).json(created);
});

// EXECUTE task manually or DRY RUN (Section 26-28)
router.post('/:id/execute', requireAuth, requireRole(['admin', 'operator']), async (req: AuthenticatedRequest, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const { specificDestinationId, isDryRun } = req.body || {};

  try {
    const executionId = await executeTask(task.id, 'manual', req.user!.username, {
      specificDestinationId,
      isDryRun: Boolean(isDryRun),
    });

    logAudit({
      action: isDryRun ? 'execute_dry_run' : 'execute_manual',
      entity_type: 'task',
      entity_id: task.id,
      entity_name: task.name,
      user_id: req.user?.id,
      username: req.user?.username || 'user',
      details: isDryRun ? 'Ejecución en modo simulación (Dry Run)' : 'Ejecución manual iniciada',
      ip_address: req.ip,
    });

    return res.json({
      message: isDryRun ? 'Simulación (Dry Run) iniciada' : 'Ejecución manual iniciada',
      executionId,
      isDryRun: Boolean(isDryRun),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error al iniciar la ejecución' });
  }
});

// GET executions of a specific task
router.get('/:id/executions', requireAuth, (req, res) => {
  const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const executions = db.prepare(`
    SELECT * FROM executions WHERE task_id = ? ORDER BY started_at DESC LIMIT 50
  `).all(taskId);
  return res.json(executions);
});

export default router;
