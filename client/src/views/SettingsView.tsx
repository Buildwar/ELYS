import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme, CyberTheme } from '../context/ThemeContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import {
  AuditLog,
  NotificationSettings,
  NotificationDelivery,
  BackupItem,
  BackupPreview,
} from '../types/index.js';
import {
  Settings as SettingsIcon,
  Palette,
  Globe,
  Sliders,
  Lock,
  Check,
  AlertCircle,
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  User,
  Activity,
  Bell,
  Send,
  Mail,
  Download,
  Upload,
  Database,
  History,
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Square,
  CheckCircle2,
} from 'lucide-react';
import { ConfirmModal } from '../components/modals/ConfirmModal.js';

const THEMES: { id: CyberTheme; name: string; color: string; desc: string }[] = [
  { id: 'cyan', name: 'Cyber Cyan', color: '#00f0ff', desc: 'Identidad cyberpunk pura y luminosa' },
  { id: 'emerald', name: 'Matrix Emerald', color: '#00ff9d', desc: 'Estética terminal clásica de alta legibilidad' },
  { id: 'amber', name: 'Solar Amber', color: '#ffb703', desc: 'Tonalidad cálida futurista' },
  { id: 'magenta', name: 'Synthwave Magenta', color: '#ff007f', desc: 'Contraste retro-futurista' },
  { id: 'violet', name: 'Neon Violet', color: '#a855f7', desc: 'Elegancia eléctrica y sobria' },
];

