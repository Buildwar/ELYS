import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Shield, Lock, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User, Role } from '../../types/index.js';

interface UserModalProps {
  isOpen: boolean;
  user: User | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({ isOpen, user, onSave, onClose }) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setPassword('');
      setRole(user.role);
      setIsActive(user.is_active === 1);
    } else {
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('operator');
      setIsActive(true);
    }
    setError(null);
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) {
      setError('Nombre de usuario y correo son obligatorios');
      return;
    }

    if (!user && (!password || password.length < 6)) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        username: username.trim(),
        email: email.trim(),
        password: password ? password : undefined,
        role,
        isActive: isActive ? 1 : 0,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-xl bg-[#0e1422] border border-[#202d47] shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[#1e2b45] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#141d2e] border border-[#223352] text-[var(--cyber-primary)]">
              <UserIcon size={18} />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">
              {user ? t('users.modal.editTitle') : t('users.modal.createTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#182338] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#ff0055]/10 border border-[#ff0055]/30 text-xs text-[#ff5588]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
              {t('users.modal.username')} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-colors"
              />
              <UserIcon size={15} className="absolute left-3 top-3 text-[#64748b]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
              {t('users.modal.email')} *
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-colors"
              />
              <Mail size={15} className="absolute left-3 top-3 text-[#64748b]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
              {t('users.modal.password')} {user && <span className="text-[#64748b] font-normal lowercase">{t('users.modal.passwordHint')}</span>}
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!user}
                placeholder={user ? '••••••••' : 'Mínimo 6 caracteres'}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-colors font-mono"
              />
              <Lock size={15} className="absolute left-3 top-3 text-[#64748b]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
              {t('users.modal.role')}
            </label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-colors"
              >
                <option value="admin">{t('roles.admin')}</option>
                <option value="operator">{t('roles.operator')}</option>
                <option value="user">{t('roles.user')}</option>
              </select>
              <Shield size={15} className="absolute left-3 top-3 text-[#64748b]" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="userIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded bg-[#070a12] border-[#1e2b45] text-[var(--cyber-primary)] focus:ring-0 cursor-pointer"
            />
            <label htmlFor="userIsActive" className="text-xs font-semibold text-white cursor-pointer select-none">
              {t('users.modal.isActive')}
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1e2b45] mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8493a8] hover:text-white hover:bg-[#1a2538] transition-colors"
            >
              {t('users.modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-[var(--cyber-primary)] text-black hover:bg-[var(--cyber-primary-hover)] transition-all shadow-md shadow-[var(--cyber-primary)]/20"
            >
              {isSubmitting ? t('common.loading') : t('users.modal.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
