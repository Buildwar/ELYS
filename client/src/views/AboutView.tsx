import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { AboutData } from '../types/index.js';
import {
  Zap,
  User,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

export const AboutView: React.FC = () => {
  const { t } = useTranslation();
  const [about, setAbout] = useState<AboutData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAbout = async () => {
      try {
        setLoading(true);
        const data = await api.getAbout();
        setAbout(data);
      } catch (err) {
        console.error('Failed to load about data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAbout();
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  if (loading && !about) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8493a8]">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
        <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full pb-8">
      {/* Brand Hero Card */}
      <div className="rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-xl p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--cyber-primary)] to-transparent" />
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[var(--cyber-primary)]/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-[#10192b] border border-[#223555] flex items-center justify-center shrink-0 shadow-lg">
              <Zap className="w-8 h-8 sm:w-9 sm:h-9 text-[var(--cyber-primary)]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white flex items-center gap-3">
                ELYS
              </h1>
              <p className="text-xs font-mono text-[var(--cyber-primary)] tracking-widest uppercase mt-0.5 font-bold">
                Advanced Task Scheduler
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-[#8493a8]">
                <User size={14} className="text-[#94a3b8]" />
                <span>
                  {t('about.developedBy')}:{' '}
                  <strong className="text-white font-semibold">Adrián Palma</strong>
                </span>
              </div>
            </div>
          </div>

          {/* OFFICIAL VERSION BADGE (Section 104: ONLY place where version appears) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#070a12] border border-[#1e2b45] text-left sm:text-right font-mono shrink-0 shadow-inner w-full sm:w-auto">
            <span className="text-[10px] text-[#64748b] uppercase tracking-wider block font-semibold">
              {t('about.versionTitle')} Oficial
            </span>
            <span className="text-xl sm:text-2xl font-black text-[var(--cyber-primary)] text-glow-primary tracking-tight block mt-0.5">
              v{about?.version || '1.0.0'}
            </span>
            <span className="text-[10px] text-[#64748b] block mt-1">
              Publicación: {about?.releaseDate || '2026-10-05'}
            </span>
          </div>
        </div>

        <p className="mt-6 text-xs sm:text-sm text-[#94a3b8] leading-relaxed border-t border-[#182338] pt-5">
          {t('about.description')}
        </p>
      </div>

      {/* System & Architecture Specifications */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0c1220] border border-[#1c2a44] shadow-xl space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
          <HardDrive size={15} className="text-[var(--cyber-primary)]" />
          {t('about.systemInfo')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-[#070a12] border border-[#162033] hover:border-[#223352] transition-colors">
            <span className="text-[#64748b] text-[11px] block">{t('about.engine')}</span>
            <span className="text-white font-semibold block mt-1 truncate">
              ELYS Asynchronous Core
            </span>
            <span className="text-[10px] text-[#00ff88] mt-1 block">5s interval tick loop</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070a12] border border-[#162033] hover:border-[#223352] transition-colors">
            <span className="text-[#64748b] text-[11px] block">{t('about.database')}</span>
            <span className="text-white font-semibold block mt-1 truncate">
              {about?.database || 'SQLite (WAL Mode)'}
            </span>
            <span className="text-[10px] text-[#8493a8] mt-1 block">Persistencia transaccional local</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070a12] border border-[#162033] hover:border-[#223352] transition-colors">
            <span className="text-[#64748b] text-[11px] block">{t('about.nodeVersion')}</span>
            <span className="text-white font-semibold block mt-1 truncate">
              Node.js {about?.nodeVersion || 'v24.21.0'}
            </span>
            <span className="text-[10px] text-[#8493a8] mt-1 block">Express + TypeScript</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070a12] border border-[#162033] hover:border-[#223352] transition-colors">
            <span className="text-[#64748b] text-[11px] block">{t('about.platform')}</span>
            <span className="text-white font-semibold block mt-1 capitalize truncate">
              {about?.platform || 'win32'}
            </span>
            <span className="text-[10px] text-[#8493a8] mt-1 block">Contenedor / Bare-metal</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070a12] border border-[#162033] hover:border-[#223352] transition-colors">
            <span className="text-[#64748b] text-[11px] block">{t('about.uptime')}</span>
            <span className="text-[var(--cyber-primary)] font-semibold block mt-1 truncate">
              {about ? formatUptime(about.uptimeSeconds) : '0s'}
            </span>
            <span className="text-[10px] text-[#8493a8] mt-1 block">Proceso del servidor activo</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070a12] border border-[#162033] hover:border-[#223352] transition-colors">
            <span className="text-[#64748b] text-[11px] block">{t('about.license')}</span>
            <span className="text-white font-semibold block mt-1 truncate">
              Adrián Palma
            </span>
            <span className="text-[10px] text-[#00ff88] mt-1 block">Todos los derechos reservados</span>
          </div>
        </div>
      </div>
    </div>
  );
};
