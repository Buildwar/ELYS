import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { Credential } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  KeyRound,
  Plus,
  Edit2,
  Trash2,
  Lock,
  User,
  Shield,
  RefreshCw,
  X,
} from 'lucide-react';
import { ConfirmModal } from '../components/modals/ConfirmModal.js';

export const CredentialsView: React.FC = () => {
  const { t } = useTranslation();
  const { isOperator, isAdmin } = useAuth();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [deletingCred, setDeletingCred] = useState<Credential | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<Credential['type']>('ssh_password');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const res = await api.getCredentials();
      setCredentials(res);
    } catch (err) {
      console.error('Failed to load credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  const openCreateModal = () => {
    setEditingCred(null);
    setName('');
    setType('ssh_password');
    setUsername('');
    setSecret('');
    setDomain('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Credential) => {
    setEditingCred(c);
    setName(c.name);
    setType(c.type);
    setUsername(c.username);
    setSecret('••••••••••••');
    setDomain(c.domain || '');
    setDescription(c.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCred) {
        await api.updateCredential(editingCred.id, {
          name,
          type,
          username,
          secret: secret !== '••••••••••••' ? secret : undefined,
          domain,
          description,
        });
      } else {
        await api.createCredential({
          name,
          type,
          username,
          secret,
          domain,
          description,
        });
      }
      setIsModalOpen(false);
      loadCredentials();
    } catch (err: any) {
      alert(err.message || 'Error al guardar credencial');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCred) return;
    try {
      await api.deleteCredential(deletingCred.id);
      loadCredentials();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar credencial');
    } finally {
      setDeletingCred(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090e18] border border-[#1a263c] shadow-lg flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#111928] border border-[#1e2d48] text-[var(--cyber-primary)]">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              {t('credentials.title')}
            </h2>
            <p className="text-xs text-[#8493a8]">{t('credentials.subtitle')}</p>
          </div>
        </div>

        {isOperator && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-[var(--cyber-primary)]/20 cursor-pointer"
          >
            <Plus size={16} />
            <span>{t('credentials.create')}</span>
          </button>
        )}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-[#8493a8]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
          <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
        </div>
      ) : credentials.length === 0 ? (
        <div className="p-16 rounded-2xl bg-[#0c1220] border border-[#1c2a44] text-center text-[#8493a8]">
          <Lock className="w-12 h-12 mx-auto text-[#243552] mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No hay credenciales registradas</h3>
          <p className="text-xs text-[#64748b] max-w-sm mx-auto mb-4 font-mono">
            Almacena contraseñas o claves SSH de forma segura y cifrada para permitir que ELYS ejecute tareas en equipos remotos.
          </p>
          {isOperator && (
            <button
              onClick={() => {
                setEditingCred(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md shadow-[var(--cyber-primary)]/20"
            >
              <Plus size={15} />
              <span>Crear primera credencial</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {credentials.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-2xl bg-[#0c1220] border border-[#1a263c] hover:border-[var(--cyber-primary)]/50 transition-all flex flex-col justify-between group shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#10192a] border border-[#1e2d48] text-[var(--cyber-primary)] shrink-0">
                      <Lock size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors truncate max-w-[170px]">
                        {c.name}
                      </h3>
                      <span className="text-[10px] text-[#64748b] font-mono uppercase block">
                        {t(`credentials.types.${c.type}`)}
                      </span>
                    </div>
                  </div>

                  {isOperator && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1.5 rounded-lg text-[#8493a8] hover:text-white hover:bg-[#121c2e]"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setDeletingCred(c);
                            setIsConfirmDeleteOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-[#8493a8] hover:text-[#ff0055] hover:bg-[#ff0055]/20"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-3 rounded-xl bg-[#070a12] border border-[#162033] space-y-1.5 text-xs font-mono mb-3">
                  <div className="flex items-center justify-between text-[#8493a8]">
                    <span>Usuario:</span>
                    <span className="text-white font-semibold">{c.username}</span>
                  </div>
                  {c.domain && (
                    <div className="flex items-center justify-between text-[#8493a8]">
                      <span>Dominio:</span>
                      <span className="text-[#94a3b8]">{c.domain}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[#8493a8]">
                    <span>Secreto:</span>
                    <span className="text-[var(--cyber-primary)]">••••••••••••</span>
                  </div>
                </div>

                {c.description && (
                  <p className="text-[11px] text-[#64748b] line-clamp-2 mb-3">
                    {c.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-[#162033] flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                <span>Usada en {c.used_in_destinations || 0} destinos</span>
                <span>{c.used_in_tasks || 0} tareas</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credential Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0c1220] border border-[#202e48] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#182338] mb-4">
              <h3 className="text-base font-bold text-white tracking-wide">
                {editingCred ? t('credentials.modal.editTitle') : t('credentials.modal.createTitle')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-[#64748b] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                  {t('credentials.modal.name')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('credentials.modal.namePlaceholder')}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                  {t('credentials.modal.type')}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)]"
                >
                  <option value="winrm_password">WinRM / Windows Password</option>
                  <option value="ssh_password">SSH Password (Linux)</option>
                  <option value="ssh_key">Clave Privada SSH</option>
                  <option value="service_account">Cuenta de Servicio</option>
                  <option value="token">Token de API</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    {t('credentials.modal.username')} *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="administrator o root"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    {t('credentials.modal.domain')}
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="CORP.LOCAL"
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                  {t('credentials.modal.secret')} *
                </label>
                {type === 'ssh_key' ? (
                  <textarea
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    required={!editingCred}
                    rows={3}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono focus:outline-none focus:border-[var(--cyber-primary)] resize-none"
                  />
                ) : (
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    required={!editingCred}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                  {t('credentials.modal.description')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#182338]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#8493a8] hover:text-white"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--cyber-primary)] text-black font-bold hover:bg-[var(--cyber-primary-hover)] cursor-pointer"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        title={t('credentials.deleteConfirmTitle')}
        message={t('credentials.deleteConfirmMessage', { name: deletingCred?.name || '' })}
        onConfirm={handleDeleteConfirm}
        onClose={() => setIsConfirmDeleteOpen(false)}
        isDestructive={true}
      />
    </div>
  );
};