export const SettingsView: React.FC = () => {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage } = useTheme();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'appearance' | 'preferences' | 'general' | 'security' | 'audit' | 'notifications' | 'backup'
  >('appearance');

  // Preferences
  const [prefTimezone, setPrefTimezone] = useState('UTC');
  const [retentionDays, setRetentionDays] = useState(30);

  // General settings (admin)
  const [siteName, setSiteName] = useState('ELYS');
  const [concurrency, setConcurrency] = useState(5);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditEntityType, setAuditEntityType] = useState('');

  // Notifications State
  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  // Backup & Restore State
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupItem | null>(null);
  const [uploadedBackupPreview, setUploadedBackupPreview] = useState<BackupPreview | null>(null);
  const [uploadedFileRaw, setUploadedFileRaw] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'full' | 'selective'>('full');
  const [restoreSections, setRestoreSections] = useState<string[]>([
    'users',
    'tasks',
    'destinations',
    'credentials',
    'templates',
    'settings',
  ]);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const s = await api.getSettings();
        if (s.preferences) {
          if (s.preferences.timezone) setPrefTimezone(s.preferences.timezone);
          if (s.preferences.retentionDays) setRetentionDays(s.preferences.retentionDays);
        }
        if (s.general) {
          if (s.general.siteName) setSiteName(s.general.siteName);
          if (s.general.concurrencyLimit) setConcurrency(s.general.concurrencyLimit);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const data = await api.getAuditLogs({
        search: auditSearch || undefined,
        action: auditAction || undefined,
        entity_type: auditEntityType || undefined,
        limit: 100,
      });
      setAuditLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const [s, d] = await Promise.all([api.getNotifications(), api.getNotificationDeliveries(30)]);
      setNotifSettings(s);
      setDeliveries(d);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      setBackupLoading(true);
      const list = await api.getBackups();
      setBackups(list);
    } catch (err) {
      console.error('Failed to load backups:', err);
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'notifications') fetchNotifications();
    if (activeTab === 'backup') fetchBackups();
  }, [activeTab, auditSearch, auditAction, auditEntityType]);

  const getActionBadge = (action: string) => {
    switch (action?.toLowerCase()) {
      case 'create':
      case 'created':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30">CREAR</span>;
      case 'update':
      case 'updated':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30">MODIFICAR</span>;
      case 'delete':
      case 'deleted':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#ff0055]/10 text-[#ff0055] border border-[#ff0055]/30">ELIMINAR</span>;
      case 'execute':
      case 'run':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#ffb800]/10 text-[#ffb800] border border-[#ffb800]/30">EJECUTAR</span>;
      case 'restore':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/30">RESTAURAR</span>;
      case 'backup':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30">BACKUP</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#334155]/20 text-[#cbd5e1] border border-[#334155]/50 uppercase">{action}</span>;
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSetting('preferences', {
        defaultLanguage: language,
        timezone: prefTimezone,
        retentionDays: Number(retentionDays),
      });
      setFeedback({ type: 'success', message: 'Preferencias guardadas exitosamente' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error guardando preferencias' });
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSetting('general', {
        siteName,
        concurrencyLimit: Number(concurrency),
      });
      setFeedback({ type: 'success', message: 'Configuración general guardada exitosamente' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error guardando configuración general' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Las nuevas contraseñas no coinciden' });
      return;
    }
    try {
      await api.changePassword({ currentPassword, newPassword });
      setFeedback({ type: 'success', message: 'Contraseña actualizada con éxito' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al actualizar contraseña' });
    }
  };

  // Notification handlers
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifSettings) return;
    try {
      await api.updateNotifications(notifSettings);
      setFeedback({ type: 'success', message: 'Configuración de notificaciones guardada con éxito' });
      setTimeout(() => setFeedback(null), 3000);
      fetchNotifications();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error guardando notificaciones' });
    }
  };

  const handleTestTelegram = async () => {
    if (!notifSettings) return;
    try {
      setTestingTelegram(true);
      const res = await api.testTelegram({
        bot_token: notifSettings.telegram.bot_token,
        chat_id: notifSettings.telegram.chat_id,
      });
      alert(res.message);
      fetchNotifications();
    } catch (err: any) {
      alert(`Error en prueba de Telegram: ${err.message}`);
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestEmail = async () => {
    if (!notifSettings) return;
    try {
      setTestingEmail(true);
      const res = await api.testEmail(notifSettings.email);
      alert(res.message);
      fetchNotifications();
    } catch (err: any) {
      alert(`Error en prueba de Correo: ${err.message}`);
    } finally {
      setTestingEmail(false);
    }
  };

  // Backup handlers
  const handleCreateBackup = async () => {
    try {
      setBackupLoading(true);
      const res = await api.createBackup();
      alert(`Copia de seguridad creada con éxito: ${res.backup.filename}`);
      fetchBackups();
    } catch (err: any) {
      alert(`Error creando backup: ${err.message}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        setUploadedFileRaw(content);
        const preview = await api.validateBackup(content);
        setUploadedBackupPreview(preview);
        setSelectedBackupForRestore(null);
      } catch (err: any) {
        alert(`Archivo de backup inválido: ${err.message}`);
        setUploadedBackupPreview(null);
        setUploadedFileRaw(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    try {
      setRestoring(true);
      const params = {
        backupId: selectedBackupForRestore?.id,
        backupContent: uploadedFileRaw || undefined,
        mode: restoreMode,
        sections: restoreSections,
      };

      const res = await api.restoreBackup(params);
      alert(`¡Restauración exitosa!\n${res.message}\nCopia de seguridad automática previa: ${res.safetyBackup}`);
      setIsConfirmRestoreOpen(false);
      setSelectedBackupForRestore(null);
      setUploadedBackupPreview(null);
      setUploadedFileRaw(null);
      fetchBackups();
    } catch (err: any) {
      alert(`Error en restauración: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`¿Eliminar definitivamente el archivo "${filename}"?`)) return;
    try {
      await api.deleteBackup(filename);
      fetchBackups();
    } catch (err: any) {
      alert(`Error eliminando archivo: ${err.message}`);
    }
  };

  const toggleSection = (sec: string) => {
    setRestoreSections((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] relative overflow-hidden shadow-xl">
        <h1 className="text-xl font-bold font-mono tracking-wide text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-[var(--cyber-primary)]" />
          <span>Configuración del Sistema</span>
        </h1>
        <p className="text-xs text-[#8493a8] mt-1">
          Apariencia, notificaciones, copias de seguridad y opciones administrativas
        </p>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 mt-5 border-b border-[#1b263b] pb-2 flex-wrap">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-[#141d2e] text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/40 shadow-sm'
                : 'text-[#8493a8] hover:text-white'
            }`}
          >
            <Palette size={14} />
            <span>Apariencia</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'preferences'
                ? 'bg-[#141d2e] text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/40 shadow-sm'
                : 'text-[#8493a8] hover:text-white'
            }`}
          >
            <Globe size={14} />
            <span>Preferencias</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-[#141d2e] text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/40 shadow-sm'
                  : 'text-[#8493a8] hover:text-white'
              }`}
            >
              <Bell size={14} />
              <span>Notificaciones y Alertas</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'backup'
                  ? 'bg-[#141d2e] text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/40 shadow-sm'
                  : 'text-[#8493a8] hover:text-white'
              }`}
            >
              <Database size={14} />
              <span>Backup y Restore</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-[#141d2e] text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/40 shadow-sm'
                  : 'text-[#8493a8] hover:text-white'
              }`}
            >
              <Sliders size={14} />
              <span>General</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-[#141d2e] text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/40 shadow-sm'
                : 'text-[#8493a8] hover:text-white'
            }`}
          >
            <Lock size={14} />
            <span>Seguridad</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-[#141d2e] text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/40 shadow-sm'
                  : 'text-[#8493a8] hover:text-white'
              }`}
            >
              <ShieldCheck size={14} />
              <span>Auditoría</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            feedback.type === 'success'
              ? 'bg-[#00ff88]/10 border-[#00ff88]/30 text-[#00ff88]'
              : 'bg-[#ff0055]/10 border-[#ff0055]/30 text-[#ff0055]'
          }`}
        >
          {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Tab: Appearance */}
      {activeTab === 'appearance' && (
        <div className="p-6 rounded-xl bg-[#0e1422] border border-[#1e2b45] space-y-6">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
              Acento de Color Cyberpunk
            </h3>
            <p className="text-xs text-[#8493a8] mb-4">
              Selecciona la paleta luminosa principal para la interfaz de control
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {THEMES.map((th) => (
                <div
                  key={th.id}
                  onClick={() => setTheme(th.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    theme === th.id
                      ? 'border-[var(--cyber-primary)] bg-[var(--cyber-primary)]/10 shadow-lg'
                      : 'border-[#1e2b45] bg-[#070a12] hover:border-[#2d3f66]'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-bold text-black text-xs"
                    style={{ backgroundColor: th.color }}
                  >
                    {theme === th.id && <Check size={16} />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{th.name}</h4>
                    <p className="text-[11px] text-[#8493a8] mt-0.5">{th.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Preferences */}
      {activeTab === 'preferences' && (
        <form onSubmit={handleSavePreferences} className="p-6 rounded-xl bg-[#0e1422] border border-[#1e2b45] space-y-5 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
              Idioma
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLanguage('es')}
                className={`py-2 px-3 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                  language === 'es'
                    ? 'bg-[var(--cyber-primary)]/15 border-[var(--cyber-primary)] text-white font-bold'
                    : 'bg-[#070a12] border-[#1e2b45] text-[#8493a8] hover:text-white'
                }`}
              >
                Español (ES)
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`py-2 px-3 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-[var(--cyber-primary)]/15 border-[var(--cyber-primary)] text-white font-bold'
                    : 'bg-[#070a12] border-[#1e2b45] text-[#8493a8] hover:text-white'
                }`}
              >
                English (US)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
              Zona Horaria
            </label>
            <select
              value={prefTimezone}
              onChange={(e) => setPrefTimezone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
            >
              <option value="UTC">UTC (Universal Coordinated Time)</option>
              <option value="Europe/Madrid">Europe/Madrid (CET / CEST)</option>
              <option value="America/New_York">America/New_York (EST / EDT)</option>
              <option value="America/Mexico_City">America/Mexico_City</option>
              <option value="America/Bogota">America/Bogota</option>
              <option value="America/Buenos_Aires">America/Buenos_Aires</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
              Retención de Historial (Días)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-[var(--cyber-primary)] text-black font-bold text-xs uppercase tracking-wider hover:bg-[var(--cyber-primary-hover)] transition-all cursor-pointer"
            >
              Guardar Preferencias
            </button>
          </div>
        </form>
      )}

      {/* Tab: NOTIFICACIONES Y ALERTAS (Sections 71-83) */}
      {activeTab === 'notifications' && isAdmin && notifSettings && (
        <form onSubmit={handleSaveNotifications} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Telegram Integration Card */}
            <div className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0088cc]/15 border border-[#0088cc]/40 flex items-center justify-center text-[#0088cc]">
                    <Send size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono">Telegram Bot</h3>
                    <p className="text-[11px] text-[#8493a8]">Notificaciones instantáneas vía API de Telegram</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.telegram.enabled}
                    onChange={(e) =>
                      setNotifSettings({
                        ...notifSettings,
                        telegram: { ...notifSettings.telegram, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#1b2842] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--cyber-primary)]"></div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8493a8] mb-1">
                  Bot Token (Token de @BotFather) *
                </label>
                <input
                  type="password"
                  value={notifSettings.telegram.bot_token}
                  onChange={(e) =>
                    setNotifSettings({
                      ...notifSettings,
                      telegram: { ...notifSettings.telegram, bot_token: e.target.value },
                    })
                  }
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8493a8] mb-1">
                  Chat ID / Channel ID *
                </label>
                <input
                  type="text"
                  value={notifSettings.telegram.chat_id}
                  onChange={(e) =>
                    setNotifSettings({
                      ...notifSettings,
                      telegram: { ...notifSettings.telegram, chat_id: e.target.value },
                    })
                  }
                  placeholder="-1001234567890 o 12345678"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={testingTelegram}
                  className="px-3.5 py-2 rounded-lg bg-[#141d2e] hover:bg-[#0088cc] text-[#0088cc] hover:text-white border border-[#0088cc]/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send size={13} className={testingTelegram ? 'animate-spin' : ''} />
                  <span>Enviar Mensaje de Prueba</span>
                </button>
              </div>
            </div>

            {/* Email (SMTP) Integration Card */}
            <div className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#a855f7]/15 border border-[#a855f7]/40 flex items-center justify-center text-[#a855f7]">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono">Correo Electrónico (SMTP)</h3>
                    <p className="text-[11px] text-[#8493a8]">Envío de reportes vía servidor SMTP</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.email.enabled}
                    onChange={(e) =>
                      setNotifSettings({
                        ...notifSettings,
                        email: { ...notifSettings.email, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#1b2842] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--cyber-primary)]"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8493a8] mb-1">Servidor SMTP *</label>
                  <input
                    type="text"
                    value={notifSettings.email.smtp_host}
                    onChange={(e) =>
                      setNotifSettings({
                        ...notifSettings,
                        email: { ...notifSettings.email, smtp_host: e.target.value },
                      })
                    }
                    placeholder="smtp.example.com"
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8493a8] mb-1">Puerto *</label>
                  <input
                    type="number"
                    value={notifSettings.email.smtp_port}
                    onChange={(e) =>
                      setNotifSettings({
                        ...notifSettings,
                        email: { ...notifSettings.email, smtp_port: Number(e.target.value) },
                      })
                    }
                    placeholder="587"
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8493a8] mb-1">Usuario SMTP</label>
                  <input
                    type="text"
                    value={notifSettings.email.smtp_user}
                    onChange={(e) =>
                      setNotifSettings({
                        ...notifSettings,
                        email: { ...notifSettings.email, smtp_user: e.target.value },
                      })
                    }
                    placeholder="notificaciones@corp.com"
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8493a8] mb-1">Contraseña SMTP</label>
                  <input
                    type="password"
                    value={notifSettings.email.smtp_pass}
                    onChange={(e) =>
                      setNotifSettings({
                        ...notifSettings,
                        email: { ...notifSettings.email, smtp_pass: e.target.value },
                      })
                    }
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8493a8] mb-1">Destinatario de Alertas *</label>
                <input
                  type="email"
                  value={notifSettings.email.to_email}
                  onChange={(e) =>
                    setNotifSettings({
                      ...notifSettings,
                      email: { ...notifSettings.email, to_email: e.target.value },
                    })
                  }
                  placeholder="admin@corp.com"
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="px-3.5 py-2 rounded-lg bg-[#141d2e] hover:bg-[#a855f7] text-[#a855f7] hover:text-white border border-[#a855f7]/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Mail size={13} className={testingEmail ? 'animate-spin' : ''} />
                  <span>Enviar Correo de Prueba</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reglas de Notificaciones & Agrupación (Sections 75-78) */}
          <div className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              Reglas y Agrupación Inteligente de Alertas
            </h3>
            <p className="text-xs text-[#8493a8]">
              Controla qué eventos disparan alertas y cómo se consolidan los resúmenes en ejecuciones multi-destino
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-[#070a12] border border-[#162033] cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings.rules.notify_on_success}
                  onChange={(e) =>
                    setNotifSettings({
                      ...notifSettings,
                      rules: { ...notifSettings.rules, notify_on_success: e.target.checked },
                    })
                  }
                  className="rounded text-[var(--cyber-primary)]"
                />
                <span className="text-xs font-mono text-white">Ejecuciones Correctas (OK)</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-[#070a12] border border-[#162033] cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings.rules.notify_on_fail}
                  onChange={(e) =>
                    setNotifSettings({
                      ...notifSettings,
                      rules: { ...notifSettings.rules, notify_on_fail: e.target.checked },
                    })
                  }
                  className="rounded text-[#ff0055]"
                />
                <span className="text-xs font-mono text-white">Ejecuciones Fallidas (Errores)</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-[#070a12] border border-[#162033] cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings.rules.group_notifications}
                  onChange={(e) =>
                    setNotifSettings({
                      ...notifSettings,
                      rules: { ...notifSettings.rules, group_notifications: e.target.checked },
                    })
                  }
                  className="rounded text-[var(--cyber-primary)]"
                />
                <span className="text-xs font-mono text-[var(--cyber-primary)] font-bold">
                  Agrupar notificaciones multi-destino
                </span>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[var(--cyber-primary)] text-black font-bold text-xs uppercase tracking-wider hover:bg-[var(--cyber-primary-hover)] transition-all cursor-pointer"
              >
                Guardar Configuración de Notificaciones
              </button>
            </div>
          </div>

          {/* Delivery Log Table (Section 83) */}
          <div className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <History size={16} className="text-[var(--cyber-primary)]" />
                  <span>Auditoría de Envíos de Notificaciones</span>
                </h3>
                <p className="text-xs text-[#8493a8]">Registro histórico de mensajes enviados a Telegram y Correo</p>
              </div>

              <button
                type="button"
                onClick={fetchNotifications}
                className="p-1.5 rounded-lg bg-[#141d2e] text-[var(--cyber-primary)] hover:text-white"
              >
                <RefreshCw size={14} className={notifLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="rounded-xl border border-[#162033] overflow-hidden">
              {deliveries.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#64748b] font-mono">
                  No hay registros de envíos de notificación recientes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#070a12] text-[#8493a8] border-b border-[#162033]">
                      <tr>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Canal</th>
                        <th className="py-2.5 px-3">Destinatario</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">Detalles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#162033]">
                      {deliveries.map((del) => (
                        <tr key={del.id} className="hover:bg-[#121929]">
                          <td className="py-2 px-3 text-[#94a3b8] whitespace-nowrap">
                            {new Date(del.created_at).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="capitalize px-2 py-0.5 rounded text-[10px] bg-[#141d2e] text-white">
                              {del.channel}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-white whitespace-nowrap">{del.recipient}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                del.status === 'SUCCESS'
                                  ? 'bg-[#00ff88]/10 text-[#00ff88]'
                                  : 'bg-[#ff0055]/10 text-[#ff0055]'
                              }`}
                            >
                              {del.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#8493a8] max-w-sm truncate" title={del.error_details || del.content || ''}>
                            {del.error_details || del.content || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Tab: BACKUP Y RESTORE (Sections 64-70) */}
      {activeTab === 'backup' && isAdmin && (
        <div className="space-y-6">
          {/* Top Actions: Create Backup + Upload Backup */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Backup Card */}
            <div className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-[var(--cyber-primary)]/15 border border-[var(--cyber-primary)]/40 flex items-center justify-center text-[var(--cyber-primary)]">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono">Crear Copia de Seguridad</h3>
                    <p className="text-[11px] text-[#8493a8]">Genera un snapshot estructurado y versionado de ELYS</p>
                  </div>
                </div>

                <p className="text-xs text-[#94a3b8] leading-relaxed mt-3 mb-4">
                  El backup incluye usuarios, tareas, programaciones, destinos, credenciales protegidas, plantillas y ajustes del sistema en formato portable <code>.elysbak</code> (JSON versionado).
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={backupLoading}
                className="w-full py-2.5 rounded-lg bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <Database size={15} />
                <span>Generar Backup Ahora</span>
              </button>
            </div>

            {/* Upload Backup Card */}
            <div className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-[#00ff88]/15 border border-[#00ff88]/40 flex items-center justify-center text-[#00ff88]">
                    <Upload size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono">Restaurar desde Archivo Externo</h3>
                    <p className="text-[11px] text-[#8493a8]">Carga un archivo .elysbak o .json para validación</p>
                  </div>
                </div>

                <p className="text-xs text-[#94a3b8] leading-relaxed mt-3 mb-4">
                  El sistema validará la estructura, versión y consistencia del archivo antes de permitir la restauración, garantizando la seguridad de los datos.
                </p>
              </div>

              <label className="w-full py-2.5 rounded-lg bg-[#141d2e] hover:bg-[#1e2a42] text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 border border-[#233554] transition-all cursor-pointer text-center">
                <Upload size={15} />
                <span>Seleccionar Archivo de Backup</span>
                <input
                  type="file"
                  accept=".json,.elysbak"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Uploaded Backup Preview Banner */}
          {uploadedBackupPreview && (
            <div className="p-6 rounded-2xl bg-[#0e1628] border border-[var(--cyber-primary)] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-[#00ff88]" />
                  <h3 className="text-sm font-bold text-white font-mono">
                    Archivo de Backup Validado con Éxito
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#070a12] text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/40">
                  Formato ELYS v{uploadedBackupPreview.version} (v{uploadedBackupPreview.elys_version})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 rounded-lg bg-[#070a12] border border-[#1b273d]">
                  <span className="text-[10px] text-[#8493a8] block uppercase">Usuarios</span>
                  <span className="text-base font-bold text-white font-mono">{uploadedBackupPreview.summary.users_count}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#070a12] border border-[#1b273d]">
                  <span className="text-[10px] text-[#8493a8] block uppercase">Tareas</span>
                  <span className="text-base font-bold text-white font-mono">{uploadedBackupPreview.summary.tasks_count}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#070a12] border border-[#1b273d]">
                  <span className="text-[10px] text-[#8493a8] block uppercase">Destinos</span>
                  <span className="text-base font-bold text-white font-mono">{uploadedBackupPreview.summary.destinations_count}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#070a12] border border-[#1b273d]">
                  <span className="text-[10px] text-[#8493a8] block uppercase">Credenciales</span>
                  <span className="text-base font-bold text-white font-mono">{uploadedBackupPreview.summary.credentials_count}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#070a12] border border-[#1b273d]">
                  <span className="text-[10px] text-[#8493a8] block uppercase">Plantillas</span>
                  <span className="text-base font-bold text-white font-mono">{uploadedBackupPreview.summary.templates_count}</span>
                </div>
              </div>

              {/* Restore Modes: Completa vs Selectiva (Section 70) */}
              <div className="p-4 rounded-xl bg-[#070a12] border border-[#1b273d] space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-mono text-white cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="full"
                      checked={restoreMode === 'full'}
                      onChange={() => setRestoreMode('full')}
                    />
                    <span>Restauración Completa</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-mono text-white cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="selective"
                      checked={restoreMode === 'selective'}
                      onChange={() => setRestoreMode('selective')}
                    />
                    <span>Restauración Selectiva</span>
                  </label>
                </div>

                {restoreMode === 'selective' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#182338]">
                    {['users', 'tasks', 'destinations', 'credentials', 'templates', 'settings'].map((sec) => (
                      <label key={sec} className="flex items-center gap-2 text-xs font-mono text-[#cbd5e1] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restoreSections.includes(sec)}
                          onChange={() => toggleSection(sec)}
                        />
                        <span className="capitalize">{sec}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Restore Seguro Note */}
              <div className="p-3 rounded-xl bg-[#ffb703]/10 border border-[#ffb703]/30 text-xs text-[#ffb703] flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>
                  <strong>Restore Seguro:</strong> ELYS creará automáticamente un backup de seguridad del estado actual antes de aplicar los datos.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUploadedBackupPreview(null);
                    setUploadedFileRaw(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#141d2e] hover:bg-[#1a253a] text-[#8493a8] text-xs font-mono cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmRestoreOpen(true)}
                  className="px-5 py-2 rounded-lg bg-[#00ff88] hover:bg-[#00e67a] text-black font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <RotateCcw size={14} />
                  <span>Proceder a Restaurar</span>
                </button>
              </div>
            </div>
          )}

          {/* Stored Backups Table */}
          <div className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#182338]">
              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Database size={16} className="text-[var(--cyber-primary)]" />
                  <span>Historial de Backups Disponibles</span>
                </h3>
                <p className="text-xs text-[#8493a8]">Copias de seguridad almacenadas en el volumen persistente</p>
              </div>

              <button
                type="button"
                onClick={fetchBackups}
                className="p-1.5 rounded-lg bg-[#141d2e] text-[var(--cyber-primary)] hover:text-white"
              >
                <RefreshCw size={14} className={backupLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="rounded-xl border border-[#162033] overflow-hidden">
              {backups.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#64748b] font-mono">
                  No hay copias de seguridad almacenadas. Genera una con "Generar Backup Ahora".
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#070a12] text-[#8493a8] border-b border-[#162033]">
                      <tr>
                        <th className="py-2.5 px-3">Archivo</th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Tamaño</th>
                        <th className="py-2.5 px-3">Contenido</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#162033]">
                      {backups.map((b) => (
                        <tr key={b.filename} className="hover:bg-[#121929]">
                          <td className="py-2.5 px-3 text-white font-bold">{b.filename}</td>
                          <td className="py-2.5 px-3 text-[#94a3b8] whitespace-nowrap">
                            {new Date(b.created_at).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                b.type === 'auto_safety'
                                  ? 'bg-[#ffb703]/10 text-[#ffb703] border border-[#ffb703]/30'
                                  : 'bg-[var(--cyber-primary)]/10 text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/30'
                              }`}
                            >
                              {b.type === 'auto_safety' ? 'Auto-Seguridad' : 'Completo'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#8493a8] whitespace-nowrap">
                            {(b.size_bytes / 1024).toFixed(1)} KB
                          </td>
                          <td className="py-2.5 px-3 text-[#8493a8] whitespace-nowrap">
                            {b.summary.tasks_count || 0} tareas • {b.summary.destinations_count || 0} destinos
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Download */}
                              <a
                                href={api.getBackupDownloadUrl(b.filename)}
                                download={b.filename}
                                className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[var(--cyber-primary)] text-[var(--cyber-primary)] hover:text-black transition-colors"
                                title="Descargar backup"
                              >
                                <Download size={13} />
                              </a>

                              {/* Restore this backup */}
                              <button
                                onClick={() => {
                                  setSelectedBackupForRestore(b);
                                  setUploadedBackupPreview({
                                    valid: true,
                                    version: b.version,
                                    elys_version: b.elys_version,
                                    created_at: b.created_at,
                                    created_by: b.created_by,
                                    type: b.type,
                                    summary: {
                                      users_count: b.summary.users_count || 0,
                                      tasks_count: b.summary.tasks_count || 0,
                                      destinations_count: b.summary.destinations_count || 0,
                                      credentials_count: b.summary.credentials_count || 0,
                                      templates_count: b.summary.templates_count || 0,
                                    },
                                  });
                                  setUploadedFileRaw(null);
                                }}
                                className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#00ff88] text-[#00ff88] hover:text-black transition-colors cursor-pointer"
                                title="Restaurar este backup"
                              >
                                <RotateCcw size={13} />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteBackup(b.filename)}
                                className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#ff0055]/20 text-[#8493a8] hover:text-[#ff0055] transition-colors cursor-pointer"
                                title="Eliminar archivo"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Confirm Restore Modal */}
          <ConfirmModal
            isOpen={isConfirmRestoreOpen}
            title="¿Confirmar Restauración de Configuración?"
            message="Esta acción actualizará la base de datos con los datos del backup. Se generará un backup automático de seguridad antes de proceder. ¿Deseas continuar?"
            onConfirm={handleExecuteRestore}
            onClose={() => setIsConfirmRestoreOpen(false)}
            isDestructive={false}
          />
        </div>
      )}

      {/* Tab: General (Admin) */}
      {activeTab === 'general' && isAdmin && (
        <form onSubmit={handleSaveGeneral} className="p-6 rounded-xl bg-[#0e1422] border border-[#1e2b45] space-y-5 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
              Nombre de la Plataforma
            </label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
              Límite de Concurrencia de Tareas
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
            />
          </div>

          <p className="text-xs text-[#64748b]">
            ELYS ejecuta tareas en hilos controlados para evitar saturación de CPU y sockets de red.
          </p>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-[var(--cyber-primary)] text-black font-bold text-xs uppercase tracking-wider hover:bg-[var(--cyber-primary-hover)] transition-all cursor-pointer"
            >
              Guardar Configuración General
            </button>
          </div>
        </form>
      )}

      {/* Tab: Security / Change Password */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} className="p-6 rounded-xl bg-[#0e1422] border border-[#1e2b45] space-y-4 max-w-md">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
            Cambiar Contraseña de Acceso
          </h3>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] mb-1">
              Contraseña Actual *
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] mb-1">
              Nueva Contraseña (mínimo 6 caracteres) *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] mb-1">
              Confirmar Nueva Contraseña *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-[var(--cyber-primary)] text-black font-bold text-xs uppercase tracking-wider hover:bg-[var(--cyber-primary-hover)] transition-all cursor-pointer"
            >
              Actualizar Contraseña
            </button>
          </div>
        </form>
      )}

      {/* Tab: Audit Log (Admin) */}
      {activeTab === 'audit' && isAdmin && (
        <div className="space-y-4">
          {/* Audit Controls & Filters */}
          <div className="p-4 rounded-xl bg-[#0e1422] border border-[#1e2b45] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Buscar por usuario, elemento o detalles..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
              />
              <Search size={14} className="absolute left-3 top-2.5 text-[#64748b]" />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
              >
                <option value="">Todas las Acciones</option>
                <option value="create">Crear</option>
                <option value="update">Modificar</option>
                <option value="delete">Eliminar</option>
                <option value="execute_manual">Ejecución Manual</option>
                <option value="restore">Restauración</option>
              </select>

              <select
                value={auditEntityType}
                onChange={(e) => setAuditEntityType(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
              >
                <option value="">Todas las Entidades</option>
                <option value="task">Tareas</option>
                <option value="destination">Destinos</option>
                <option value="credential">Credenciales</option>
                <option value="backup">Backups</option>
              </select>

              <button
                onClick={fetchAuditLogs}
                className="p-2 rounded-lg bg-[#141d2e] hover:bg-[#1f2b42] text-[var(--cyber-primary)] transition-colors cursor-pointer"
                title="Refrescar auditoría"
              >
                <RefreshCw size={14} className={auditLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="rounded-xl bg-[#0e1422] border border-[#1e2b45] overflow-hidden">
            {auditLoading ? (
              <div className="flex items-center justify-center p-12 text-[#8493a8]">
                <RefreshCw className="w-5 h-5 animate-spin text-[var(--cyber-primary)]" />
                <span className="ml-3 font-mono text-xs">Cargando registros de auditoría...</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center text-[#8493a8] text-xs font-mono">
                No se registraron eventos con los filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e2b45] bg-[#090d16] text-[11px] font-semibold text-[#8493a8] uppercase tracking-wider">
                      <th className="py-3 px-4">Fecha / Hora</th>
                      <th className="py-3 px-4">Acción</th>
                      <th className="py-3 px-4">Entidad</th>
                      <th className="py-3 px-4">Elemento Afectado</th>
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162033] text-xs font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#121929] transition-colors">
                        <td className="py-3 px-4 text-[#94a3b8] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getActionBadge(log.action)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[11px] bg-[#1e293b]/70 border border-[#334155]/60 text-[#cbd5e1] capitalize">
                            {log.entity_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                          {log.entity_name || '—'}
                        </td>
                        <td className="py-3 px-4 text-[var(--cyber-primary)] whitespace-nowrap">
                          @{log.username}
                        </td>
                        <td className="py-3 px-4 text-[#8493a8] max-w-xs truncate" title={log.details || ''}>
                          {log.details || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
