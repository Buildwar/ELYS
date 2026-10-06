import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { isSchedulerPaused, setSchedulerPaused } from '../scheduler/index.js';

const router = Router();

// GET Dashboard metrics & control center data
router.get('/dashboard', requireAuth, (req, res) => {
  // Discreet metrics
  const totalTasks = (db.prepare('SELECT COUNT(*) as count FROM tasks WHERE (is_trashed = 0 OR is_trashed IS NULL)').get() as { count: number }).count;
  const activeTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE is_active = 1 AND (is_trashed = 0 OR is_trashed IS NULL) AND state != 'PAUSED'").get() as { count: number }).count;
  const disabledTasks = (db.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_active = 0 AND (is_trashed = 0 OR is_trashed IS NULL)').get() as { count: number }).count;
  const pausedTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE state = 'PAUSED' AND (is_trashed = 0 OR is_trashed IS NULL)").get() as { count: number }).count;
  const trashedTasks = (db.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_trashed = 1').get() as { count: number }).count;
  const totalDestinations = (db.prepare('SELECT COUNT(*) as count FROM destinations WHERE is_active = 1').get() as { count: number }).count;

  const totalExecutions = (db.prepare('SELECT COUNT(*) as count FROM executions').get() as { count: number }).count;
  const successCount = (db.prepare("SELECT COUNT(*) as count FROM executions WHERE status = 'success'").get() as { count: number }).count;
  const failedCount = (db.prepare("SELECT COUNT(*) as count FROM executions WHERE status = 'failed'").get() as { count: number }).count;
  const runningCount = (db.prepare("SELECT COUNT(*) as count FROM executions WHERE status = 'running'").get() as { count: number }).count;

  // Running executions live
  const runningExecutions = db.prepare(`
    SELECT e.*, t.name as current_task_name FROM executions e
    LEFT JOIN tasks t ON e.task_id = t.id
    WHERE e.status = 'running'
    ORDER BY e.started_at DESC
  `).all();

  // Tasks with dependencies count
  const dependenciesCount = (db.prepare('SELECT COUNT(DISTINCT task_id) as count FROM task_dependencies').get() as { count: number }).count;

  // Upcoming executions (ordered chronologically) with destination info
  const upcomingExecutions = db.prepare(`
    SELECT t.id, t.name, t.task_type, t.command_type, t.schedule_type, t.schedule_expression,
      t.next_run_at, t.last_status, c.name as category_name, c.color as category_color,
      (
        SELECT d.name FROM destinations d
        JOIN task_destinations td ON td.destination_id = d.id
        WHERE td.task_id = t.id
        LIMIT 1
      ) as destination_name,
      (
        SELECT d.os_name FROM destinations d
        JOIN task_destinations td ON td.destination_id = d.id
        WHERE td.task_id = t.id
        LIMIT 1
      ) as destination_os,
      (
        SELECT d.system_type FROM destinations d
        JOIN task_destinations td ON td.destination_id = d.id
        WHERE td.task_id = t.id
        LIMIT 1
      ) as destination_system_type
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.is_active = 1 AND t.next_run_at IS NOT NULL
    ORDER BY t.next_run_at ASC
    LIMIT 10
  `).all();

  // Recent executions (last 10) with destination info
  const recentExecutions = db.prepare(`
    SELECT e.*, t.name as current_task_name
    FROM executions e
    LEFT JOIN tasks t ON e.task_id = t.id
    ORDER BY e.started_at DESC
    LIMIT 10
  `).all();

  // Tasks requiring attention (last execution failed)
  const attentionTasks = db.prepare(`
    SELECT t.id, t.name, t.last_status, t.last_run_at, t.last_duration_ms,
      c.name as category_name, c.color as category_color,
      (
        SELECT d.name FROM destinations d
        JOIN task_destinations td ON td.destination_id = d.id
        WHERE td.task_id = t.id
        LIMIT 1
      ) as destination_name
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.last_status = 'failed'
    ORDER BY t.last_run_at DESC
    LIMIT 6
  `).all();

  return res.json({
    metrics: {
      totalTasks,
      activeTasks,
      disabledTasks,
      pausedTasks,
      trashedTasks,
      totalDestinations,
      totalExecutions,
      successCount,
      failedCount,
      runningCount,
      dependenciesCount,
    },
    isSchedulerPaused: isSchedulerPaused(),
    runningExecutions,
    upcomingExecutions,
    recentExecutions,
    attentionTasks,
  });
});

// GET Scheduler status
router.get('/scheduler', requireAuth, (req, res) => {
  const isPaused = isSchedulerPaused();
  const running = (db.prepare("SELECT COUNT(*) as count FROM executions WHERE status = 'running'").get() as { count: number }).count;
  const activeTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE is_active = 1 AND is_trashed = 0 AND state != 'PAUSED'").get() as { count: number }).count;
  return res.json({ isPaused, running, activeTasks });
});

// PAUSE global scheduler (Section 56)
router.post('/scheduler/pause', requireAuth, requireRole(['admin']), (req, res) => {
  setSchedulerPaused(true);
  return res.json({ message: 'Scheduler global pausado. No se iniciarán nuevas ejecuciones automáticas.', isPaused: true });
});

// RESUME global scheduler
router.post('/scheduler/resume', requireAuth, requireRole(['admin']), (req, res) => {
  setSchedulerPaused(false);
  return res.json({ message: 'Scheduler global reanudado.', isPaused: false });
});

// GLOBAL SEARCH (Search across Tasks, Destinations, Categories, Templates, Executions)
router.get('/search', requireAuth, (req, res) => {
  const queryStr = req.query.q ? String(req.query.q).trim() : '';
  if (!queryStr) {
    return res.json({ tasks: [], destinations: [], categories: [], templates: [], executions: [] });
  }

  const term = `%${queryStr}%`;

  const tasks = db.prepare(`
    SELECT t.id, t.name, t.description, t.is_active, t.next_run_at, c.name as category_name
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.name LIKE ? OR t.description LIKE ? OR t.tags LIKE ?
    LIMIT 6
  `).all(term, term, term);

  const destinations = db.prepare(`
    SELECT d.id, d.name, d.hostname, d.ip_address, d.os_name, d.system_type, d.category
    FROM destinations d
    WHERE d.name LIKE ? OR d.hostname LIKE ? OR d.ip_address LIKE ? OR d.os_name LIKE ?
    LIMIT 6
  `).all(term, term, term, term);

  const categories = db.prepare(`
    SELECT c.id, c.name, c.color, c.icon
    FROM categories c
    WHERE c.name LIKE ? OR c.description LIKE ?
    LIMIT 6
  `).all(term, term);

  const templates = db.prepare(`
    SELECT tm.id, tm.name, tm.description, tm.command_type, tm.category
    FROM templates tm
    WHERE tm.name LIKE ? OR tm.description LIKE ?
    LIMIT 6
  `).all(term, term);

  const executions = db.prepare(`
    SELECT e.id, e.task_name, e.destination_name, e.status, e.started_at, e.duration_ms
    FROM executions e
    WHERE e.task_name LIKE ? OR e.destination_name LIKE ? OR e.output LIKE ?
    LIMIT 6
  `).all(term, term, term);

  return res.json({ tasks, destinations, categories, templates, executions });
});

// Health check endpoint for Docker / Portainer
router.get('/health', (req, res) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
});

// GET About info (Official place where Version is provided!)
router.get('/about', (req, res) => {
  let versionInfo = {
    name: 'ELYS',
    version: '1.0.1',
    description: 'Advanced Task Scheduler',
    author: 'Adrián Palma',
    releaseDate: '2026-10-06',
  };

  try {
    const versionPath = path.resolve(process.cwd(), 'version.json');
    if (fs.existsSync(versionPath)) {
      versionInfo = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading version.json:', err);
  }

  return res.json({
    ...versionInfo,
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSeconds: Math.floor(process.uptime()),
    database: 'SQLite (WAL Mode)',
  });
});

export default router;
