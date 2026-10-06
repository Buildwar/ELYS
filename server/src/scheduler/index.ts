import { CronExpressionParser } from 'cron-parser';
import crypto from 'crypto';
import {
  db,
  addExecutionLog,
  acquireTaskLock,
  releaseTaskLock,
  isTaskLocked,
  cleanupOrphanedLocks,
} from '../db/index.js';
import { sendGroupedExecutionSummary } from '../notifications/index.js';
import { resolveVariables, maskSecretsInText } from './variables.js';
import {
  getExecutionProvider,
  cancelActiveProcess,
  ExecutionContext,
} from './providers/index.js';
import {
  getTaskDependents,
  areTaskDependenciesSatisfied,
} from './dependencies.js';

export function calculateNextRun(
  scheduleType: string,
  scheduleExpression: string,
  timezone: string = 'UTC',
  fromDate: Date = new Date()
): Date | null {
  try {
    switch (scheduleType) {
      case 'cron': {
        const interval = CronExpressionParser.parse(scheduleExpression, {
          currentDate: fromDate,
          tz: timezone,
        });
        return interval.next().toDate();
      }

      case 'interval': {
        const match = scheduleExpression.trim().match(/^(\d+)\s*([smhd])$/i);
        if (!match) return null;
        const val = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        let ms = 0;
        if (unit === 's') ms = val * 1000;
        else if (unit === 'm') ms = val * 60 * 1000;
        else if (unit === 'h') ms = val * 3600 * 1000;
        else if (unit === 'd') ms = val * 86400 * 1000;
        return new Date(fromDate.getTime() + ms);
      }

      case 'hourly': {
        const minute = parseInt(scheduleExpression, 10) || 0;
        const next = new Date(fromDate.getTime());
        next.setMinutes(minute, 0, 0);
        if (next <= fromDate) {
          next.setHours(next.getHours() + 1);
        }
        return next;
      }

      case 'daily': {
        const [h, m] = scheduleExpression.split(':').map(Number);
        const next = new Date(fromDate.getTime());
        next.setHours(h || 0, m || 0, 0, 0);
        if (next <= fromDate) {
          next.setDate(next.getDate() + 1);
        }
        return next;
      }

      case 'weekly': {
        const [targetDayStr, timeStr] = scheduleExpression.split(',');
        const targetDay = parseInt(targetDayStr, 10) || 1;
        const [h, m] = (timeStr || '00:00').split(':').map(Number);

        const next = new Date(fromDate.getTime());
        next.setHours(h || 0, m || 0, 0, 0);
        const currentDay = next.getDay();
        let dayDiff = targetDay - currentDay;
        if (dayDiff < 0 || (dayDiff === 0 && next <= fromDate)) {
          dayDiff += 7;
        }
        next.setDate(next.getDate() + dayDiff);
        return next;
      }

      case 'monthly': {
        const [targetDayStr, timeStr] = scheduleExpression.split(',');
        const targetDay = parseInt(targetDayStr, 10) || 1;
        const [h, m] = (timeStr || '00:00').split(':').map(Number);

        const next = new Date(fromDate.getTime());
        next.setDate(targetDay);
        next.setHours(h || 0, m || 0, 0, 0);
        if (next <= fromDate) {
          next.setMonth(next.getMonth() + 1);
          next.setDate(targetDay);
        }
        return next;
      }

      case 'once': {
        const target = new Date(scheduleExpression);
        if (isNaN(target.getTime()) || target <= fromDate) {
          return null;
        }
        return target;
      }

      default:
        return null;
    }
  } catch (err) {
    console.error('Error calculating next run:', err);
    return null;
  }
}

export interface ExecuteTaskOptions {
  specificDestinationId?: string;
  isDryRun?: boolean;
  retryCount?: number;
  groupExecutionId?: string;
  predecessorTaskId?: string;
}

