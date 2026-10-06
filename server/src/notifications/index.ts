import nodemailer from 'nodemailer';
import { db, logNotificationDelivery } from '../db/index.js';

export interface TelegramConfig {
  enabled: boolean;
  bot_token: string;
  chat_id: string;
}

export interface EmailConfig {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  from_email: string;
  from_name: string;
  to_email: string;
}

export interface NotificationRules {
  notify_on_success: boolean;
  notify_on_fail: boolean;
  notify_connection_error: boolean;
  notify_auth_error: boolean;
  channel_telegram: boolean;
  channel_email: boolean;
  group_notifications: boolean;
}

export interface NotificationSettings {
  telegram: TelegramConfig;
  email: EmailConfig;
  rules: NotificationRules;
}

export function getNotificationSettings(): NotificationSettings {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'notifications'").get() as { value: string } | undefined;
  if (!row) {
    return {
      telegram: { enabled: false, bot_token: '', chat_id: '' },
      email: {
        enabled: false,
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: '',
        smtp_pass: '',
        from_email: 'elys@local.corp',
        from_name: 'ELYS Scheduler',
        to_email: '',
      },
      rules: {
        notify_on_success: true,
        notify_on_fail: true,
        notify_connection_error: true,
        notify_auth_error: true,
        channel_telegram: true,
        channel_email: false,
        group_notifications: true,
      },
    };
  }

  try {
    return JSON.parse(row.value);
  } catch {
    return {
      telegram: { enabled: false, bot_token: '', chat_id: '' },
      email: {
        enabled: false,
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: '',
        smtp_pass: '',
        from_email: 'elys@local.corp',
        from_name: 'ELYS Scheduler',
        to_email: '',
      },
      rules: {
        notify_on_success: true,
        notify_on_fail: true,
        notify_connection_error: true,
        notify_auth_error: true,
        channel_telegram: true,
        channel_email: false,
        group_notifications: true,
      },
    };
  }
}

export async function sendTelegramMessage(text: string, customConfig?: TelegramConfig): Promise<{ success: boolean; message: string }> {
  const config = customConfig || getNotificationSettings().telegram;
  if (!config.enabled && !customConfig) {
    return { success: false, message: 'Telegram está desactivado en la configuración' };
  }
  if (!config.bot_token || !config.chat_id) {
    return { success: false, message: 'Bot Token o Chat ID no configurados' };
  }

  try {
    const url = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chat_id,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = (await response.json()) as any;
    if (!response.ok || !data.ok) {
      const err = data.description || `Error ${response.status}`;
      logNotificationDelivery({
        channel: 'telegram',
        event: 'message',
        recipient: config.chat_id,
        status: 'FAILED',
        content: text,
        error_details: err,
      });
      return { success: false, message: err };
    }

    logNotificationDelivery({
      channel: 'telegram',
      event: 'message',
      recipient: config.chat_id,
      status: 'SUCCESS',
      content: text,
    });
    return { success: true, message: 'Mensaje de Telegram enviado con éxito' };
  } catch (err: any) {
    logNotificationDelivery({
      channel: 'telegram',
      event: 'message',
      recipient: config.chat_id,
      status: 'FAILED',
      content: text,
      error_details: err.message,
    });
    return { success: false, message: err.message || 'Error de conexión con Telegram API' };
  }
}

export async function sendEmailMessage(
  subject: string,
  text: string,
  html?: string,
  customConfig?: EmailConfig
): Promise<{ success: boolean; message: string }> {
  const config = customConfig || getNotificationSettings().email;
  if (!config.enabled && !customConfig) {
    return { success: false, message: 'El correo electrónico está desactivado en la configuración' };
  }
  if (!config.smtp_host || !config.to_email) {
    return { success: false, message: 'Servidor SMTP o destinatario no configurados' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: Number(config.smtp_port) || 587,
      secure: config.smtp_secure,
      auth: config.smtp_user
        ? {
            user: config.smtp_user,
            pass: config.smtp_pass,
          }
        : undefined,
    });

    await transporter.sendMail({
      from: `"${config.from_name || 'ELYS'}" <${config.from_email}>`,
      to: config.to_email,
      subject,
      text,
      html: html || `<pre style="font-family: monospace; font-size: 13px;">${text}</pre>`,
    });

    logNotificationDelivery({
      channel: 'email',
      event: 'message',
      recipient: config.to_email,
      status: 'SUCCESS',
      subject,
      content: text,
    });
    return { success: true, message: 'Correo electrónico enviado con éxito' };
  } catch (err: any) {
    logNotificationDelivery({
      channel: 'email',
      event: 'message',
      recipient: config.to_email || 'unknown',
      status: 'FAILED',
      subject,
      content: text,
      error_details: err.message,
    });
    return { success: false, message: err.message || 'Error de conexión SMTP' };
  }
}

export interface TargetExecutionResult {
  destination_name: string;
  os_name?: string;
  status: 'success' | 'failed';
  duration_ms?: number;
  error_details?: string;
}

