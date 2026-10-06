import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, logAudit } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Only Admin can perform backups and restores
router.use(requireAuth, requireRole(['admin']));

const BACKUP_DIR = path.resolve(process.env.DATA_DIR || './data', 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

// Generate backup data structure
function generateBackupData(createdBy: string, type: 'full' | 'auto_safety' = 'full') {
  const users = db.prepare('SELECT id, username, email, password_hash, role, is_active, created_at, updated_at FROM users').all();
  const destinations = db.prepare('SELECT * FROM destinations').all();
  const credentials = db.prepare('SELECT * FROM credentials').all();
  const categories = db.prepare('SELECT * FROM categories').all();
  const templates = db.prepare('SELECT * FROM templates').all();
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const task_destinations = db.prepare('SELECT * FROM task_destinations').all();
  const task_dependencies = db.prepare('SELECT * FROM task_dependencies').all();
  const settings = db.prepare('SELECT * FROM settings').all();

  const id = `backup_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  return {
    id,
    format: 'ELYS_BACKUP',
    version: 1,
    elys_version: '1.0.0',
    created_at: now,
    created_by: createdBy,
    type,
    summary: {
      users_count: users.length,
      destinations_count: destinations.length,
      credentials_count: credentials.length,
      categories_count: categories.length,
      templates_count: templates.length,
      tasks_count: tasks.length,
      dependencies_count: task_dependencies.length,
      settings_count: settings.length,
    },
    data: {
      users,
      destinations,
      credentials,
      categories,
      templates,
      tasks,
      task_destinations,
      task_dependencies,
      settings,
    },
  };
}

// GET list of available backups
router.get(['/', '/list'], (req, res) => {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json') || f.endsWith('.elysbak'));

  const backups = files.map((filename) => {
    try {
      const filePath = path.join(BACKUP_DIR, filename);
      const stats = fs.statSync(filePath);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      return {
        id: content.id || path.basename(filename, path.extname(filename)),
        filename,
        version: content.version,
        elys_version: content.elys_version,
        created_at: content.created_at || stats.mtime.toISOString(),
        created_by: content.created_by || 'system',
        type: content.type || 'full',
        size_bytes: stats.size,
        summary: content.summary || {},
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  backups.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return res.json(backups);
});

// CREATE a new backup
router.post(['/', '/create'], (req: AuthenticatedRequest, res) => {
  ensureBackupDir();
  const backup = generateBackupData(req.user?.username || 'admin', 'full');
  const filename = `${backup.id}.elysbak`;
  const filePath = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf-8');

  logAudit({
    action: 'create',
    entity_type: 'backup',
    entity_id: backup.id,
    entity_name: filename,
    user_id: req.user?.id,
    username: req.user?.username || 'admin',
    details: `Backup manual creado (${backup.summary.tasks_count} tareas, ${backup.summary.destinations_count} destinos)`,
    ip_address: req.ip,
  });

  return res.status(201).json({
    message: 'Backup creado exitosamente',
    backup: {
      id: backup.id,
      filename,
      version: backup.version,
      elys_version: backup.elys_version,
      created_at: backup.created_at,
      created_by: backup.created_by,
      summary: backup.summary,
    },
  });
});

// DOWNLOAD backup file
router.get('/download/:filename', (req, res) => {
  ensureBackupDir();
  const rawFilename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const filename = path.basename(String(rawFilename || ''));
  const filePath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo de backup no encontrado' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  return res.sendFile(filePath);
});

// VALIDATE uploaded backup file contents
router.post('/validate', (req, res) => {
  const { backupContent } = req.body;
  if (!backupContent) {
    return res.status(400).json({ error: 'Contenido del archivo no proporcionado' });
  }

  let parsed: any;
  try {
    parsed = typeof backupContent === 'string' ? JSON.parse(backupContent) : backupContent;
  } catch {
    return res.status(400).json({ error: 'Formato de archivo inválido. Debe ser un archivo JSON válido.' });
  }

  if (parsed.format !== 'ELYS_BACKUP' || !parsed.version || !parsed.data) {
    return res.status(400).json({
      error: 'Estructura de backup incompatible o no reconocida como copia de seguridad de ELYS.',
    });
  }

  return res.json({
    valid: true,
    version: parsed.version,
    elys_version: parsed.elys_version,
    created_at: parsed.created_at,
    created_by: parsed.created_by,
    type: parsed.type,
    summary: parsed.summary || {
      users_count: parsed.data.users?.length || 0,
      tasks_count: parsed.data.tasks?.length || 0,
      destinations_count: parsed.data.destinations?.length || 0,
      credentials_count: parsed.data.credentials?.length || 0,
      templates_count: parsed.data.templates?.length || 0,
    },
  });
});

// RESTORE backup (Full or Selective with automatic pre-restore safety backup)
router.post('/restore', (req: AuthenticatedRequest, res) => {
  const { backupId, backupContent, mode = 'full', sections = [] } = req.body;

  let backupToRestore: any;

  if (backupContent) {
    try {
      backupToRestore = typeof backupContent === 'string' ? JSON.parse(backupContent) : backupContent;
    } catch {
      return res.status(400).json({ error: 'Archivo de backup ilegible' });
    }
  } else if (backupId) {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR);
    const targetFile = files.find((f) => f.includes(backupId));
    if (!targetFile) {
      return res.status(404).json({ error: 'Backup no encontrado' });
    }
    backupToRestore = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, targetFile), 'utf-8'));
  } else {
    return res.status(400).json({ error: 'Debe especificar el backup a restaurar' });
  }

  if (backupToRestore.format !== 'ELYS_BACKUP' || !backupToRestore.data) {
    return res.status(400).json({ error: 'Estructura de backup inválida' });
  }

  // 1. RESTORE SEGURO: Generar backup automático de seguridad antes de proceder
  ensureBackupDir();
  const safetyBackup = generateBackupData('system_auto_safety', 'auto_safety');
  const safetyFilename = `SAFETY_PRE_RESTORE_${Date.now()}.elysbak`;
  fs.writeFileSync(path.join(BACKUP_DIR, safetyFilename), JSON.stringify(safetyBackup, null, 2), 'utf-8');

  // 2. Ejecutar restauración dentro de una transacción
  const restoreAll = mode === 'full';
  const data = backupToRestore.data;

  try {
    const transaction = db.transaction(() => {
      // Users
      if (restoreAll || sections.includes('users')) {
        if (Array.isArray(data.users)) {
          for (const u of data.users) {
            db.prepare(`
              INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                email = excluded.email,
                password_hash = excluded.password_hash,
                role = excluded.role,
                is_active = excluded.is_active,
                updated_at = excluded.updated_at
            `).run(u.id, u.username, u.email, u.password_hash, u.role, u.is_active, u.created_at, u.updated_at);
          }
        }
      }

      // Credentials
      if (restoreAll || sections.includes('credentials')) {
        if (Array.isArray(data.credentials)) {
          for (const c of data.credentials) {
            db.prepare(`
              INSERT INTO credentials (id, name, type, username, secret_encrypted, domain, description, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                username = excluded.username,
                secret_encrypted = excluded.secret_encrypted,
                domain = excluded.domain,
                description = excluded.description,
                updated_at = excluded.updated_at
            `).run(c.id, c.name, c.type, c.username, c.secret_encrypted, c.domain, c.description, c.created_at, c.updated_at);
          }
        }
      }

      // Destinations
      if (restoreAll || sections.includes('destinations')) {
        if (Array.isArray(data.destinations)) {
          for (const d of data.destinations) {
            db.prepare(`
              INSERT INTO destinations (
                id, name, hostname, ip_address, system_type, os_name, os_version,
                category, description, is_active, connection_method, credential_id,
                port, domain, tags, created_at, last_used_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                hostname = excluded.hostname,
                ip_address = excluded.ip_address,
                system_type = excluded.system_type,
                os_name = excluded.os_name,
                os_version = excluded.os_version,
                category = excluded.category,
                description = excluded.description,
                is_active = excluded.is_active,
                connection_method = excluded.connection_method,
                credential_id = excluded.credential_id,
                port = excluded.port,
                domain = excluded.domain,
                tags = excluded.tags
            `).run(
              d.id, d.name, d.hostname, d.ip_address, d.system_type, d.os_name, d.os_version,
              d.category, d.description, d.is_active, d.connection_method, d.credential_id,
              d.port, d.domain, d.tags, d.created_at, d.last_used_at
            );
          }
        }
      }

      // Templates
      if (restoreAll || sections.includes('templates')) {
        if (Array.isArray(data.templates)) {
          for (const tmpl of data.templates) {
            db.prepare(`
              INSERT INTO templates (id, name, description, system_type, command_type, command_template, default_timeout, tags, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                system_type = excluded.system_type,
                command_type = excluded.command_type,
                command_template = excluded.command_template,
                default_timeout = excluded.default_timeout,
                tags = excluded.tags
            `).run(tmpl.id, tmpl.name, tmpl.description, tmpl.system_type, tmpl.command_type, tmpl.command_template, tmpl.default_timeout, tmpl.tags, tmpl.created_at);
          }
        }
      }

      // Tasks
      if (restoreAll || sections.includes('tasks')) {
        if (Array.isArray(data.tasks)) {
          for (const t of data.tasks) {
            db.prepare(`
              INSERT INTO tasks (
                id, name, description, category_id, template_id, credential_id,
                target_type, target_group, is_active, task_type, command_type, payload,
                schedule_type, schedule_expression, timezone, timeout_seconds, max_retries,
                on_error, next_run_at, last_run_at, last_status, last_duration_ms, tags,
                created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                category_id = excluded.category_id,
                template_id = excluded.template_id,
                credential_id = excluded.credential_id,
                target_type = excluded.target_type,
                target_group = excluded.target_group,
                is_active = excluded.is_active,
                task_type = excluded.task_type,
                command_type = excluded.command_type,
                payload = excluded.payload,
                schedule_type = excluded.schedule_type,
                schedule_expression = excluded.schedule_expression,
                timezone = excluded.timezone,
                timeout_seconds = excluded.timeout_seconds,
                max_retries = excluded.max_retries,
                on_error = excluded.on_error,
                next_run_at = excluded.next_run_at,
                tags = excluded.tags,
                updated_at = excluded.updated_at
            `).run(
              t.id, t.name, t.description, t.category_id, t.template_id, t.credential_id,
              t.target_type, t.target_group, t.is_active, t.task_type, t.command_type, t.payload,
              t.schedule_type, t.schedule_expression, t.timezone, t.timeout_seconds, t.max_retries,
              t.on_error, t.next_run_at, t.last_run_at, t.last_status, t.last_duration_ms, t.tags,
              t.created_by, t.created_at, t.updated_at
            );
          }
        }

        // Task destinations relations
        if (Array.isArray(data.task_destinations)) {
          for (const td of data.task_destinations) {
            db.prepare('INSERT OR IGNORE INTO task_destinations (task_id, destination_id) VALUES (?, ?)').run(td.task_id, td.destination_id);
          }
        }

        // Task dependencies
        if (Array.isArray(data.task_dependencies)) {
          for (const dep of data.task_dependencies) {
            db.prepare(`
              INSERT INTO task_dependencies (id, task_id, depends_on_task_id, condition, created_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(task_id, depends_on_task_id) DO UPDATE SET condition = excluded.condition
            `).run(dep.id, dep.task_id, dep.depends_on_task_id, dep.condition, dep.created_at);
          }
        }
      }

      // Settings
      if (restoreAll || sections.includes('settings')) {
        if (Array.isArray(data.settings)) {
          for (const s of data.settings) {
            db.prepare(`
              INSERT INTO settings (key, value, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            `).run(s.key, s.value, s.updated_at);
          }
        }
      }
    });

    transaction();

    logAudit({
      action: 'restore',
      entity_type: 'backup',
      entity_name: backupToRestore.id || 'uploaded_backup',
      user_id: req.user?.id,
      username: req.user?.username || 'admin',
      details: `Restauración ${mode === 'full' ? 'completa' : 'selectiva (' + sections.join(', ') + ')'} ejecutada con éxito. Safety backup: ${safetyFilename}`,
      ip_address: req.ip,
    });

    return res.json({
      success: true,
      message: 'Restauración completada con éxito',
      safetyBackup: safetyFilename,
    });
  } catch (err: any) {
    console.error('Error executing restore:', err);
    return res.status(500).json({ error: `Fallo durante la restauración: ${err.message}` });
  }
});

// DELETE a backup file
router.delete('/:filename', (req: AuthenticatedRequest, res) => {
  ensureBackupDir();
  const rawFilename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const filename = path.basename(String(rawFilename || ''));
  const filePath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup no encontrado' });
  }

  fs.unlinkSync(filePath);

  logAudit({
    action: 'delete',
    entity_type: 'backup',
    entity_name: filename,
    user_id: req.user?.id,
    username: req.user?.username || 'admin',
    details: 'Archivo de backup eliminado',
    ip_address: req.ip,
  });

  return res.json({ message: 'Backup eliminado exitosamente' });
});

export default router;
