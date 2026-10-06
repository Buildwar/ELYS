import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { KeyRound, Lock, AlertCircle, CheckCircle2, ArrowRight, LogOut, Eye, EyeOff } from 'lucide-react';

export const ChangePasswordView: React.FC = () => {
  const { changePassword, logout, user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('Admin123');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Introduce tu contraseña actual');
      return;
    }

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword === currentPassword) {
      setError('La nueva contraseña debe ser diferente a la contraseña actual');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las nuevas contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
    } catch (err: any) {
      setError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#05070c] cyber-grid-bg relative overflow-hidden">
      {/* Background futuristic glow blobs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-[var(--cyber-primary)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 animate-fade-in">
        <div className="rounded-2xl bg-[#0c1220] border border-[#2b2416] shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Top Decorative Warning Line */}
          <div className="h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

          <div className="p-8 sm:p-10">
            {/* Header / Logo */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[#1a160d] border border-[#42341b] flex items-center justify-center mb-4 relative group shadow-lg">
                <KeyRound className="w-8 h-8 text-amber-400 animate-pulse" />
                <div className="absolute -inset-1 rounded-2xl bg-amber-400 opacity-20 blur-sm pointer-events-none" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono mb-2">
                <Lock size={13} />
                <span>ACCIÓN DE SEGURIDAD OBLIGATORIA</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white">
                CAMBIAR CONTRASEÑA
              </h1>
              <p className="text-xs sm:text-sm text-[#94a3b8] mt-2 max-w-sm">
                Por motivos de seguridad, debes cambiar la contraseña inicial antes de continuar al panel de ELYS.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-[#ff0055]/10 border border-[#ff0055]/30 text-xs text-[#ff5588] flex items-center gap-2 animate-shake">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password Field */}
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2 font-mono">
                  Contraseña actual:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Admin123"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-amber-400 transition-all font-mono"
                  />
                  <Lock size={16} className="absolute left-3 top-3 text-[#64748b]" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#64748b] hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2 font-mono">
                  Nueva contraseña:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Introduce una contraseña segura (mínimo 6 caracteres)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-amber-400 transition-all font-mono"
                  />
                  <Lock size={16} className="absolute left-3 top-3 text-[#64748b]" />
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2 font-mono">
                  Confirmar nueva contraseña:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repite la nueva contraseña"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-amber-400 transition-all font-mono"
                  />
                  <Lock size={16} className="absolute left-3 top-3 text-[#64748b]" />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 group cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>ACTUALIZANDO CONTRASEÑA...</span>
                    </div>
                  ) : (
                    <>
                      <span>Guardar nueva contraseña</span>
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>

              {/* Logout Option */}
              <div className="pt-4 border-t border-[#182338] text-center">
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-[#64748b] hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Cerrar sesión ({user?.username})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
