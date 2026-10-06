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

  // TEST 5: Rate Limiting on Login
  console.log('\n5. Probando Rate Limiter en /api/auth/login...');
  let rateLimited = false;
  let retryAfterHeader = null;
  // Trigger attempts
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'invalid_user_rate_test', password: 'wrong_password' }),
    });
    if (res.status === 429) {
      rateLimited = true;
      retryAfterHeader = res.headers.get('retry-after');
      break;
    }
  }
  assert(rateLimited, 'Rate limiter bloquea intentos repetidos con código 429 Too Many Requests');
  assert(Boolean(retryAfterHeader), 'Header Retry-After devuelto en respuesta 429');

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
