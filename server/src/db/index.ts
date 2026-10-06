import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'elys.db');
export const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency & reliability
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'user')),
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#00f0ff',
      icon TEXT NOT NULL DEFAULT 'Folder',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('winrm_password', 'ssh_password', 'ssh_key', 'service_account', 'token')),
      username TEXT NOT NULL,
      secret_encrypted TEXT NOT NULL,
      domain TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS destinations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hostname TEXT NOT NULL,
      ip_address TEXT,
      system_type TEXT NOT NULL CHECK(system_type IN ('windows_server', 'windows_desktop', 'linux', 'bsd', 'other')),
      os_name TEXT NOT NULL,
      os_version TEXT,
      category TEXT NOT NULL DEFAULT 'Servidor',
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      connection_method TEXT NOT NULL CHECK(connection_method IN ('winrm', 'ps_remoting', 'ssh', 'local')),
      credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
      port INTEGER,
      domain TEXT,
      tags TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      system_type TEXT NOT NULL,
      command_type TEXT NOT NULL,
      command_template TEXT NOT NULL,
      default_timeout INTEGER NOT NULL DEFAULT 300,
      tags TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
      credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
      target_type TEXT NOT NULL DEFAULT 'single' CHECK(target_type IN ('single', 'multiple', 'group', 'local')),
      target_group TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      state TEXT NOT NULL DEFAULT 'ACTIVE',
      paused_until TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_trashed INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      concurrency_limit INTEGER NOT NULL DEFAULT 1,
      concurrency_policy TEXT NOT NULL DEFAULT 'block',
      task_type TEXT NOT NULL DEFAULT 'command',
      command_type TEXT NOT NULL DEFAULT 'powershell',
      payload TEXT NOT NULL,
      schedule_type TEXT NOT NULL CHECK(schedule_type IN ('cron', 'interval', 'hourly', 'daily', 'weekly', 'monthly', 'once')),
      schedule_expression TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      timeout_seconds INTEGER NOT NULL DEFAULT 300,
      max_retries INTEGER NOT NULL DEFAULT 0,
      retry_interval_seconds INTEGER NOT NULL DEFAULT 60,
      retry_backoff TEXT NOT NULL DEFAULT 'fixed',
      on_error TEXT NOT NULL DEFAULT 'continue' CHECK(on_error IN ('continue', 'abort', 'retry')),
      multitarget_error_policy TEXT NOT NULL DEFAULT 'abort_on_first',
      target_params TEXT,
      misfire_policy TEXT NOT NULL DEFAULT 'run_immediately',
      misfire_tolerance_minutes INTEGER NOT NULL DEFAULT 15,
      notify_telegram INTEGER NOT NULL DEFAULT 0,
      notify_email INTEGER NOT NULL DEFAULT 0,
      notify_on_success INTEGER NOT NULL DEFAULT 1,
      notify_on_fail INTEGER NOT NULL DEFAULT 1,
      variables TEXT,
      next_run_at TEXT,
      last_run_at TEXT,
      last_status TEXT,
      last_duration_ms INTEGER,
      tags TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_destinations (
      task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      destination_id TEXT REFERENCES destinations(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, destination_id)
    );

    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      task_name TEXT NOT NULL,
      destination_id TEXT REFERENCES destinations(id) ON DELETE SET NULL,
      destination_name TEXT,
      destination_os TEXT,
      execution_method TEXT NOT NULL DEFAULT 'local',
      triggered_by TEXT NOT NULL CHECK(triggered_by IN ('scheduler', 'manual')),
      triggered_by_user TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
      started_at TEXT NOT NULL,
      finished_at TEXT,
      duration_ms INTEGER,
      exit_code INTEGER,
      output TEXT,
      error_output TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      entity_name TEXT,
      user_id TEXT,
      username TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      event TEXT NOT NULL,
      recipient TEXT NOT NULL,
      status TEXT NOT NULL,
      subject TEXT,
      content TEXT,
      error_details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      condition TEXT NOT NULL DEFAULT 'success' CHECK(condition IN ('success', 'failed', 'completed')),
      created_at TEXT NOT NULL,
      UNIQUE(task_id, depends_on_task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON task_dependencies(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON task_dependencies(depends_on_task_id);

    CREATE TABLE IF NOT EXISTS task_locks (
      task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
      execution_id TEXT NOT NULL,
      locked_at TEXT NOT NULL,
      locked_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS execution_logs (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'INFO' CHECK(level IN ('INFO', 'WARN', 'ERROR', 'DEBUG', 'SYSTEM')),
      message TEXT NOT NULL,
      details TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_exec_logs_exec_id ON execution_logs(execution_id);

    CREATE TABLE IF NOT EXISTS task_history (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      change_summary TEXT NOT NULL,
      diff TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_hist_task_id ON task_history(task_id);

  `);

  // Migrate existing tables safely if columns don't exist
  safeMigrations();

  // High-performance query indexes (executed after safeMigrations to ensure all columns exist)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_next_run ON tasks(next_run_at, is_active, is_trashed);
    CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
    CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
    CREATE INDEX IF NOT EXISTS idx_executions_task_id ON executions(task_id);
    CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
    CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_task_destinations_dest_id ON task_destinations(destination_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
  `);
}

export function logAudit(params: {
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  user_id?: string;
  username: string;
  details?: string;
  ip_address?: string;
}) {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, action, entity_type, entity_id, entity_name, user_id, username, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.action,
      params.entity_type,
      params.entity_id || null,
      params.entity_name || null,
      params.user_id || null,
      params.username,
      params.details || null,
      params.ip_address || null,
      now
    );
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

export function logNotificationDelivery(params: {
  channel: 'telegram' | 'email';
  event: string;
  recipient: string;
  status: 'SUCCESS' | 'FAILED';
  subject?: string;
  content?: string;
  error_details?: string;
}) {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notification_deliveries (id, channel, event, recipient, status, subject, content, error_details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.channel,
      params.event,
      params.recipient,
      params.status,
      params.subject || null,
      params.content || null,
      params.error_details || null,
      now
    );
  } catch (err) {
    console.error('Failed to log notification delivery:', err);
  }
}

export function logTaskHistory(params: {
  taskId: string;
  action: string;
  changedBy: string;
  changeSummary: string;
  diff?: any;
}) {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO task_history (id, task_id, action, changed_by, change_summary, diff, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.taskId,
      params.action,
      params.changedBy,
      params.changeSummary,
      params.diff ? (typeof params.diff === 'string' ? params.diff : JSON.stringify(params.diff)) : null,
      now
    );
  } catch (err) {
    console.error('Failed to log task history:', err);
  }
}

export function addExecutionLog(
  executionId: string,
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SYSTEM',
  message: string,
  details?: string
) {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO execution_logs (id, execution_id, timestamp, level, message, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, executionId, now, level, message, details || null);
  } catch (err) {
    console.error('Failed to insert execution log:', err);
  }
}

