import Database from 'better-sqlite3';
import path from 'path';

const API_BASE = 'http://localhost:4800/api';
const DB_PATH = path.join(process.cwd(), 'data', 'elys.db');

async function runTests() {
  console.log('=== RUNNING TESTS FOR CLEAN INSTALLATION & INITIAL SETUP ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  try {
    // 1. Check setup status on empty DB
    const resSetupStatus1 = await fetch(`${API_BASE}/auth/setup-status`);
    const dataSetupStatus1 = (await resSetupStatus1.json()) as any;
    assert(
      resSetupStatus1.status === 200 && dataSetupStatus1.initialized === false,
      '1. GET /api/auth/setup-status returns initialized: false on clean install',
      dataSetupStatus1
    );

    // 2. Initial Setup Wizard (POST /api/auth/setup)
    const resSetup = await fetch(`${API_BASE}/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'Admin123',
      }),
    });
    const dataSetup = (await resSetup.json()) as any;
    assert(
      resSetup.status === 200 &&
        dataSetup.user &&
        dataSetup.user.username === 'admin' &&
        dataSetup.user.mustChangePassword === true &&
        Boolean(dataSetup.token),
      '2. POST /api/auth/setup creates admin with mustChangePassword = true',
      dataSetup
    );

    const initialToken = dataSetup.token;

    // 3. Database verification of bcrypt hash & must_change_password
    const db = new Database(DB_PATH);
    const dbUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as any;
    assert(
      dbUser &&
        dbUser.must_change_password === 1 &&
        dbUser.password_hash.startsWith('$2'),
      '3. Admin password is securely hashed with bcrypt ($2...) and must_change_password = 1 in SQLite',
      { hash: dbUser?.password_hash?.substring(0, 10), must_change: dbUser?.must_change_password }
    );

    // 4. Setup status now returns initialized: true
    const resSetupStatus2 = await fetch(`${API_BASE}/auth/setup-status`);
    const dataSetupStatus2 = (await resSetupStatus2.json()) as any;
    assert(
      resSetupStatus2.status === 200 && dataSetupStatus2.initialized === true,
      '4. GET /api/auth/setup-status returns initialized: true after setup'
    );

    // 5. Subsequent setup attempt is blocked
    const resSetupBlocked = await fetch(`${API_BASE}/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hacker', password: 'Password123' }),
    });
    assert(
      resSetupBlocked.status === 400,
      '5. Second setup attempt is blocked with 400 error'
    );

    // 6. Login with initial Admin123 credentials returns mustChangePassword: true
    const resLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin123' }),
    });
    const dataLogin = (await resLogin.json()) as any;
    assert(
      resLogin.status === 200 && dataLogin.user.mustChangePassword === true,
      '6. POST /api/auth/login with Admin123 flags user with mustChangePassword: true'
    );

    // 7. Initial token cannot access protected endpoints (e.g. GET /api/tasks)
    const resTasksBlocked = await fetch(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${initialToken}` },
    });
    const dataTasksBlocked = (await resTasksBlocked.json()) as any;
    assert(
      resTasksBlocked.status === 403 && dataTasksBlocked.code === 'MUST_CHANGE_PASSWORD',
      '7. API blocks access to /api/tasks before password change with MUST_CHANGE_PASSWORD code',
      dataTasksBlocked
    );

    // 8. Mandatory Change Password screen flow
    const resChangePwd = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'Admin123',
        newPassword: 'MySecurePassword2026!',
      }),
    });
    const dataChangePwd = (await resChangePwd.json()) as any;
    assert(
      resChangePwd.status === 200 &&
        dataChangePwd.user &&
        dataChangePwd.user.mustChangePassword === false &&
        Boolean(dataChangePwd.token),
      '8. POST /api/auth/change-password successfully changes password and sets mustChangePassword = false',
      dataChangePwd
    );

    const freshToken = dataChangePwd.token;

    // 9. Verified in DB that must_change_password = 0
    const dbUserUpdated = db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as any;
    assert(
      dbUserUpdated.must_change_password === 0,
      '9. Database must_change_password is now 0'
    );

    // 10. Access to /api/tasks is now allowed
    const resTasksAllowed = await fetch(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    const dataTasks = (await resTasksAllowed.json()) as any;
    assert(
      resTasksAllowed.status === 200 && Array.isArray(dataTasks) && dataTasks.length === 0,
      '10. GET /api/tasks is allowed with fresh token and returns empty list (0 tasks)'
    );

    // 11. Verify clean zero records in all tables
    const tableCounts = [
      { name: 'tasks', count: (db.prepare('SELECT count(*) as c FROM tasks').get() as any).c },
      { name: 'destinations', count: (db.prepare('SELECT count(*) as c FROM destinations').get() as any).c },
      { name: 'credentials', count: (db.prepare('SELECT count(*) as c FROM credentials').get() as any).c },
      { name: 'templates', count: (db.prepare('SELECT count(*) as c FROM templates').get() as any).c },
      { name: 'categories', count: (db.prepare('SELECT count(*) as c FROM categories').get() as any).c },
      { name: 'executions', count: (db.prepare('SELECT count(*) as c FROM executions').get() as any).c },
    ];
    const allZero = tableCounts.every((t) => t.count === 0);
    assert(
      allZero,
      '11. Zero demo tasks, zero destinations, zero credentials, zero templates, zero categories, zero executions in database',
      tableCounts
    );

    console.log(`\n========================================`);
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
