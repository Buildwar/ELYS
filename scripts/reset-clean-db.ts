import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'data', 'elys.db');
const db = new Database(DB_PATH);

console.log('--- RESETTING ELYS DATABASE TO 100% CLEAN PRODUCTION STATE ---');

// Clean all mock and demo data
const tablesToWipe = [
  'tasks',
  'task_destinations',
  'task_dependencies',
  'task_locks',
  'task_history',
  'executions',
  'execution_logs',
  'destinations',
  'credentials',
  'templates',
  'categories',
  'audit_logs',
  'notification_deliveries',
  'users'
];

for (const table of tablesToWipe) {
  try {
    db.prepare(`DELETE FROM ${table}`).run();
    console.log(`[CLEAN] Table ${table} wiped -> 0 rows.`);
  } catch (err: any) {
    console.error(`Error wiping ${table}:`, err.message);
  }
}

// Clear demo integrations in settings
try {
  db.prepare(`DELETE FROM settings WHERE key LIKE 'telegram_%' OR key LIKE 'smtp_%'`).run();
  console.log('[CLEAN] Integration settings wiped.');
} catch (err: any) {
  console.error('Error clearing settings:', err.message);
}

// Verify counts
console.log('\n--- VERIFYING CLEAN TABLE ROW COUNTS ---');
let allClean = true;
for (const table of tablesToWipe) {
  try {
    const row = db.prepare(`SELECT count(*) as count FROM ${table}`).get() as { count: number };
    console.log(`  ${table.padEnd(25)} : ${row.count} rows`);
    if (row.count !== 0) allClean = false;
  } catch (err: any) {
    console.error(`  ${table}: ${err.message}`);
  }
}

if (allClean) {
  console.log('\n>>> SUCCESS: Database is 100% CLEAN. Ready for Initial Setup Wizard (CONFIGURACIÓN INICIAL DE ELYS).');
} else {
  console.error('\n>>> ERROR: Some tables are not empty.');
  process.exit(1);
}