export function getExecutionLogs(executionId: string) {
  return db.prepare(`
    SELECT * FROM execution_logs WHERE execution_id = ? ORDER BY timestamp ASC
  `).all(executionId) as any[];
}

export function acquireTaskLock(taskId: string, executionId: string, lockedBy: string): boolean {
  try {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO task_locks (task_id, execution_id, locked_at, locked_by)
      VALUES (?, ?, ?, ?)
    `).run(taskId, executionId, now, lockedBy);
    return true;
  } catch {
    return false;
  }
}

export function releaseTaskLock(taskId: string, executionId?: string) {
  try {
    if (executionId) {
      db.prepare('DELETE FROM task_locks WHERE task_id = ? AND execution_id = ?').run(taskId, executionId);
    } else {
      db.prepare('DELETE FROM task_locks WHERE task_id = ?').run(taskId);
    }
  } catch (err) {
    console.error('Failed to release task lock:', err);
  }
}

export function isTaskLocked(taskId: string): boolean {
  const row = db.prepare('SELECT execution_id FROM task_locks WHERE task_id = ?').get(taskId);
  return !!row;
}

export function cleanupOrphanedLocks() {
  try {
    // Delete locks where execution is not running
    db.prepare(`
      DELETE FROM task_locks
      WHERE execution_id NOT IN (SELECT id FROM executions WHERE status = 'running')
    `).run();
  } catch (err) {
    console.error('Failed to cleanup orphaned locks:', err);
  }
}

function safeMigrations() {
  const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  const userColNames = new Set(userCols.map((c) => c.name));
  if (!userColNames.has('must_change_password')) {
    db.prepare('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0').run();
  }

  const taskCols = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[];
  const taskColNames = new Set(taskCols.map((c) => c.name));

  if (!taskColNames.has('template_id')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN template_id TEXT REFERENCES templates(id) ON DELETE SET NULL').run();
  }
  if (!taskColNames.has('credential_id')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL').run();
  }
  if (!taskColNames.has('target_type')) {
    db.prepare("ALTER TABLE tasks ADD COLUMN target_type TEXT NOT NULL DEFAULT 'single'").run();
  }
  if (!taskColNames.has('target_group')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN target_group TEXT').run();
  }
  if (!taskColNames.has('command_type')) {
    db.prepare("ALTER TABLE tasks ADD COLUMN command_type TEXT NOT NULL DEFAULT 'powershell'").run();
  }
  if (!taskColNames.has('on_error')) {
    db.prepare("ALTER TABLE tasks ADD COLUMN on_error TEXT NOT NULL DEFAULT 'continue'").run();
  }
  if (!taskColNames.has('notify_telegram')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN notify_telegram INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!taskColNames.has('notify_email')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!taskColNames.has('notify_on_success')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN notify_on_success INTEGER NOT NULL DEFAULT 1').run();
  }
  if (!taskColNames.has('notify_on_fail')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN notify_on_fail INTEGER NOT NULL DEFAULT 1').run();
  }
  if (!taskColNames.has('state')) {
    db.prepare("ALTER TABLE tasks ADD COLUMN state TEXT NOT NULL DEFAULT 'ACTIVE'").run();
  }
  if (!taskColNames.has('paused_until')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN paused_until TEXT').run();
  }
  if (!taskColNames.has('is_favorite')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!taskColNames.has('is_trashed')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN is_trashed INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!taskColNames.has('deleted_at')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN deleted_at TEXT').run();
  }
  if (!taskColNames.has('concurrency_limit')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN concurrency_limit INTEGER NOT NULL DEFAULT 1').run();
  }
  if (!taskColNames.has('concurrency_policy')) {
    db.prepare("ALTER TABLE tasks ADD COLUMN concurrency_policy TEXT NOT NULL DEFAULT 'block'").run();
  }
  if (!taskColNames.has('retry_interval_seconds')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN retry_interval_seconds INTEGER NOT NULL DEFAULT 60').run();
  }
  if (!taskColNames.has('retry_backoff')) {
    db.prepare("ALTER TABLE tasks ADD COLUMN retry_backoff TEXT NOT NULL DEFAULT 'fixed'").run();
  }
  if (!taskColNames.has('multitarget_error_policy')) {
    db.prepare("ALTER TABLE tasks ADD COLUMN multitarget_error_policy TEXT NOT NULL DEFAULT 'continue_others'").run();
  }
  if (!taskColNames.has('misfire_policy')) {
    db.prepare("ALTER TABLE tasks ADD COLUMN misfire_policy TEXT NOT NULL DEFAULT 'run_immediately'").run();
  }
  if (!taskColNames.has('misfire_tolerance_minutes')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN misfire_tolerance_minutes INTEGER NOT NULL DEFAULT 15').run();
  }
  if (!taskColNames.has('variables')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN variables TEXT').run();
  }
  if (!taskColNames.has('target_params')) {
    db.prepare('ALTER TABLE tasks ADD COLUMN target_params TEXT').run();
  }

  const execCols = db.prepare('PRAGMA table_info(executions)').all() as { name: string }[];
  const execColNames = new Set(execCols.map((c) => c.name));

  if (!execColNames.has('destination_id')) {
    db.prepare('ALTER TABLE executions ADD COLUMN destination_id TEXT REFERENCES destinations(id) ON DELETE SET NULL').run();
  }
  if (!execColNames.has('destination_name')) {
    db.prepare('ALTER TABLE executions ADD COLUMN destination_name TEXT').run();
  }
  if (!execColNames.has('destination_os')) {
    db.prepare('ALTER TABLE executions ADD COLUMN destination_os TEXT').run();
  }
  if (!execColNames.has('execution_method')) {
    db.prepare("ALTER TABLE executions ADD COLUMN execution_method TEXT NOT NULL DEFAULT 'local'").run();
  }
  if (!execColNames.has('is_dry_run')) {
    db.prepare('ALTER TABLE executions ADD COLUMN is_dry_run INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!execColNames.has('retry_count')) {
    db.prepare('ALTER TABLE executions ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!execColNames.has('max_retries')) {
    db.prepare('ALTER TABLE executions ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!execColNames.has('error_type')) {
    db.prepare('ALTER TABLE executions ADD COLUMN error_type TEXT').run();
  }
  if (!execColNames.has('command_resolved')) {
    db.prepare('ALTER TABLE executions ADD COLUMN command_resolved TEXT').run();
  }
  if (!execColNames.has('group_execution_id')) {
    db.prepare('ALTER TABLE executions ADD COLUMN group_execution_id TEXT').run();
  }
  if (!execColNames.has('cancelled_by')) {
    db.prepare('ALTER TABLE executions ADD COLUMN cancelled_by TEXT').run();
  }
  if (!execColNames.has('cancelled_at')) {
    db.prepare('ALTER TABLE executions ADD COLUMN cancelled_at TEXT').run();
  }
  if (!execColNames.has('cancellation_reason')) {
    db.prepare('ALTER TABLE executions ADD COLUMN cancellation_reason TEXT').run();
  }

  // Normalize destination categories to match their system_type if destinations exist
  db.prepare(`UPDATE destinations SET category = 'Windows Server' WHERE system_type = 'windows_server'`).run();
  db.prepare(`UPDATE destinations SET category = 'Windows Desktop' WHERE system_type = 'windows_desktop'`).run();
  db.prepare(`UPDATE destinations SET category = 'Linux' WHERE system_type = 'linux'`).run();
  db.prepare(`UPDATE destinations SET category = 'BSD' WHERE system_type = 'bsd'`).run();
  db.prepare(`UPDATE destinations SET category = 'Otros' WHERE system_type = 'other'`).run();
}
