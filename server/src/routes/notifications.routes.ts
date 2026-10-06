import { Router } from 'express';
import { db, logAudit } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import {
  getNotificationSettings,
  sendTelegramMessage,
  sendEmailMessage,
  NotificationSettings,
} from '../notifications/index.js';

const router = Router();

// Only Admin and Operator can manage notifications
router.use(requireAuth, requireRole(['admin', 'operator']));

// GET notification settings (masking secrets)
router.get(['/', '/settings'], (req, res) => {
  const settings = getNotificationSettings();

  const masked: NotificationSettings = {
    ...settings,
    telegram: {
      ...settings.telegram,
      bot_token: settings.telegram.bot_token ? '••••••••••••' : '',
    },
    email: {
      ...settings.email,
      smtp_pass: settings.email.smtp_pass ? '••••••••••••' : '',
    },
  };

  return res.json(masked);
});

// UPDATE notification settings
router.put(['/', '/settings'], (req: AuthenticatedRequest, res) => {
  const current = getNotificationSettings();
  const { telegram, email, rules } = req.body;

  let finalBotToken = current.telegram.bot_token;
  if (telegram?.bot_token && telegram.bot_token !== '••••••••••••') {
    finalBotToken = telegram.bot_token;
  }

  let finalSmtpPass = current.email.smtp_pass;
  if (email?.smtp_pass && email.smtp_pass !== '••••••••••••') {
    finalSmtpPass = email.smtp_pass;
  }

  const updated: NotificationSettings = {
    telegram: {
      enabled: telegram?.enabled ?? current.telegram.enabled,
      bot_token: finalBotToken,
      chat_id: telegram?.chat_id ?? current.telegram.chat_id,
    },
    email: {
      enabled: email?.enabled ?? current.email.enabled,
      smtp_host: email?.smtp_host ?? current.email.smtp_host,
      smtp_port: Number(email?.smtp_port) || current.email.smtp_port,
      smtp_secure: email?.smtp_secure ?? current.email.smtp_secure,
      smtp_user: email?.smtp_user ?? current.email.smtp_user,
      smtp_pass: finalSmtpPass,
      from_email: email?.from_email ?? current.email.from_email,
      from_name: email?.from_name ?? current.email.from_name,
      to_email: email?.to_email ?? current.email.to_email,
    },
    rules: {
      notify_on_success: rules?.notify_on_success ?? current.rules.notify_on_success,
      notify_on_fail: rules?.notify_on_fail ?? current.rules.notify_on_fail,
      notify_connection_error: rules?.notify_connection_error ?? current.rules.notify_connection_error,
      notify_auth_error: rules?.notify_auth_error ?? current.rules.notify_auth_error,
      channel_telegram: rules?.channel_telegram ?? current.rules.channel_telegram,
      channel_email: rules?.channel_email ?? current.rules.channel_email,
      group_notifications: rules?.group_notifications ?? current.rules.group_notifications,
    },
  };

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES ('notifications', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(JSON.stringify(updated), now);

  logAudit({
    action: 'update',
    entity_type: 'setting',
    entity_name: 'notifications',
    user_id: req.user?.id,
    username: req.user?.username || 'user',
    details: 'Configuración de notificaciones actualizada',
    ip_address: req.ip,
  });

  return res.json({ message: 'Configuración guardada exitosamente' });
});

// TEST Telegram
router.post('/test/telegram', async (req: AuthenticatedRequest, res) => {
  const { bot_token, chat_id } = req.body;
  const current = getNotificationSettings().telegram;

  const configToTest = {
    enabled: true,
    bot_token: (bot_token && bot_token !== '••••••••••••') ? bot_token : current.bot_token,
    chat_id: chat_id || current.chat_id,
  };

  const testMessage = `<b>⚡ ELYS — ADVANCED TASK SCHEDULER</b>\n\n` +
    `✅ <i>Mensaje de prueba de integración</i>\n` +
    `La comunicación entre ELYS y Telegram funciona correctamente.\n\n` +
    `<b>Hora:</b> ${new Date().toLocaleString()}\n` +
    `<b>Operador:</b> @${req.user?.username || 'admin'}`;

  const result = await sendTelegramMessage(testMessage, configToTest);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  return res.json({ success: true, message: 'Mensaje de prueba de Telegram enviado exitosamente' });
});

// TEST Email (SMTP)
router.post('/test/email', async (req: AuthenticatedRequest, res) => {
  const current = getNotificationSettings().email;
  const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, from_email, from_name, to_email } = req.body;

  const configToTest = {
    enabled: true,
    smtp_host: smtp_host || current.smtp_host,
    smtp_port: Number(smtp_port) || current.smtp_port,
    smtp_secure: smtp_secure ?? current.smtp_secure,
    smtp_user: smtp_user !== undefined ? smtp_user : current.smtp_user,
    smtp_pass: (smtp_pass && smtp_pass !== '••••••••••••') ? smtp_pass : current.smtp_pass,
    from_email: from_email || current.from_email,
    from_name: from_name || current.from_name,
    to_email: to_email || current.to_email,
  };

  const subject = '[ELYS] Verificación de Configuración de Correo Electrónico';
  const text = `ELYS — ADVANCED TASK SCHEDULER\n\n` +
    `Este es un mensaje de prueba para verificar que la configuración de correo SMTP funciona correctamente.\n\n` +
    `Fecha: ${new Date().toLocaleString()}\n` +
    `Remitente: ${configToTest.from_name} <${configToTest.from_email}>\n` +
    `Destinatario: ${configToTest.to_email}\n`;

  const result = await sendEmailMessage(subject, text, undefined, configToTest);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  return res.json({ success: true, message: `Correo de prueba enviado exitosamente a ${configToTest.to_email}` });
});

// GET Notification Deliveries Audit Log
router.get('/deliveries', (req, res) => {
  const { limit = 50 } = req.query;
  const deliveries = db.prepare(`
    SELECT * FROM notification_deliveries ORDER BY created_at DESC LIMIT ?
  `).all(Number(limit) || 50);

  return res.json(deliveries);
});

export default router;
