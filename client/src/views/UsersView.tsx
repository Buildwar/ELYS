import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { User } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { UserModal } from '../components/modals/UserModal.js';
import { ConfirmModal } from '../components/modals/ConfirmModal.js';

export const UsersView: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getUsers();
      setUsers(res);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSave = async (data: any) => {
    if (editingUser) {
      await api.updateUser(editingUser.id, data);
    } else {
      await api.createUser(data);
    }
    loadUsers();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    try {
      await api.deleteUser(deletingUser.id);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar usuario');
    } finally {
      setDeletingUser(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#ff0055]/10 text-[#ff0055] border border-[#ff0055]/30">
            {t('roles.admin')}
          </span>
        );
      case 'operator':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[var(--cyber-primary)]/10 text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/30">
            {t('roles.operator')}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#8493a8]/10 text-[#8493a8] border border-[#8493a8]/30">
            {t('roles.user')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="p-4 rounded-xl bg-[#0e1422] border border-[#1e2b45] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[var(--cyber-primary)]" />
          <h2 className="text-sm font-bold text-white tracking-wide">
            {t('users.title')}
          </h2>
          <span className="text-xs text-[#64748b] font-mono ml-2">({users.length} usuarios)</span>
        </div>

        <button
          onClick={() => {
            setEditingUser(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 rounded-lg bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-[var(--cyber-primary)]/20 cursor-pointer"
        >
          <Plus size={16} />
          <span>{t('users.createUser')}</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-xl bg-[#0e1422] border border-[#1e2b45] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-[#8493a8]">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
            <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1e2b45] bg-[#090d16] text-[11px] font-semibold text-[#8493a8] uppercase tracking-wider">
                  <th className="py-3 px-4">{t('users.username')}</th>
                  <th className="py-3 px-4">{t('users.email')}</th>
                  <th className="py-3 px-4">{t('users.role')}</th>
                  <th className="py-3 px-4">{t('users.status')}</th>
                  <th className="py-3 px-4">Fecha Creación</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162033] text-xs">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#121929] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#182338] border border-[#223352] flex items-center justify-center font-mono text-xs text-[var(--cyber-primary)]">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <span>{u.username}</span>
                      {currentUser?.id === u.id && (
                        <span className="text-[10px] text-[var(--cyber-primary)] font-mono">(Tú)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#8493a8] font-mono">{u.email}</td>
                    <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>
                    <td className="py-3.5 px-4">
                      {u.is_active === 1 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#00ff88]">
                          <CheckCircle2 size={13} /> {t('users.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#ff0055]">
                          <XCircle size={13} /> {t('users.inactive')}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#64748b] font-mono">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#1f2b42] text-[#8493a8] hover:text-white transition-colors"
                          title={t('users.edit')}
                        >
                          <Edit2 size={14} />
                        </button>

                        {currentUser?.id !== u.id && (
                          <button
                            onClick={() => {
                              setDeletingUser(u);
                              setIsConfirmDeleteOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#ff0055]/20 text-[#8493a8] hover:text-[#ff0055] transition-colors"
                            title={t('users.delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Modal */}
      <UserModal
        isOpen={isModalOpen}
        user={editingUser}
        onSave={handleSave}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        title={t('users.deleteConfirmTitle')}
        message={t('users.deleteConfirmMessage', { username: deletingUser?.username || '' })}
        onConfirm={handleDeleteConfirm}
        onClose={() => setIsConfirmDeleteOpen(false)}
        isDestructive={true}
      />
    </div>
  );
};
