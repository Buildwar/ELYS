import os from 'os';

export interface VariableDefinition {
  key: string;
  value: string;
  is_secret?: boolean;
}

export interface VariableContext {
  task: {
    id: string;
    name: string;
    variables?: string | null;
    target_params?: string | null;
  };
  destination?: {
    id: string;
    name: string;
    hostname?: string;
    ip_address?: string;
    os_name?: string;
    os_version?: string;
  } | null;
  executionId: string;
  username?: string;
  now?: Date;
}

export function parseTaskVariables(rawVariables?: string | null): VariableDefinition[] {
  if (!rawVariables) return [];
  try {
    const parsed = typeof rawVariables === 'string' ? JSON.parse(rawVariables) : rawVariables;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        key: String(item.key || '').trim(),
        value: String(item.value ?? ''),
        is_secret: Boolean(item.is_secret),
      })).filter((v) => v.key.length > 0);
    } else if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed).map(([k, v]) => {
        if (typeof v === 'object' && v !== null && 'value' in v) {
          return {
            key: k.trim(),
            value: String((v as any).value ?? ''),
            is_secret: Boolean((v as any).is_secret),
          };
        }
        return {
          key: k.trim(),
          value: String(v ?? ''),
          is_secret: false,
        };
      }).filter((v) => v.key.length > 0);
    }
  } catch (err) {
    console.error('Error parsing task variables:', err);
  }
  return [];
}

export function parseTargetParams(rawParams?: string | null, destinationId?: string | null): Record<string, string> {
  if (!rawParams || !destinationId) return {};
  try {
    const parsed = typeof rawParams === 'string' ? JSON.parse(rawParams) : rawParams;
    if (typeof parsed === 'object' && parsed !== null && destinationId in parsed) {
      const destParams = parsed[destinationId];
      if (typeof destParams === 'object' && destParams !== null) {
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(destParams)) {
          result[k.trim()] = String(v ?? '');
        }
        return result;
      }
    }
  } catch (err) {
    console.error('Error parsing target params:', err);
  }
  return {};
}

/**
 * Resolves all variables in a text template (command, payload, url, etc.)
 */
export function resolveVariables(
  template: string,
  ctx: VariableContext
): { resolved: string; secrets: string[]; resolvedMap: Record<string, string> } {
  if (!template) return { resolved: '', secrets: [], resolvedMap: {} };

  const now = ctx.now || new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');

  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateTimeStr = `${dateStr}T${timeStr}`;

  const resolvedMap: Record<string, string> = {
    date: dateStr,
    time: timeStr,
    datetime: dateTimeStr,
    hostname: ctx.destination?.hostname || ctx.destination?.name || os.hostname(),
    target_name: ctx.destination?.name || 'Local (ELYS)',
    target_ip: ctx.destination?.ip_address || '127.0.0.1',
    target_os: ctx.destination?.os_name || os.type(),
    target_version: ctx.destination?.os_version || os.release(),
    task_name: ctx.task.name,
    task_id: ctx.task.id,
    execution_id: ctx.executionId,
    username: ctx.username || 'system',
    environment: process.env.NODE_ENV || 'production',
  };

  const secrets: string[] = [];

  // 1. Task custom variables
  const taskVars = parseTaskVariables(ctx.task.variables);
  for (const tv of taskVars) {
    resolvedMap[tv.key] = tv.value;
    if (tv.is_secret && tv.value) {
      secrets.push(tv.value);
    }
  }

  // 2. Destination-specific overrides (takes precedence over task variables)
  if (ctx.destination?.id) {
    const targetParams = parseTargetParams(ctx.task.target_params, ctx.destination.id);
    for (const [k, v] of Object.entries(targetParams)) {
      resolvedMap[k] = v;
    }
  }

  // 3. Perform safe string replacement for {{variable}} or {{ variable }}
  let resolved = template;
  for (const [k, v] of Object.entries(resolvedMap)) {
    const escapedKey = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'gi');
    resolved = resolved.replace(regex, v);
  }

  return { resolved, secrets, resolvedMap };
}

/**
 * Masks any secret values present in log output or text
 */
export function maskSecretsInText(text: string, secrets: string[]): string {
  if (!text || !secrets || secrets.length === 0) return text;
  let result = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 3) {
      result = result.split(secret).join('••••••••');
    }
  }
  return result;
}
