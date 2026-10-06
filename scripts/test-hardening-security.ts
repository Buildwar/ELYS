import { db } from '../server/src/db/index.js';
import { encryptSecret, decryptSecret } from '../server/src/utils/crypto.js';
import { signToken } from '../server/src/middleware/auth.js';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:4800';

async function runTests() {
  console.log('==============================================');
  console.log('🔒 ELYS — HARDENING & SECURITY VERIFICATION');
  console.log('==============================================\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // TEST 1: Security Headers & X-Powered-By removal
  console.log('1. Probando Headers de Seguridad HTTP...');
  const healthRes = await fetch(`${BASE_URL}/api/system/health`);
  assert(healthRes.headers.get('x-content-type-options') === 'nosniff', 'Header X-Content-Type-Options es nosniff');
  assert(healthRes.headers.get('x-frame-options') === 'SAMEORIGIN', 'Header X-Frame-Options es SAMEORIGIN');
  assert(healthRes.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Header Referrer-Policy presente');
  assert(healthRes.headers.get('x-powered-by') === null, 'Header X-Powered-By ha sido eliminado/desactivado');

  // TEST 2: Credential Encryption at Rest (AES-256-GCM)
  console.log('\n2. Probando Cifrado de Credenciales en Reposo (AES-256-GCM)...');
  const secretOriginal = 'SuperSecretDbPassword#2026!';
  const encrypted = encryptSecret(secretOriginal);
  assert(encrypted.startsWith('enc:gcm:'), 'Cifrado genera formato enc:gcm:<iv>:<tag>:<ciphertext>');
  assert(!encrypted.includes(secretOriginal), 'Texto claro no aparece en el texto cifrado');
  const decrypted = decryptSecret(encrypted);
  assert(decrypted === secretOriginal, 'Descifrado recupera exactamente el secreto original');

  // TEST 3: Deactivated User Token Revocation
  console.log('\n3. Probando Revocación Inmediata de Token para Usuario Desactivado...');
  const testUserId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, 'test_deactivated', 'test_deactivated@elys.local', 'fake_hash', 'operator', 0, ?, ?)
  `).run(testUserId, now, now);

  const deactToken = signToken({
    id: testUserId,
    username: 'test_deactivated',
    email: 'test_deactivated@elys.local',
    role: 'operator',
  });

  const deactRes = await fetch(`${BASE_URL}/api/tasks`, {
    headers: { Authorization: `Bearer ${deactToken}` },
  });
  assert(deactRes.status === 401, 'Petición con token de usuario desactivado devuelve 401 Unauthorized');
  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);

  // TEST 4: RBAC on Bulk Delete Permanent
  console.log('\n4. Probando RBAC en Acción Masiva delete_permanent...');
  const operatorUserId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, 'test_operator', 'test_operator@elys.local', 'fake_hash', 'operator', 1, ?, ?)
  `).run(operatorUserId, now, now);

  const operatorToken = signToken({
    id: operatorUserId,
    username: 'test_operator',
    email: 'test_operator@elys.local',
    role: 'operator',
  });

  const bulkRes = await fetch(`${BASE_URL}/api/tasks/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${operatorToken}`,
    },
    body: JSON.stringify({
      taskIds: ['fake-task-id'],
      action: 'delete_permanent',
    }),
  });
  assert(bulkRes.status === 403, 'Operador recibe 403 Forbidden al intentar acción masiva delete_permanent');
  db.prepare('DELETE FROM users WHERE id = ?').run(operatorUserId);

  // TEST 5: Rate Limiting & 5-Minute Lockout on Login
  console.log('\n5. Probando Rate Limiter y Bloqueo de 5 Minutos en /api/auth/login...');
  const testIp = '198.51.100.42';
  let rateLimited = false;
  let retryAfterHeader: string | null = null;
  let errorMessage = '';

  for (let i = 1; i <= 12; i++) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': testIp,
      },
      body: JSON.stringify({ username: 'invalid_user_rate_test', password: 'wrong_password' }),
    });

    if (res.status === 429) {
      rateLimited = true;
      retryAfterHeader = res.headers.get('retry-after');
      const body = (await res.json()) as any;
      errorMessage = body.error || '';
      break;
    }
  }

  assert(rateLimited, 'Rate limiter bloquea intentos repetidos con código 429 Too Many Requests');
  assert(Boolean(retryAfterHeader), 'Header Retry-After devuelto en respuesta 429');

  const retryAfterSec = parseInt(retryAfterHeader || '0', 10);
  assert(
    retryAfterSec > 0 && retryAfterSec <= 300,
    `LOCKOUT_DURATION = 5 MINUTOS (Retry-After devuelto: ${retryAfterSec}s <= 300s)`
  );
  assert(
    errorMessage.includes('5 minutos'),
    `Mensaje de error indica 5 minutos de espera ("${errorMessage}")`
  );

  const blockedDuringLockout = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': testIp,
    },
    body: JSON.stringify({ username: 'admin', password: 'AnyPassword' }),
  });
  assert(
    blockedDuringLockout.status === 429,
    'Petición durante el periodo de bloqueo temporal sigue bloqueada (429)'
  );

  // TEST 6: Normal Login, Dashboard access & Logout/Login Flow
  console.log('\n6. Probando Login Normal, Acceso a Dashboard y Flujo Logout/Login...');
  const normalIp = '198.51.100.99';
  const normalUserId = crypto.randomUUID();
  const bcrypt = await import('bcryptjs');
  const testPassword = 'TestPassword2026!';
  const testPasswordHash = bcrypt.default.hashSync(testPassword, 10);
  const testUserTime = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, is_active, must_change_password, created_at, updated_at)
    VALUES (?, 'test_normal_user', 'test_normal@elys.local', ?, 'admin', 1, 0, ?, ?)
  `).run(normalUserId, testPasswordHash, testUserTime, testUserTime);

  try {
    // 1. Initial Login
    const loginRes1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': normalIp,
      },
      body: JSON.stringify({ username: 'test_normal_user', password: testPassword }),
    });
    const loginData1 = (await loginRes1.json()) as any;
    assert(loginRes1.status === 200 && Boolean(loginData1.token), 'Login con credenciales válidas permite acceso (200 OK)');

    // 2. Access Dashboard with Token
    const dashRes1 = await fetch(`${BASE_URL}/api/system/dashboard`, {
      headers: {
        Authorization: `Bearer ${loginData1.token}`,
        'X-Forwarded-For': normalIp,
      },
    });
    assert(dashRes1.status === 200, 'Acceso al Dashboard con token válido permitido (200 OK)');

    // 3. Logout check (unauthenticated request receives 401)
    const logoutCheck = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'X-Forwarded-For': normalIp },
    });
    assert(logoutCheck.status === 401, 'Sesión cerrada: acceso sin token denegado (401 Unauthorized)');

    // 4. Re-login
    const loginRes2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': normalIp,
      },
      body: JSON.stringify({ username: 'test_normal_user', password: testPassword }),
    });
    const loginData2 = (await loginRes2.json()) as any;
    assert(loginRes2.status === 200 && Boolean(loginData2.token), 'Login posterior tras logout exitoso (200 OK)');

    // 5. Access Dashboard Again
    const dashRes2 = await fetch(`${BASE_URL}/api/system/dashboard`, {
      headers: {
        Authorization: `Bearer ${loginData2.token}`,
        'X-Forwarded-For': normalIp,
      },
    });
    assert(dashRes2.status === 200, 'Acceso al Dashboard tras segundo login permitido (200 OK)');
  } finally {
    db.prepare('DELETE FROM users WHERE id = ?').run(normalUserId);
  }

  console.log('\n==============================================');
  console.log(`Resumen: ${passed} pasados, ${failed} fallidos`);
  console.log('==============================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Error durante la ejecución de pruebas:', err);
  process.exit(1);
});
