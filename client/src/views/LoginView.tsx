import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { OrbitalSymbol } from '../components/brand/ElysLogo.js';

export const LoginView: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ username, password });
    } catch (err: any) {
      setError(err.message || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#05070c] cyber-grid-bg relative overflow-hidden">
      {/* Background futuristic glow blobs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[var(--cyber-primary)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-[var(--cyber-accent)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Terminal frame header */}
        <div className="rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Top Decorative Cyber Line */}
          <div className="h-1 bg-gradient-to-r from-transparent via-[var(--cyber-primary)] to-transparent" />

          <div className="p-8">
            {/* Official Orbital Logo */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative group mb-4">
                <OrbitalSymbol size={80} className="drop-shadow-[0_0_20px_rgba(0,240,255,0.45)] transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute -inset-2 rounded-full bg-[var(--cyber-primary)] opacity-15 blur-lg pointer-events-none -z-10" />
              </div>
              <h1 className="text-3xl font-black font-mono tracking-wider text-white flex items-center gap-1.5">
                <span>ELY<span className="text-[var(--cyber-primary)] text-glow-primary">S</span></span>
              </h1>
              <p className="text-[11px] font-mono text-[#8493a8] tracking-[0.25em] uppercase mt-1">
                Advanced Task Scheduler
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-[#ff0055]/10 border border-[#ff0055]/30 text-xs text-[#ff5588] flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
                  {t('auth.username')}
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-all font-mono"
                  />
                  <Lock size={16} className="absolute left-3 top-3 text-[#64748b]" />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[var(--cyber-primary)]/25 group cursor-pointer"
                >
                  {loading ? (
                    <span>{t('common.loading')}</span>
                  ) : (
                    <>
                      <span>{t('auth.loginButton')}</span>
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick system notice */}
            <div className="mt-6 pt-5 border-t border-[#192336] text-center">
              <span className="text-[11px] text-[#64748b] block font-mono">
                ELYS Advanced Task Scheduler • Acceso Seguro
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
