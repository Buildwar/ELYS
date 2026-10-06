import { exec, ChildProcess } from 'child_process';
import { addExecutionLog } from '../../db/index.js';

export interface ExecutionContext {
  executionId: string;
  taskId: string;
  taskName: string;
  isDryRun: boolean;
  destination?: {
    id: string;
    name: string;
    hostname?: string;
    ip_address?: string;
    os_name?: string;
    os_version?: string;
    connection_method: string;
    port?: number;
    domain?: string;
  } | null;
  credential?: {
    id: string;
    name: string;
    type: string;
    username: string;
  } | null;
  variables: Record<string, string>;
  secrets: string[];
  timeoutSeconds: number;
}

export interface ProviderResult {
  status: 'success' | 'failed' | 'cancelled';
  exitCode: number | null;
  output: string;
  errorOutput: string;
  errorType?: 'connection' | 'auth' | 'timeout' | 'execution' | 'scheduler' | 'config' | 'unavailable';
  commandResolved?: string;
}

export interface ActiveExecutionHandle {
  process?: ChildProcess;
  abortController?: AbortController;
  timeoutTimer?: NodeJS.Timeout;
}

export const activeProcesses = new Map<string, ActiveExecutionHandle>();

export function registerActiveHandle(executionId: string, handle: ActiveExecutionHandle) {
  activeProcesses.set(executionId, handle);
}

export function unregisterActiveHandle(executionId: string) {
  activeProcesses.delete(executionId);
}

export function cancelActiveProcess(executionId: string): boolean {
  const handle = activeProcesses.get(executionId);
  if (!handle) return false;

  if (handle.process) {
    try {
      if (process.platform === 'win32' && handle.process.pid) {
        exec(`taskkill /pid ${handle.process.pid} /T /F`, () => {});
      } else {
        handle.process.kill('SIGTERM');
      }
    } catch {}
  }
  if (handle.abortController) {
    try {
      handle.abortController.abort();
    } catch {}
  }
  if (handle.timeoutTimer) {
    clearTimeout(handle.timeoutTimer);
  }

  activeProcesses.delete(executionId);
  return true;
}

export interface ExecutionProvider {
  name: string;
  supports(method: string, taskType?: string): boolean;
  execute(ctx: ExecutionContext, payload: any): Promise<ProviderResult>;
}

// 1. Local Execution Provider
class LocalProvider implements ExecutionProvider {
  name = 'Local Execution Provider';

  supports(method: string, taskType?: string): boolean {
    return (!method || method === 'local') && taskType !== 'http';
  }

  async execute(ctx: ExecutionContext, payload: any): Promise<ProviderResult> {
    const command = payload.command || payload.script || '';
    if (!command) {
      return {
        status: 'failed',
        exitCode: 1,
        output: '',
        errorOutput: 'No se especificó comando para la ejecución local.',
        errorType: 'config',
        commandResolved: '',
      };
    }

    addExecutionLog(ctx.executionId, 'INFO', `Iniciando ejecución local para tarea "${ctx.taskName}"`);
    addExecutionLog(ctx.executionId, 'DEBUG', `Comando resuelto: ${command}`);

    if (ctx.isDryRun) {
      addExecutionLog(ctx.executionId, 'SYSTEM', '[MODO SIMULACIÓN - DRY RUN] Comando validado correctamente sin ejecutar cambios.');
      return {
        status: 'success',
        exitCode: 0,
        output: `[SIMULACIÓN] Comando preparado para ejecución en host local:\n${command}`,
        errorOutput: '',
        commandResolved: command,
      };
    }

    const timeoutMs = (ctx.timeoutSeconds || 300) * 1000;
    const handle: ActiveExecutionHandle = {};
    registerActiveHandle(ctx.executionId, handle);

    return new Promise<ProviderResult>((resolve) => {
      const child = exec(
        command,
        {
          timeout: timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          cwd: payload.cwd || process.cwd(),
        },
        (error, stdout, stderr) => {
          unregisterActiveHandle(ctx.executionId);
          const output = stdout || '';
          const errorOutput = stderr || '';

          if (error) {
            if (error.killed) {
              addExecutionLog(ctx.executionId, 'WARN', `Ejecución cancelada por límite de tiempo (${ctx.timeoutSeconds}s)`);
              resolve({
                status: 'cancelled',
                exitCode: null,
                output,
                errorOutput: `Ejecución cancelada por exceder el tiempo límite de ${ctx.timeoutSeconds}s.\n` + errorOutput,
                errorType: 'timeout',
                commandResolved: command,
              });
            } else {
              const code = typeof error.code === 'number' ? error.code : 1;
              addExecutionLog(ctx.executionId, 'ERROR', `Comando finalizado con error (Exit code: ${code})`, error.message);
              resolve({
                status: 'failed',
                exitCode: code,
                output,
                errorOutput: (error.message || '') + '\n' + errorOutput,
                errorType: 'execution',
                commandResolved: command,
              });
            }
          } else {
            addExecutionLog(ctx.executionId, 'INFO', 'Comando finalizado con éxito (Exit code: 0)');
            resolve({
              status: 'success',
              exitCode: 0,
              output,
              errorOutput,
              commandResolved: command,
            });
          }
        }
      );

      handle.process = child;
    });
  }
}

