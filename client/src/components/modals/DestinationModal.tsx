import React, { useState, useEffect } from 'react';
import { X, Server, Shield, Radio, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Destination, Credential, SystemType, ConnectionMethod } from '../../types/index.js';
import { api } from '../../services/api.js';

interface DestinationModalProps {
  isOpen: boolean;
  destination: Destination | null;
  credentials: Credential[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

const OS_PRESETS: Record<SystemType, string[]> = {
  windows_server: [
    'Windows Server 2025',
    'Windows Server 2022',
    'Windows Server 2019',
    'Windows Server 2016',
  ],
  windows_desktop: ['Windows 11', 'Windows 10', 'Windows 10 Enterprise'],
  linux: ['Ubuntu 24.04 LTS', 'Ubuntu 22.04 LTS', 'Debian 12', 'Rocky Linux 9', 'RHEL 9', 'AlmaLinux 9', 'CentOS Stream', 'Fedora', 'SUSE Linux Enterprise'],
  bsd: ['FreeBSD 14', 'OpenBSD 7', 'NetBSD'],
  other: ['Synology DSM', 'QNAP QTS', 'Proxmox VE', 'TrueNAS', 'ESXi'],
};

export const DestinationModal: React.FC<DestinationModalProps> = ({
  isOpen,
  destination,
  credentials,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [systemType, setSystemType] = useState<SystemType>('linux');
  const [osName, setOsName] = useState('Ubuntu 24.04 LTS');
  const [osVersion, setOsVersion] = useState('');
  const [category, setCategory] = useState('Linux');
  const [description, setDescription] = useState('');
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('ssh');
  const [credentialId, setCredentialId] = useState('');
  const [port, setPort] = useState('22');
  const [domain, setDomain] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (destination) {
      setName(destination.name);
      setHostname(destination.hostname);
      setIpAddress(destination.ip_address || '');
      setSystemType(destination.system_type);
      setOsName(destination.os_name);
      setOsVersion(destination.os_version || '');
      setCategory(destination.category || 'Servidor');
      setDescription(destination.description || '');
      setConnectionMethod(destination.connection_method);
      setCredentialId(destination.credential_id || '');
      setPort(destination.port ? String(destination.port) : (destination.connection_method === 'ssh' ? '22' : '5985'));
      setDomain(destination.domain || '');
      setIsActive(destination.is_active === 1);

      try {
        const parsedTags = JSON.parse(destination.tags || '[]');
        setTagsInput(Array.isArray(parsedTags) ? parsedTags.join(', ') : '');
      } catch {
        setTagsInput(destination.tags || '');
      }
    } else {
      setName('');
      setHostname('');
      setIpAddress('');
      setSystemType('linux');
      setOsName('Ubuntu 24.04 LTS');
      setOsVersion('');
      setCategory('Linux');
      setDescription('');
      setConnectionMethod('ssh');
      setCredentialId(credentials.length > 0 ? credentials[0].id : '');
      setPort('22');
      setDomain('');
      setTagsInput('');
      setIsActive(true);
    }
    setError(null);
    setTestResult(null);
  }, [destination, isOpen, credentials]);

  if (!isOpen) return null;

  const handleSystemTypeChange = (newType: SystemType) => {
    setSystemType(newType);
    const presets = OS_PRESETS[newType];
    if (presets && presets.length > 0) {
      setOsName(presets[0]);
    }
    if (newType === 'windows_server' || newType === 'windows_desktop') {
      setConnectionMethod('winrm');
      setPort('5985');
      setCategory(newType === 'windows_server' ? 'Windows Server' : 'Windows Desktop');
    } else {
      setConnectionMethod('ssh');
      setPort('22');
      setCategory(newType === 'linux' ? 'Linux' : newType === 'bsd' ? 'BSD' : 'Dispositivo');
    }
  };

  const handleTestConnection = async () => {
    if (!destination?.id) {
      setTestResult({
        success: true,
        message: `Sintaxis válida para ${name || hostname} con puerto ${port} (${connectionMethod.toUpperCase()}). Guarda el destino para pruebas activas.`,
      });
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await api.testDestination(destination.id);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error de conexión' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !hostname.trim() || !osName.trim()) {
      setError('El nombre identificador, hostname y sistema operativo son obligatorios');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        hostname: hostname.trim(),
        ip_address: ipAddress.trim() || null,
        system_type: systemType,
        os_name: osName.trim(),
        os_version: osVersion.trim() || null,
        category: category.trim() || 'Servidor',
        description: description.trim() || null,
        is_active: isActive ? 1 : 0,
        connection_method: connectionMethod,
        credential_id: credentialId || null,
        port: port ? Number(port) : null,
        domain: domain.trim() || null,
        tags,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar destino');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0c1220] border border-[#202e48] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#182338] bg-[#070a12]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#111928] border border-[#1e2d48] text-[var(--cyber-primary)]">
              <Server size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {destination ? t('destinations.modal.editTitle') : t('destinations.modal.createTitle')}
              </h3>
              <p className="text-xs text-[#8493a8]">Configurar equipo y método de conexión para ejecución de tareas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#182338] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-[#ff0055]/10 border border-[#ff0055]/30 text-xs text-[#ff5588] flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {testResult && (
          <div
            className={`mx-6 mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88]'
                : 'bg-[#ff0055]/10 border border-[#ff0055]/30 text-[#ff5588]'
            }`}
          >
            {testResult.success ? <Check size={15} /> : <AlertCircle size={15} />}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* System Classification Tabs */}
          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
              {t('destinations.modal.systemType')} *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(['windows_server', 'windows_desktop', 'linux', 'bsd', 'other'] as SystemType[]).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => handleSystemTypeChange(st)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    systemType === st
                      ? 'bg-[var(--cyber-card)] border-[var(--cyber-primary)] text-white shadow-sm'
                      : 'bg-[#070a12] border-[#182338] text-[#8493a8] hover:text-white'
                  }`}
                >
                  {t(`destinations.systems.${st}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Host Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
                {t('destinations.modal.name')} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('destinations.modal.namePlaceholder')}
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
                {t('destinations.modal.hostname')} *
              </label>
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder={t('destinations.modal.hostnamePlaceholder')}
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
                {t('destinations.modal.ip')}
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.1.10"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
                {t('destinations.modal.category')}
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Windows Server, Linux, NAS, VM..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] transition-colors"
              />
            </div>
          </div>

          {/* OS Details with Presets */}
          <div className="p-4 rounded-xl bg-[#090d16] border border-[#182338] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase mb-1">
                  {t('destinations.modal.osName')} *
                </label>
                <input
                  type="text"
                  value={osName}
                  onChange={(e) => setOsName(e.target.value)}
                  placeholder={t('destinations.modal.osNamePlaceholder')}
                  required
                  className="w-full px-3.5 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase mb-1">
                  {t('destinations.modal.osVersion')}
                </label>
                <input
                  type="text"
                  value={osVersion}
                  onChange={(e) => setOsVersion(e.target.value)}
                  placeholder={t('destinations.modal.osVersionPlaceholder')}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
                />
              </div>
            </div>

            {/* Quick OS Presets Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-[#64748b] font-mono">Sugerencias:</span>
              {OS_PRESETS[systemType]?.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setOsName(preset)}
                  className="px-2 py-0.5 rounded bg-[#101726] hover:bg-[#182338] text-[10px] font-mono text-[#8493a8] hover:text-[var(--cyber-primary)] border border-[#1b263b] transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Connection Protocol & Credentials */}
          <div className="p-4 rounded-xl bg-[#090d16] border border-[#182338] space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Radio size={14} className="text-[var(--cyber-primary)]" />
              Parámetros de Conexión y Autenticación
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] mb-1">
                  {t('destinations.modal.connectionMethod')}
                </label>
                <select
                  value={connectionMethod}
                  onChange={(e) => {
                    const m = e.target.value as ConnectionMethod;
                    setConnectionMethod(m);
                    setPort(m === 'ssh' ? '22' : m === 'winrm' || m === 'ps_remoting' ? '5985' : '');
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)]"
                >
                  <option value="ssh">SSH (Linux / Unix)</option>
                  <option value="winrm">WinRM (Windows)</option>
                  <option value="ps_remoting">PowerShell Remoting</option>
                  <option value="local">Local (Host ELYS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8493a8] mb-1">
                  {t('destinations.modal.credential')}
                </label>
                <select
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)]"
                >
                  <option value="">{t('destinations.modal.noCredential')}</option>
                  {credentials.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8493a8] mb-1">
                  {t('destinations.modal.port')}
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] mb-1">
                  {t('destinations.modal.domain')}
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="CORP.LOCAL"
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] mb-1">
                  {t('destinations.modal.tags')}
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="produccion, sql, dmz"
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] mb-1">
              {t('destinations.modal.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Notas y ámbito de este equipo..."
              className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] resize-none"
            />
          </div>

          {/* Active Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="destIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded bg-[#070a12] border-[#1e2b45] text-[var(--cyber-primary)] focus:ring-0 cursor-pointer"
            />
            <label htmlFor="destIsActive" className="text-xs font-semibold text-white cursor-pointer select-none">
              {t('destinations.modal.active')}
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#182338]">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3.5 py-2 rounded-xl bg-[#141e30] hover:bg-[#1c2a44] text-[var(--cyber-primary)] border border-[#202e48] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
              <span>{t('destinations.modal.test')}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8493a8] hover:text-white hover:bg-[#1a2538] transition-colors"
              >
                {t('destinations.modal.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--cyber-primary)] text-black hover:bg-[var(--cyber-primary-hover)] transition-all shadow-md shadow-[var(--cyber-primary)]/20 cursor-pointer"
              >
                {isSubmitting ? t('common.loading') : t('destinations.modal.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