export async function sendGroupedExecutionSummary(params: {
  task_name: string;
  triggered_by: string;
  results: TargetExecutionResult[];
  started_at: string;
  total_duration_ms: number;
  taskOverride?: {
    notify_telegram?: number;
    notify_email?: number;
    notify_on_success?: number;
    notify_on_fail?: number;
  };
}) {
  const settings = getNotificationSettings();
  const { results, task_name } = params;

  const total = results.length;
  const successes = results.filter((r) => r.status === 'success');
  const failures = results.filter((r) => r.status === 'failed');
  const hasFailures = failures.length > 0;

  // Check alert rules
  const notifyOnSuccess = params.taskOverride?.notify_on_success !== undefined
    ? params.taskOverride.notify_on_success === 1
    : settings.rules.notify_on_success;

  const notifyOnFail = params.taskOverride?.notify_on_fail !== undefined
    ? params.taskOverride.notify_on_fail === 1
    : settings.rules.notify_on_fail;

  if (hasFailures && !notifyOnFail) return;
  if (!hasFailures && !notifyOnSuccess) return;

  const sendTelegram = params.taskOverride?.notify_telegram !== undefined
    ? params.taskOverride.notify_telegram === 1
    : settings.rules.channel_telegram && settings.telegram.enabled;

  const sendEmail = params.taskOverride?.notify_email !== undefined
    ? params.taskOverride.notify_email === 1
    : settings.rules.channel_email && settings.email.enabled;

  const formattedDate = new Date().toLocaleString();

  // 1. Build Telegram Message (HTML)
  let tgMsg = '';
  if (!hasFailures) {
    tgMsg = `<b>⚡ ELYS</b>\n\n` +
      `✅ <b>Ejecución completada</b>\n\n` +
      `<b>Tarea:</b> ${task_name}\n` +
      `<b>Fecha:</b> ${formattedDate}\n` +
      `<b>Duración:</b> ${params.total_duration_ms}ms\n\n` +
      `<b>Resultados:</b>\n` +
      results.map((r) => `✓ ${r.destination_name} (${r.os_name || 'Host'})`).join('\n') +
      `\n\n<b>Total:</b> ${total} ejecutadas, ${successes.length} correctas, 0 fallos`;
  } else {
    tgMsg = `<b>⚡ ELYS</b>\n\n` +
      `⚠️ <b>Ejecución finalizada con incidencias</b>\n\n` +
      `<b>Tarea:</b> ${task_name}\n` +
      `<b>Fecha:</b> ${formattedDate}\n` +
      `<b>Duración:</b> ${params.total_duration_ms}ms\n\n` +
      `<b>Resultados:</b>\n` +
      results.map((r) => (r.status === 'success' ? `✓ ${r.destination_name}` : `✗ ${r.destination_name}`)).join('\n') +
      `\n\n<b>Total:</b> ${total} ejecutadas, ${successes.length} correctas, ${failures.length} fallo(s)\n\n` +
      `<b>Detalle de incidencias:</b>\n` +
      failures.map((f) => `• <b>${f.destination_name}</b>: ${f.error_details || 'Error desconocido'}`).join('\n');
  }

  // 2. Build Email Message
  const subject = hasFailures
    ? `[ELYS] ⚠️ Ejecución con incidencias — ${task_name}`
    : `[ELYS] ✅ Ejecución completada — ${task_name}`;

  const emailText = !hasFailures
    ? `ELYS — ADVANCED TASK SCHEDULER\n\n` +
      `Ejecución completada con éxito.\n` +
      `Tarea: ${task_name}\n` +
      `Fecha: ${formattedDate}\n` +
      `Duración: ${params.total_duration_ms}ms\n\n` +
      `Resultados:\n` +
      results.map((r) => `✓ ${r.destination_name} [${r.os_name || 'Host'}]`).join('\n') +
      `\n\nTotal: ${total} ejecutadas, ${successes.length} correctas, 0 fallos\n`
    : `ELYS — ADVANCED TASK SCHEDULER\n\n` +
      `Ejecución finalizada con incidencias.\n` +
      `Tarea: ${task_name}\n` +
      `Fecha: ${formattedDate}\n` +
      `Duración: ${params.total_duration_ms}ms\n\n` +
      `Resultados:\n` +
      results.map((r) => (r.status === 'success' ? `✓ ${r.destination_name}` : `✗ ${r.destination_name}`)).join('\n') +
      `\n\nTotal: ${total} ejecutadas, ${successes.length} correctas, ${failures.length} fallos\n\n` +
      `Detalle de errores:\n` +
      failures.map((f) => `- ${f.destination_name}: ${f.error_details || 'Error'}`).join('\n');

  if (sendTelegram) {
    await sendTelegramMessage(tgMsg);
  }
  if (sendEmail) {
    await sendEmailMessage(subject, emailText);
  }
}