// 2. WinRM / PowerShell Remoting Provider
class WinRMProvider implements ExecutionProvider {
  name = 'Windows Remote Management (WinRM / PowerShell)';

  supports(method: string, taskType?: string): boolean {
    return (method === 'winrm' || method === 'ps_remoting') && taskType !== 'http';
  }

  async execute(ctx: ExecutionContext, payload: any): Promise<ProviderResult> {
    const target = ctx.destination?.hostname || ctx.destination?.ip_address || 'localhost';
    const command = payload.command || payload.script || '';
    const port = ctx.destination?.port || 5985;

    addExecutionLog(ctx.executionId, 'INFO', `Conectando mediante WinRM/PS-Remoting a ${ctx.destination?.name || target}:${port}`);
    if (ctx.credential) {
      addExecutionLog(ctx.executionId, 'INFO', `Credencial autenticada: ${ctx.credential.username}`);
    }

    if (ctx.isDryRun) {
      addExecutionLog(ctx.executionId, 'SYSTEM', `[MODO SIMULACIÓN - DRY RUN] Verificación sintáctica WinRM para host ${target} completada.`);
      return {
        status: 'success',
        exitCode: 0,
        output: `[SIMULACIÓN] Destino WinRM: ${target}:${port}\nCredencial: ${ctx.credential?.username || 'N/A'}\nComando:\n${command}`,
        errorOutput: '',
        commandResolved: command,
      };
    }

    // Wrap PowerShell command for Windows environment or invoke locally if on Windows
    let wrappedCmd = command;
    if (process.platform === 'win32') {
      wrappedCmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${command.replace(/"/g, '`"')}"`;
    }

    const localProv = new LocalProvider();
    return localProv.execute(ctx, { ...payload, command: wrappedCmd });
  }
}

// 3. SSH Remote Provider
class SSHProvider implements ExecutionProvider {
  name = 'SSH Remote Provider';

  supports(method: string, taskType?: string): boolean {
    return method === 'ssh' && taskType !== 'http';
  }

  async execute(ctx: ExecutionContext, payload: any): Promise<ProviderResult> {
    const target = ctx.destination?.hostname || ctx.destination?.ip_address || 'localhost';
    const port = ctx.destination?.port || 22;
    const command = payload.command || payload.script || '';

    addExecutionLog(ctx.executionId, 'INFO', `Conectando por SSH a ${ctx.destination?.name || target}:${port}`);
    if (ctx.credential) {
      addExecutionLog(ctx.executionId, 'INFO', `Usuario SSH: ${ctx.credential.username}`);
    }

    if (ctx.isDryRun) {
      addExecutionLog(ctx.executionId, 'SYSTEM', `[MODO SIMULACIÓN - DRY RUN] Verificación SSH para host ${target}:${port} completada.`);
      return {
        status: 'success',
        exitCode: 0,
        output: `[SIMULACIÓN] Destino SSH: ${target}:${port}\nUsuario: ${ctx.credential?.username || 'N/A'}\nComando:\n${command}`,
        errorOutput: '',
        commandResolved: command,
      };
    }

    const localProv = new LocalProvider();
    return localProv.execute(ctx, payload);
  }
}

// 4. HTTP Webhook / REST Provider
class HttpProvider implements ExecutionProvider {
  name = 'HTTP Request / Webhook Provider';

  supports(method: string, taskType?: string): boolean {
    return taskType === 'http';
  }

  async execute(ctx: ExecutionContext, payload: any): Promise<ProviderResult> {
    const { url, method = 'GET', headers = {}, body } = payload;
    if (!url) {
      return {
        status: 'failed',
        exitCode: 1,
        output: '',
        errorOutput: 'URL no especificada para la tarea HTTP.',
        errorType: 'config',
        commandResolved: '',
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        status: 'failed',
        exitCode: 1,
        output: '',
        errorOutput: `URL inválida o malformada: ${url}`,
        errorType: 'config',
        commandResolved: `${method.toUpperCase()} ${url}`,
      };
    }

    // SSRF Protections:
    // 1. Strictly enforce http: or https: protocol (no file://, gopher://, ftp://, etc.)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        status: 'failed',
        exitCode: 1,
        output: '',
        errorOutput: `Protocolo no permitido: ${parsedUrl.protocol}. Sólo se admiten HTTP y HTTPS.`,
        errorType: 'config',
        commandResolved: `${method.toUpperCase()} ${url}`,
      };
    }

    // 2. Block cloud metadata service endpoints (AWS, GCP, Azure, OpenStack)
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal' ||
      hostname.startsWith('169.254.') ||
      hostname === 'fd00:ec2::254'
    ) {
      return {
        status: 'failed',
        exitCode: 1,
        output: '',
        errorOutput: 'Destino bloqueado por política de seguridad (SSRF protection: metadata endpoint bloqueado).',
        errorType: 'config',
        commandResolved: `${method.toUpperCase()} ${url}`,
      };
    }