export async function executeTask(
  taskId: string,
  triggeredBy: 'scheduler' | 'manual',
  username?: string,
  options: ExecuteTaskOptions = {}
): Promise<string> {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    throw new Error(`Tarea ${taskId} no encontrada`);
  }

  // Check if task is trashed
  if (task.is_trashed === 1) {
    throw new Error(`La tarea "${task.name}" está en la papelera y no puede ejecutarse.`);
  }

  // Check if task is paused
  if (task.state === 'PAUSED' && triggeredBy === 'scheduler') {
    if (task.paused_until) {
      const untilDate = new Date(task.paused_until);
      if (new Date() < untilDate) {
        console.log(`[ELYS SCHEDULER] Tarea "${task.name}" en pausa hasta ${task.paused_until}. Omitiendo.`);
        return '';
      } else {
        // Pause expired, reactivate
        db.prepare("UPDATE tasks SET state = 'ACTIVE', paused_until = NULL WHERE id = ?").run(task.id);
      }
    } else {
      console.log(`[ELYS SCHEDULER] Tarea "${task.name}" pausada indefinidamente. Omitiendo.`);
      return '';
    }
  }

  // Concurrency Check & Policy Enforcement
  const runningExecutions = db.prepare(`
    SELECT id FROM executions WHERE task_id = ? AND status = 'running'
  `).all(task.id) as { id: string }[];

  const concurrencyLimit = task.concurrency_limit || 1;
  const concurrencyPolicy = task.concurrency_policy || 'block';

  if (runningExecutions.length >= concurrencyLimit) {
    if (concurrencyPolicy === 'block') {
      console.log(`[CONCURRENCY] Tarea "${task.name}" alcanzó el límite de concurrencia (${concurrencyLimit}). Ejecución bloqueada.`);
      return '';
    } else if (concurrencyPolicy === 'replace') {
      console.log(`[CONCURRENCY] Política "replace": Cancelando ${runningExecutions.length} ejecuciones anteriores de "${task.name}"`);
      for (const rx of runningExecutions) {
        cancelExecution(rx.id, username || 'system', 'Cancelada por política de reemplazo de concurrencia');
      }
    } else if (concurrencyPolicy === 'queue') {
      console.log(`[CONCURRENCY] Política "queue": Encolando tarea "${task.name}" para posterior ejecución.`);
      // Insert as pending
      const queuedId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO executions (
          id, task_id, task_name, execution_method, triggered_by, triggered_by_user, status, started_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(queuedId, task.id, task.name, 'local', triggeredBy, username || null, new Date().toISOString());
      return queuedId;
    }
  }

  // Fetch destinations to execute on
  let targetDestinations: any[] = [];
  if (options.specificDestinationId) {
    const dest = db.prepare('SELECT * FROM destinations WHERE id = ?').get(options.specificDestinationId) as any;
    if (dest) targetDestinations.push(dest);
  } else if (task.target_type === 'multiple' || task.target_type === 'single') {
    targetDestinations = db.prepare(`
      SELECT d.* FROM destinations d
      JOIN task_destinations td ON td.destination_id = d.id
      WHERE td.task_id = ? AND d.is_active = 1
    `).all(task.id) as any[];
  } else if (task.target_type === 'group' && task.target_group) {
    targetDestinations = db.prepare(`
      SELECT * FROM destinations WHERE category = ? AND is_active = 1
    `).all(task.target_group) as any[];
  }

  // If no destination assigned, run locally
  if (targetDestinations.length === 0) {
    targetDestinations = [{ id: null, name: 'Local (ELYS)', os_name: 'Local Host', connection_method: 'local' }];
  }

  const groupExecutionId = options.groupExecutionId || crypto.randomUUID();
  const isDryRun = Boolean(options.isDryRun);
  const mainExecutionId = crypto.randomUUID();

  // Execute targets sequentially or according to multitarget policy
  (async () => {
    acquireTaskLock(task.id, mainExecutionId, username || 'system');

    // Advance next_run_at immediately to guarantee idempotency and prevent duplicate executions
    let immediateNextRun: string | null = null;
    if (task.schedule_type !== 'once') {
      const nextDate = calculateNextRun(task.schedule_type, task.schedule_expression, task.timezone, new Date());
      immediateNextRun = nextDate ? nextDate.toISOString() : null;
    }

    db.prepare("UPDATE tasks SET state = 'RUNNING', last_status = 'running', last_run_at = ?, next_run_at = ? WHERE id = ?")
      .run(new Date().toISOString(), immediateNextRun, task.id);

    const summaryResults: {
      destination_name: string;
      os_name: string;
      status: 'success' | 'failed';
      duration_ms: number;
      error_details?: string;
    }[] = [];

    let overallSuccess = true;
    const overallStartTime = Date.now();

    for (const dest of targetDestinations) {
      const destExecId = targetDestinations.length === 1 ? mainExecutionId : crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const startTime = Date.now();

      // Look up credential if bound
      let credential = null;
      const credId = dest.credential_id || task.credential_id;
      if (credId) {
        credential = db.prepare('SELECT id, name, type, username FROM credentials WHERE id = ?').get(credId) as any;
      }

      // Initial execution record
      db.prepare(`
        INSERT INTO executions (
          id, task_id, task_name, destination_id, destination_name, destination_os,
          execution_method, triggered_by, triggered_by_user, status, started_at,
          is_dry_run, retry_count, max_retries, group_execution_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?)
      `).run(
        destExecId,
        task.id,
        task.name,
        dest.id,
        dest.name,
        dest.os_name || 'Desconocido',
        dest.connection_method || 'local',
        triggeredBy,
        username || null,
        startedAt,
        isDryRun ? 1 : 0,
        options.retryCount || 0,
        task.max_retries || 0,
        groupExecutionId
      );

      // Parse payload and resolve variables
      let payloadObj: any = {};
      try {
        payloadObj = JSON.parse(task.payload);
      } catch {
        payloadObj = { command: task.payload };
      }

      const varCtx = {
        task: { id: task.id, name: task.name, variables: task.variables, target_params: task.target_params },
        destination: dest,
        executionId: destExecId,
        username,
      };

      let commandToResolve = payloadObj.command || payloadObj.url || payloadObj.script || '';
      const { resolved, secrets, resolvedMap } = resolveVariables(commandToResolve, varCtx);

      if (payloadObj.command) payloadObj.command = resolved;
      if (payloadObj.url) payloadObj.url = resolved;
      if (payloadObj.script) payloadObj.script = resolved;

      const provider = getExecutionProvider(dest.connection_method, task.task_type);

      const execCtx: ExecutionContext = {
        executionId: destExecId,
        taskId: task.id,
        taskName: task.name,
        isDryRun,
        destination: dest,
        credential,
        variables: resolvedMap,
        secrets,
        timeoutSeconds: task.timeout_seconds || 300,
      };

      addExecutionLog(destExecId, 'SYSTEM', `Iniciando ejecutor "${provider.name}" sobre ${dest.name}`);
      const result = await provider.execute(execCtx, payloadObj);

      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      // Mask sensitive secrets in stdout, stderr, and resolved command
      const cleanOutput = maskSecretsInText(result.output, secrets);
      const cleanErrorOutput = maskSecretsInText(result.errorOutput, secrets);
      const cleanCommandResolved = maskSecretsInText(result.commandResolved || resolved, secrets);

      db.prepare(`
        UPDATE executions
        SET status = ?, finished_at = ?, duration_ms = ?, exit_code = ?,
            output = ?, error_output = ?, error_type = ?, command_resolved = ?
        WHERE id = ?
      `).run(
        result.status,
        finishedAt,
        durationMs,
        result.exitCode,
        cleanOutput.trim(),
        cleanErrorOutput.trim(),
        result.errorType || null,
        cleanCommandResolved,
        destExecId
      );

      if (dest.id) {
        db.prepare('UPDATE destinations SET last_used_at = ? WHERE id = ?').run(finishedAt, dest.id);
      }

      summaryResults.push({
        destination_name: dest.name,
        os_name: dest.os_name || 'Desconocido',
        status: result.status === 'success' ? 'success' : 'failed',
        duration_ms: durationMs,
        error_details: cleanErrorOutput ? cleanErrorOutput.slice(0, 300) : undefined,
      });

      if (result.status !== 'success') {
        overallSuccess = false;
        // Check retry policy if eligible
        const currentRetries = options.retryCount || 0;
        const maxRetries = task.max_retries || 0;

        if (currentRetries < maxRetries && !isDryRun && result.status !== 'cancelled') {
          const backoff = task.retry_backoff || 'fixed';
          const intervalSec = task.retry_interval_seconds || 60;
          const delaySec = backoff === 'progressive' ? intervalSec * (currentRetries + 1) : intervalSec;

          addExecutionLog(
            destExecId,
            'WARN',
            `Programando reintento ${currentRetries + 1}/${maxRetries} en ${delaySec} segundos...`
          );

          setTimeout(() => {
            executeTask(task.id, 'scheduler', username, {
              specificDestinationId: dest.id,
              retryCount: currentRetries + 1,
              groupExecutionId,
            }).catch(console.error);
          }, delaySec * 1000);
        }

        // Multitarget policy
        if (task.multitarget_error_policy === 'stop_all' && targetDestinations.length > 1) {
          addExecutionLog(
            destExecId,
            'WARN',
            'Política de error "Detener todos": Interrumpiendo ejecución en los destinos restantes.'
          );
          break;
        }
      }
    }

    releaseTaskLock(task.id, mainExecutionId);
    const finalOverallStatus = overallSuccess ? 'success' : 'failed';
    const totalDuration = Date.now() - overallStartTime;

    // Update task state and schedule next run
    let nextRun: Date | null = null;
    if (task.schedule_type === 'once') {
      db.prepare(`
        UPDATE tasks
        SET state = 'DISABLED', is_active = 0, next_run_at = NULL, last_status = ?, last_duration_ms = ?, last_run_at = ?
        WHERE id = ?
      `).run(finalOverallStatus, totalDuration, new Date().toISOString(), task.id);
    } else {
      nextRun = calculateNextRun(task.schedule_type, task.schedule_expression, task.timezone, new Date());
      db.prepare(`
        UPDATE tasks
        SET state = 'ACTIVE', next_run_at = ?, last_status = ?, last_duration_ms = ?, last_run_at = ?
        WHERE id = ?
      `).run(nextRun ? nextRun.toISOString() : null, finalOverallStatus, totalDuration, new Date().toISOString(), task.id);
    }

    // Consolidated Telegram & Email notification
    sendGroupedExecutionSummary({
      task_name: task.name,
      triggered_by: triggeredBy,
      results: summaryResults,
      started_at: new Date(overallStartTime).toISOString(),
      total_duration_ms: totalDuration,
      taskOverride: {
        notify_telegram: task.notify_telegram,
        notify_email: task.notify_email,
        notify_on_success: task.notify_on_success,
        notify_on_fail: task.notify_on_fail,
      },
    }).catch((notifErr) => {
      console.error('[NOTIFICATIONS] Error sending execution summary:', notifErr);
    });

    // Dependency Chaining Engine
    const downstream = getTaskDependents(task.id);
    for (const dep of downstream) {
      const depEval = areTaskDependenciesSatisfied(dep.task_id, task.id, finalOverallStatus);
      if (depEval.satisfied) {
        console.log(`[DEPENDENCIES] Condición cumplida para tarea dependiente "${dep.task_name}". Disparando ejecución.`);
        executeTask(dep.task_id, 'scheduler', 'dependency-chain').catch(console.error);
      } else {
        console.log(`[DEPENDENCIES] Tarea "${dep.task_name}" omitida. Motivo: ${depEval.skippedReason}`);
        // Create an audit execution record marking it SKIPPED
        const skipExecId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO executions (
            id, task_id, task_name, execution_method, triggered_by, triggered_by_user,
            status, started_at, finished_at, duration_ms, exit_code, output, error_output
          ) VALUES (?, ?, ?, 'local', 'scheduler', 'dependency-engine', 'cancelled', ?, ?, 0, 0, '', ?)
        `).run(
          skipExecId,
          dep.task_id,
          dep.task_name || 'Tarea Dependiente',
          new Date().toISOString(),
          new Date().toISOString(),
          `[SKIPPED / OMITIDA] ${depEval.skippedReason}`
        );
      }
    }
  })();

  return mainExecutionId;
}

export function cancelExecution(executionId: string, username?: string, reason?: string): boolean {
  const cancelled = cancelActiveProcess(executionId);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE executions
    SET status = 'cancelled', finished_at = ?, cancelled_by = ?, cancelled_at = ?, cancellation_reason = ?,
        error_output = error_output || '\nCancelado manualmente por ' || ?
    WHERE id = ?
  `).run(now, username || 'usuario', now, reason || 'Cancelación manual', username || 'usuario', executionId);

  addExecutionLog(executionId, 'WARN', `Ejecución cancelada por ${username || 'usuario'}. Motivo: ${reason || 'Manual'}`);
  return cancelled;
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function isSchedulerPaused(): boolean {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'scheduler_paused'").get() as any;
  return row ? row.value === 'true' : false;
}

export function setSchedulerPaused(paused: boolean): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES ('scheduler_paused', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(paused ? 'true' : 'false', now);
}

export function startScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);

  cleanupOrphanedLocks();
  console.log('[ELYS SCHEDULER] Motor avanzado de tareas iniciado. Verificando programaciones cada 5s...');

  schedulerTimer = setInterval(() => {
    try {
      if (isSchedulerPaused()) {
        return; // Global scheduler is paused
      }

      const now = new Date();
      const nowIso = now.toISOString();

      const dueTasks = db.prepare(`
        SELECT * FROM tasks
        WHERE is_active = 1
          AND is_trashed = 0
          AND state != 'PAUSED'
          AND next_run_at IS NOT NULL
          AND next_run_at <= ?
      `).all(nowIso) as any[];

      for (const task of dueTasks) {
        // Misfire Policy Handling
        const nextRunTime = new Date(task.next_run_at).getTime();
        const diffMinutes = (now.getTime() - nextRunTime) / (1000 * 60);

        if (diffMinutes > 5) {
          // Task misfired due to downtime
          const misfirePolicy = task.misfire_policy || 'run_immediately';
          const tolerance = task.misfire_tolerance_minutes || 15;

          if (misfirePolicy === 'skip') {
            console.log(`[MISFIRE] Tarea "${task.name}" omitida por política "skip" (${Math.round(diffMinutes)}m de retraso).`);
            const nextRun = calculateNextRun(task.schedule_type, task.schedule_expression, task.timezone, now);
            db.prepare('UPDATE tasks SET next_run_at = ? WHERE id = ?').run(nextRun ? nextRun.toISOString() : null, task.id);
            continue;
          } else if (misfirePolicy === 'tolerance_window' && diffMinutes > tolerance) {
            console.log(`[MISFIRE] Tarea "${task.name}" omitida: fuera de la ventana de tolerancia (${Math.round(diffMinutes)}m > ${tolerance}m).`);
            const nextRun = calculateNextRun(task.schedule_type, task.schedule_expression, task.timezone, now);
            db.prepare('UPDATE tasks SET next_run_at = ? WHERE id = ?').run(nextRun ? nextRun.toISOString() : null, task.id);
            continue;
          }
        }

        // Concurrency lock check
        if (isTaskLocked(task.id)) {
          if (task.concurrency_policy === 'block') {
            continue;
          }
        }

        console.log(`[ELYS SCHEDULER] Lanzando tarea programada: "${task.name}" (${task.id})`);
        executeTask(task.id, 'scheduler').catch((err) => {
          console.error(`[ELYS SCHEDULER] Error ejecutando tarea ${task.id}:`, err);
        });
      }
    } catch (err) {
      console.error('[ELYS SCHEDULER] Error en ciclo del scheduler:', err);
    }
  }, 5000);
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
