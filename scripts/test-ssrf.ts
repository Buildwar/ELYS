import { getExecutionProvider } from '../server/src/scheduler/providers/index.js';

async function testSSRF() {
  console.log('Testing SSRF Protections in HttpProvider...');
  const httpProv = getExecutionProvider('', 'http');
  if (!httpProv) {
    console.error('HttpProvider not found');
    process.exit(1);
  }

  const baseCtx: any = {
    executionId: 'test-exec-ssrf',
    taskId: 'test-task',
    taskName: 'SSRF Test',
    isDryRun: false,
    variables: {},
    secrets: [],
    timeoutSeconds: 5,
  };

  // Test 1: AWS metadata endpoint
  const res1 = await httpProv.execute(baseCtx, { url: 'http://169.254.169.254/latest/meta-data/' });
  console.log('AWS Metadata IP test status:', res1.status, '| error:', res1.errorOutput);
  if (res1.status !== 'failed' || !res1.errorOutput.includes('SSRF protection')) {
    console.error('FAIL: AWS metadata endpoint was not blocked!');
    process.exit(1);
  }
  console.log('✅ PASS: AWS Metadata endpoint successfully blocked.');

  // Test 2: File protocol
  const res2 = await httpProv.execute(baseCtx, { url: 'file:///etc/passwd' });
  console.log('File protocol test status:', res2.status, '| error:', res2.errorOutput);
  if (res2.status !== 'failed' || !res2.errorOutput.includes('Protocolo no permitido')) {
    console.error('FAIL: file:// protocol was not blocked!');
    process.exit(1);
  }
  console.log('✅ PASS: file:// protocol successfully blocked.');

  console.log('\nAll SSRF tests passed!');
}

testSSRF().catch((err) => {
  console.error('Error during SSRF test:', err);
  process.exit(1);
});