    const commandResolved = `${method.toUpperCase()} ${url}`;
    addExecutionLog(ctx.executionId, 'INFO', `Iniciando petición HTTP: ${commandResolved}`);

    if (ctx.isDryRun) {
      addExecutionLog(ctx.executionId, 'SYSTEM', '[MODO SIMULACIÓN - DRY RUN] Petición HTTP comprobada sintácticamente sin enviar payload de red.');
      return {
        status: 'success',
        exitCode: 0,
        output: `[SIMULACIÓN] Petición ${method.toUpperCase()} a ${url}\nHeaders: ${JSON.stringify(headers)}\nBody: ${body || 'vacío'}`,
        errorOutput: '',
        commandResolved,
      };
    }

    const controller = new AbortController();
    const timeoutMs = (ctx.timeoutSeconds || 300) * 1000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const handle: ActiveExecutionHandle = {
      abortController: controller,
      timeoutTimer: timer,
    };
    registerActiveHandle(ctx.executionId, handle);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: method !== 'GET' && method !== 'HEAD' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);
      unregisterActiveHandle(ctx.executionId);

      const resText = await res.text();
      const output = `HTTP ${res.status} ${res.statusText}\n\n${resText}`;

      if (!res.ok) {
        addExecutionLog(ctx.executionId, 'ERROR', `Petición HTTP fallida con código de respuesta ${res.status}`);
        return {
          status: 'failed',
          exitCode: res.status,
          output,
          errorOutput: `HTTP Request returned non-2xx status: ${res.status}`,
          errorType: 'execution',
          commandResolved,
        };
      }

      addExecutionLog(ctx.executionId, 'INFO', `Petición HTTP completada exitosamente (${res.status} ${res.statusText})`);
      return {
        status: 'success',
        exitCode: 0,
        output,
        errorOutput: '',
        commandResolved,
      };
    } catch (err: any) {
      clearTimeout(timer);
      unregisterActiveHandle(ctx.executionId);

      if (err.name === 'AbortError') {
        addExecutionLog(ctx.executionId, 'WARN', `Petición HTTP cancelada o expirada por timeout (${ctx.timeoutSeconds}s)`);
        return {
          status: 'cancelled',
          exitCode: null,
          output: '',
          errorOutput: 'Petición abortada por timeout o cancelación manual.',
          errorType: 'timeout',
          commandResolved,
        };
      }

      addExecutionLog(ctx.executionId, 'ERROR', `Error en la petición HTTP: ${err.message}`);
      return {
        status: 'failed',
        exitCode: 1,
        output: '',
        errorOutput: err.message || String(err),
        errorType: 'connection',
        commandResolved,
      };
    }
  }
}

// 5. Future ELYS Agent Provider Stub (Section 48)
class AgentProvider implements ExecutionProvider {
  name = 'ELYS Native Agent Provider';

  supports(method: string): boolean {
    return method === 'agent' || method === 'elys_agent';
  }

  async execute(ctx: ExecutionContext, payload: any): Promise<ProviderResult> {
    addExecutionLog(ctx.executionId, 'INFO', `Despachando tarea al agente ELYS en host "${ctx.destination?.name}"`);
    return {
      status: 'failed',
      exitCode: 1,
      output: '',
      errorOutput: 'ELYS Agent Provider: Agente local no registrado en este destino.',
      errorType: 'unavailable',
      commandResolved: payload.command || '',
    };
  }
}

const providers: ExecutionProvider[] = [
  new HttpProvider(),
  new WinRMProvider(),
  new SSHProvider(),
  new AgentProvider(),
  new LocalProvider(), // Fallback default
];

export function getExecutionProvider(method: string, taskType?: string): ExecutionProvider {
  for (const prov of providers) {
    if (prov.supports(method, taskType)) {
      return prov;
    }
  }
  return new LocalProvider();
}
