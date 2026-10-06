import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDatabase, db } from './db/index.js';
import { startScheduler, stopScheduler } from './scheduler/index.js';

import authRoutes from './routes/auth.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import executionsRoutes from './routes/executions.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import usersRoutes from './routes/users.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import systemRoutes from './routes/system.routes.js';
import destinationsRoutes from './routes/destinations.routes.js';
import credentialsRoutes from './routes/credentials.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import auditRoutes from './routes/audit.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import backupRoutes from './routes/backup.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4800;

// Security: Disable X-Powered-By header
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// Hardened CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : null;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server or local tools with no origin header
      if (!origin) return callback(null, true);
      if (!allowedOrigins) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Bloqueado por política CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database
initDatabase();

// Start Task Scheduler Engine
startScheduler();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/executions', executionsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/destinations', destinationsRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/backup', backupRoutes);

// Serve frontend static build in production
const clientDistPath = path.resolve(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// Global error handler (sanitizes error stack & details in production)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Error interno del servidor',
    message: isProd ? 'Se ha producido un error interno en el servidor.' : (err.message || 'Internal Server Error'),
  });
});

const server = app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`⚡ ELYS — ADVANCED TASK SCHEDULER`);
  console.log(`⚡ Servidor activo en http://localhost:${PORT}`);
  console.log(`=========================================`);
});

// Graceful shutdown
function shutdown() {
  console.log('\n[ELYS] Cerrando servidor y deteniendo scheduler...');
  stopScheduler();
  try {
    db.close();
  } catch (err) {
    console.error('Error closing database:', err);
  }
  server.close(() => {
    console.log('[ELYS] Servidor cerrado correctamente.');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
