import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Zap, ShieldCheck, User, Lock, AlertCircle, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';

export const InitialSetupView: React.FC = () => {
  const { setupAdmin } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin123');
  const [confirmPassword, setConfirmPassword] = useState('Admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Introduce un nombre de usuario para el administrador');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await setupAdmin({
        username: username.trim(),
        password,
      });
    } catch (err: any) {
      setError(err.message || 'Error al inicializar el sistema');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#05070c] cyber-grid-bg relative overflow-hidden">
      {/* Background futuristic glow blobs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[var(--cyber-primary)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-[var(--cyber-accent)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 animate-fade-in">
        <div className="rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Top Decorative Cyber Line */}
          <div className="h-1 bg-gradient-to-r from-transparent via-[var(--cyber-primary)] to-transparent" />

          <div className="p-8 sm:p-10">
            {/* Header / Logo */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[#10192b] border border-[#243656] flex items-center justify-center mb-4 relative group shadow-lg">
                <ShieldCheck className="w-8 h-8 text-[var(--cyber-primary)] animate-pulse" />
                <div className="absolute -inset-1 rounded-2xl bg-[var(--cyber-primary)] opacity-20 blur-sm pointer-events-none" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--cyber-primary)]/10 border border-[var(--cyber-primary)]/30 text-[var(--cyber-primary)] text-xs font-mono mb-2">
                <Sparkles size={13} />
                <span>INSTALACIÓN LIMPIA DETECTADA</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white">
                CONFIGURACIÓN INICIAL DE ELYS
              </h1>
              <p className="text-xs sm:text-sm text-[#8493a8] mt-2 max-w-sm">
                Bienvenido a ELYS. Antes de comenzar, crea el usuario administrador principal.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-[#ff0055]/10 border border-[#ff0055]/30 text-xs text-[#ff5588] flex items-center gap-2 animate-shake">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Field */}
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2 font-mono">
                  Nombre de usuario:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="admin"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-all font-mono"
                  />
                  <User size={16} className="absolute left-3 top-3 text-[#64748b]" />
                </div>
                <span className="text-[11px] text-[#64748b] font-mono mt-1 block">
                  Sugerido por defecto: <strong className="text-white">admin</strong>
                </span>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2 font-mono">
                  Contraseña:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Admin123"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-all font-mono"
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
                <span className="text-[11px] text-[#64748b] font-mono mt-1 block">
                  Contraseña inicial sugerida: <strong className="text-white">Admin123</strong>
                </span>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2 font-mono">
                  Confirmar contraseña:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Admin123"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-all font-mono"
                  />
                  <Lock size={16} className="absolute left-3 top-3 text-[#64748b]" />
                </div>
              </div>

              {/* Notice note */}
              <div className="p-3 rounded-lg bg-[#070a12] border border-[#182338] text-[11px] text-[#8493a8] font-mono">
                <span className="text-[var(--cyber-primary)] font-bold">Aviso de seguridad:</span> La contraseña se almacenará con cifrado unidireccional (bcrypt). Por seguridad, se exigirá cambiarla inmediatamente en el primer acceso.
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[var(--cyber-primary)]/25 group cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>CONFIGURANDO SISTEMA...</span>
                    </div>
                  ) : (
                    <>
                      <span>Crear administrador</span>
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
