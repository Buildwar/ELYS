import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { DashboardData, Execution, Task, Destination } from '../types/index.js';
import {
  Clock,
  Play,
  Terminal,
  AlertTriangle,
  RefreshCw,
  Plus,
  Server,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ExternalLink,
  Layers,
  Monitor,
  Cpu,
  HardDrive,
  Pause,
  PauseCircle,
  PlayCircle,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import { ExecutionDetailsModal } from '../components/modals/ExecutionDetailsModal.js';

interface DashboardViewProps {
  onNavigate: (tab: string, filter?: any) => void;
  onOpenNewTask: () => void;
  onOpenNewDestination: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewTask,
  onOpenNewDestination,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [isSchedulerPaused, setIsSchedulerPaused] = useState(false);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [res, destRes, schedStatus] = await Promise.all([
        api.getDashboard(),
        api.getDestinations(),
        api.getSchedulerStatus().catch(() => ({ paused: false })),
      ]);
      setData(res);
      setDestinations(destRes);
      if (schedStatus) {
        setIsSchedulerPaused(Boolean((schedStatus as any).isPaused ?? (schedStatus as any).paused));
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleScheduler = async () => {
    try {
      setSchedulerLoading(true);
      if (isSchedulerPaused) {
        await api.resumeScheduler();
        setIsSchedulerPaused(false);
      } else {
        await api.pauseScheduler();
        setIsSchedulerPaused(true);
      }
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado del scheduler');
    } finally {
      setSchedulerLoading(false);
    }
  };

  const handleManualRun = async (taskId: string) => {
    try {
      setRunningTaskId(taskId);
      await api.executeTaskManual(taskId);
      setTimeout(fetchDashboard, 1200);
    } catch (err: any) {
      alert(err.message || 'Error al ejecutar tarea');
    } finally {
      setTimeout(() => setRunningTaskId(null), 1500);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8493a8]">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
        <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalTasks: 0,
    activeTasks: 0,
    disabledTasks: 0,
    totalDestinations: 0,
    totalExecutions: 0,
    successCount: 0,
    failedCount: 0,
    runningCount: 0,
  };

  return (
    <div className="space-y-6">
      {/* Global Scheduler Paused Warning Banner */}
      {isSchedulerPaused && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <PauseCircle size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-200">
                ELYS SCHEDULER EN PAUSA GLOBAL
              </h3>
              <p className="text-xs text-amber-300/80">
                La ejecución automática de todas las tareas está temporalmente suspendida. Las tareas no se dispararán hasta reanudar.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleScheduler}
            disabled={schedulerLoading}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md"
          >
            <PlayCircle size={15} />
            <span>Reanudar Scheduler</span>
          </button>
        </div>
      )}

      {/* 1. Control Header & Quick Actions Toolbar + Secondary Minimal Status Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090e18] border border-[#1a263c] shadow-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenNewTask}
            className="px-3.5 py-2 rounded-xl bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-[var(--cyber-primary)]/20 cursor-pointer"
          >
            <Plus size={15} />
            <span>{t('dashboard.newTask')}</span>
          </button>

          <button
            onClick={() => onNavigate('tasks')}
            className="px-3.5 py-2 rounded-xl bg-[#111928] hover:bg-[#1a2538] text-white border border-[#202e48] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Play size={13} className="text-[var(--cyber-primary)]" />
            <span>{t('dashboard.runTask')}</span>
          </button>

          <button
            onClick={onOpenNewDestination}
            className="px-3.5 py-2 rounded-xl bg-[#111928] hover:bg-[#1a2538] text-white border border-[#202e48] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Server size={13} className="text-[var(--cyber-success)]" />
            <span>{t('dashboard.newDestination')}</span>
          </button>

          <button
            onClick={() => onNavigate('calendar')}
            className="px-3.5 py-2 rounded-xl bg-[#111928] hover:bg-[#1a2538] text-[#94a3b8] hover:text-white border border-[#202e48] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Calendar size={13} />
            <span>{t('dashboard.viewCalendar')}</span>
          </button>

          <button
            onClick={() => onNavigate('executions')}
            className="px-3.5 py-2 rounded-xl bg-[#111928] hover:bg-[#1a2538] text-[#94a3b8] hover:text-white border border-[#202e48] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Terminal size={13} />
            <span>{t('dashboard.viewExecutions')}</span>
          </button>

          {/* Scheduler pause toggle button */}
          <button
            onClick={handleToggleScheduler}
            disabled={schedulerLoading}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isSchedulerPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-[#111928] text-[#8493a8] border-[#202e48] hover:text-white hover:bg-[#1a2538]'
            }`}
            title={isSchedulerPaused ? 'Reanudar Scheduler' : 'Pausar Scheduler Global'}
          >
            {isSchedulerPaused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
            <span>{isSchedulerPaused ? 'Scheduler en Pausa' : 'Pausar Scheduler'}</span>
          </button>
        </div>

        {/* Secondary Discreet Counters (Not 4 big cards!) */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#060910] border border-[#162033] text-xs font-mono self-start lg:self-auto overflow-x-auto max-w-full">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isSchedulerPaused ? 'bg-amber-400' : 'bg-[var(--cyber-success)]'}`} />
            <span className="text-white font-bold">{metrics.activeTasks}</span>
            <span className="text-[#64748b] text-[11px]">activas</span>
          </div>
          {metrics.pausedTasks !== undefined && metrics.pausedTasks > 0 && (
            <>
              <span className="text-[#202e48]">|</span>
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="font-bold">{metrics.pausedTasks}</span>
                <span className="text-[#64748b] text-[11px]">pausadas</span>
              </div>
            </>
          )}
          {metrics.runningCount > 0 && (
            <>
              <span className="text-[#202e48]">|</span>
              <div className="flex items-center gap-1.5 text-[var(--cyber-primary)] animate-pulse">
                <span className="font-bold">{metrics.runningCount}</span>
                <span className="text-[11px]">en curso</span>
              </div>
            </>
          )}
          <span className="text-[#202e48]">|</span>
          <div className="flex items-center gap-1.5">
            <Server size={12} className="text-[var(--cyber-primary)]" />
            <span className="text-white font-bold">{destinations.length}</span>
            <span className="text-[#64748b] text-[11px]">destinos</span>
          </div>
          <span className="text-[#202e48]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#94a3b8] font-bold">{metrics.totalExecutions}</span>
            <span className="text-[#64748b] text-[11px]">ejecuciones</span>
          </div>
          {metrics.failedCount > 0 && (
            <>
              <span className="text-[#202e48]">|</span>
              <div className="flex items-center gap-1.5 text-[#ff0055]">
                <span className="font-bold">{metrics.failedCount}</span>
                <span className="text-[11px]">fallos</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Clean Installation Hero Welcome & Quick Start Guide */}
      {metrics.totalTasks === 0 && destinations.length === 0 && (
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#0c1322] to-[#070b14] border border-[#1e2f4f] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--cyber-primary)]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--cyber-primary)]/10 border border-[var(--cyber-primary)]/30 flex items-center justify-center text-[var(--cyber-primary)]">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black font-mono tracking-wide text-white">
                  ELYS está listo.
                </h2>
                <p className="text-xs sm:text-sm text-[#8493a8] mt-0.5">
                  Todavía no tienes ninguna tarea configurada. Puedes comenzar creando tu primera tarea.
                </p>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-3 flex-wrap mt-5 mb-8">
              <button
                onClick={onOpenNewTask}
                className="px-4 py-2.5 rounded-xl bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-[var(--cyber-primary)]/20 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Crear primera tarea</span>
              </button>
              <button
                onClick={onOpenNewDestination}
                className="px-4 py-2.5 rounded-xl bg-[#111928] hover:bg-[#1a2538] text-white border border-[#202e48] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Server size={15} className="text-[var(--cyber-success)]" />
                <span>Añadir destino</span>
              </button>
              <button
                onClick={() => onNavigate('templates')}
                className="px-4 py-2.5 rounded-xl bg-[#111928] hover:bg-[#1a2538] text-white border border-[#202e48] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Layers size={15} className="text-[#a855f7]" />
                <span>Crear plantilla</span>
              </button>
            </div>

            {/* 4-Step Onboarding Guide */}
            <div className="pt-6 border-t border-[#182338]">
              <h3 className="text-xs font-mono font-bold text-[#8493a8] uppercase tracking-wider mb-4">
                Guía de inicio en 4 pasos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={onOpenNewDestination}
                  className="p-4 rounded-xl bg-[#070a12] border border-[#162238] hover:border-[var(--cyber-primary)]/40 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#0e1626] border border-[#1c2a44] text-[var(--cyber-primary)] font-mono font-bold text-xs flex items-center justify-center mb-3">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors mb-1">
                    1. Añade tu primer destino
                  </h4>
                  <p className="text-[11px] text-[#64748b] leading-relaxed">
                    Registra un servidor o equipo cliente (Windows Server, Linux, BSD) indicando IP o hostname.
                  </p>
                </div>

                <div
                  onClick={() => onNavigate('credentials')}
                  className="p-4 rounded-xl bg-[#070a12] border border-[#162238] hover:border-[var(--cyber-primary)]/40 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#0e1626] border border-[#1c2a44] text-[var(--cyber-primary)] font-mono font-bold text-xs flex items-center justify-center mb-3">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors mb-1">
                    2. Configura una credencial
                  </h4>
                  <p className="text-[11px] text-[#64748b] leading-relaxed">
                    Añade credenciales de acceso remoto (WinRM, SSH con contraseña o llave privada) al almacén seguro.
                  </p>
                </div>

                <div
                  onClick={onOpenNewTask}
                  className="p-4 rounded-xl bg-[#070a12] border border-[#162238] hover:border-[var(--cyber-primary)]/40 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#0e1626] border border-[#1c2a44] text-[var(--cyber-primary)] font-mono font-bold text-xs flex items-center justify-center mb-3">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors mb-1">
                    3. Crea tu primera tarea
                  </h4>
                  <p className="text-[11px] text-[#64748b] leading-relaxed">
                    Define el comando (PowerShell, Bash, CMD o script) y asígnalo a tus destinos de ejecución.
                  </p>
                </div>

                <div
                  onClick={() => onNavigate('calendar')}
                  className="p-4 rounded-xl bg-[#070a12] border border-[#162238] hover:border-[var(--cyber-primary)]/40 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#0e1626] border border-[#1c2a44] text-[var(--cyber-primary)] font-mono font-bold text-xs flex items-center justify-center mb-3">
                    4
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors mb-1">
                    4. Programa su ejecución
                  </h4>
                  <p className="text-[11px] text-[#64748b] leading-relaxed">
                    Establece programación horaria, diaria, semanal, expresión Cron o ejecútala manualmente bajo demanda.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN PRIORITY: Próximas Ejecuciones (Timeline List with Target Server) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0c1220] border border-[#1c2a44] shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#182338] mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
              <Clock size={18} className="text-[var(--cyber-primary)]" />
              {t('dashboard.upcomingTitle')}
            </h2>
            <p className="text-xs text-[#8493a8] mt-0.5">
              {t('dashboard.upcomingSubtitle')}
            </p>
          </div>

          <button
            onClick={() => onNavigate('calendar')}
            className="text-xs font-semibold text-[var(--cyber-primary)] hover:underline flex items-center gap-1"
          >
            <span>Ver cronograma</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Timeline List Items */}
        <div className="space-y-3">
          {data?.upcomingExecutions && data.upcomingExecutions.length > 0 ? (
            data.upcomingExecutions.map((task) => {
              const runDate = task.next_run_at ? new Date(task.next_run_at) : null;
              const timeDisplay = runDate
                ? runDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
                : '—';

              return (
                <div
                  key={task.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-[#070a12] border border-[#182338] hover:border-[var(--cyber-primary)]/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Timestamp Box */}
                    <div className="px-3 py-2 rounded-lg bg-[#0e1626] border border-[#1c2a44] text-center font-mono shrink-0">
                      <span className="text-base font-black text-[var(--cyber-primary)] block leading-none">
                        {timeDisplay}
                      </span>
                      <span className="text-[10px] text-[#64748b] block mt-0.5">
                        {runDate ? runDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : ''}
                      </span>
                    </div>

                    {/* Task Info & Target Server */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors truncate">
                          {task.name}
                        </span>
                        {task.command_type && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#141e30] text-[#8493a8] border border-[#202e48]">
                            {task.command_type}
                          </span>
                        )}
                      </div>

                      {/* Destination Host Indicator (FUNDAMENTAL!) */}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-[#8493a8] font-mono flex-wrap">
                        <span className="text-[#64748b]">{t('dashboard.target')}:</span>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0f1726] border border-[#1e2d48] text-white font-semibold">
                          <Server size={12} className="text-[var(--cyber-primary)]" />
                          <span>{task.destination_name || 'Local / Endpoint'}</span>
                        </div>
                        {task.destination_os && (
                          <span className="text-[11px] text-[#64748b]">({task.destination_os})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#141d2e]">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--cyber-success)] font-mono font-semibold">
                      <CheckCircle2 size={13} /> Programada
                    </span>

                    <button
                      onClick={() => handleManualRun(task.id)}
                      disabled={runningTaskId === task.id}
                      className="px-3 py-1.5 rounded-lg bg-[#111a2a] hover:bg-[var(--cyber-primary)] text-[var(--cyber-primary)] hover:text-black border border-[#1e2e4a] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      title={t('dashboard.runTask')}
                    >
                      <Play size={13} className={runningTaskId === task.id ? 'animate-spin' : ''} />
                      <span className="hidden sm:inline">Ejecutar</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-xs text-[#64748b] font-mono">
              {t('dashboard.noUpcoming')}
            </div>
          )}
        </div>
      </div>

      {/* 3. SPLIT SECTION: Ejecuciones Recientes + Destinos de Ejecución Activos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ejecuciones Recientes (con Destino) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0c1220] border border-[#1c2a44] shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#182338] mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <Terminal size={16} className="text-[#a855f7]" />
                {t('dashboard.recentTitle')}
              </h3>
              <p className="text-xs text-[#8493a8]">{t('dashboard.recentSubtitle')}</p>
            </div>
            <button
              onClick={() => onNavigate('executions')}
              className="text-xs font-semibold text-[var(--cyber-primary)] hover:underline flex items-center gap-1"
            >
              <span>Historial</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[380px]">
            {data?.recentExecutions && data.recentExecutions.length > 0 ? (
              data.recentExecutions.map((exec) => (
                <div
                  key={exec.id}
                  onClick={() => setSelectedExecution(exec)}
                  className="p-3 rounded-xl bg-[#070a12] border border-[#162033] hover:border-[var(--cyber-primary)]/40 flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        exec.status === 'success'
                          ? 'bg-[#00ff88]'
                          : exec.status === 'failed'
                          ? 'bg-[#ff0055]'
                          : exec.status === 'running'
                          ? 'bg-[var(--cyber-primary)] animate-pulse'
                          : 'bg-[#ffb800]'
                      }`}
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors truncate">
                          {exec.task_name || exec.current_task_name}
                        </span>
                        {exec.destination_name && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#141d2e] text-[var(--cyber-primary)] border border-[#202e48]">
                            {exec.destination_name}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#64748b] font-mono mt-0.5">
                        {new Date(exec.started_at).toLocaleTimeString()} • {exec.duration_ms ? `${exec.duration_ms}ms` : '—'} •{' '}
                        {exec.triggered_by === 'manual' ? 'Manual' : 'Scheduler'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold shrink-0 ${
                      exec.status === 'success'
                        ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30'
                        : exec.status === 'failed'
                        ? 'bg-[#ff0055]/10 text-[#ff0055] border border-[#ff0055]/30'
                        : 'bg-[var(--cyber-primary)]/10 text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/30'
                    }`}
                  >
                    {exec.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-[#64748b] font-mono">
                {t('dashboard.noRecent')}
              </div>
            )}
          </div>
        </div>

        {/* Destinos de Ejecución Activos (Hosts & OS Overview) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0c1220] border border-[#1c2a44] shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#182338] mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <Server size={16} className="text-[var(--cyber-primary)]" />
                Destinos por Sistema
              </h3>
              <p className="text-xs text-[#8493a8]">Distribución de equipos y servidores sobre los que ELYS ejecuta tareas</p>
            </div>
            <button
              onClick={() => onNavigate('destinations')}
              className="text-xs font-semibold text-[var(--cyber-primary)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos ({destinations.length})</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* OS Distribution Breakdown (Section 84) */}
          <div className="space-y-1.5 mb-4">
            {[
              { id: 'windows_server', name: 'Windows Server', icon: Server, color: '#00f0ff', count: destinations.filter((d) => d.system_type === 'windows_server').length },
              { id: 'windows_desktop', name: 'Windows Desktop', icon: Monitor, color: '#38bdf8', count: destinations.filter((d) => d.system_type === 'windows_desktop').length },
              { id: 'linux', name: 'Linux', icon: Terminal, color: '#ff9900', count: destinations.filter((d) => d.system_type === 'linux').length },
              { id: 'bsd', name: 'BSD', icon: Cpu, color: '#a855f7', count: destinations.filter((d) => d.system_type === 'bsd').length },
              { id: 'other', name: 'Otros', icon: HardDrive, color: '#94a3b8', count: destinations.filter((d) => d.system_type === 'other').length },
            ].map((os) => {
              const Icon = os.icon;
              return (
                <div
                  key={os.id}
                  onClick={() => onNavigate('destinations', { systemType: os.id })}
                  className="px-3 py-2 rounded-xl bg-[#070a12] border border-[#162033] hover:border-[var(--cyber-primary)]/50 flex items-center justify-between transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} style={{ color: os.color }} />
                    <span className="text-xs font-mono text-[#cbd5e1] group-hover:text-white transition-colors">
                      {os.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-mono font-bold"
                      style={{ backgroundColor: `${os.color}15`, color: os.color }}
                    >
                      {os.count}
                    </span>
                    <ChevronRight size={12} className="text-[#64748b] group-hover:text-white transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick List of registered hosts */}
          <div className="pt-3 border-t border-[#182338]">
            <span className="text-[10px] font-mono text-[#64748b] uppercase tracking-wider block mb-2 font-semibold">
              Equipos recientes
            </span>
            <div className="space-y-2 overflow-y-auto max-h-[160px]">
              {destinations.slice(0, 4).map((dest) => (
                <div
                  key={dest.id}
                  onClick={() => onNavigate('destinations')}
                  className="p-2.5 rounded-lg bg-[#070a12] border border-[#162033] hover:border-[#223352] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                    <span className="text-xs font-mono font-bold text-white truncate">{dest.name}</span>
                    <span className="text-[10px] text-[#64748b] font-mono truncate">{dest.os_name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--cyber-primary)] shrink-0">
                    {dest.ip_address || dest.hostname}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Attention Needed Section (Only appears if there are failures) */}
      {data?.attentionTasks && data.attentionTasks.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#140b12] border border-[#3d1425]">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-[#ff0055]" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              {t('dashboard.attentionTitle')}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.attentionTasks.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-xl bg-[#0c070c] border border-[#2b0f1b] flex items-center justify-between"
              >
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#ff5588] block truncate">{task.name}</span>
                  <span className="text-[10px] text-[#8493a8] font-mono">
                    Host: {task.destination_name || 'Desconocido'} • Último fallo:{' '}
                    {task.last_run_at ? new Date(task.last_run_at).toLocaleTimeString() : '—'}
                  </span>
                </div>
                <button
                  onClick={() => handleManualRun(task.id)}
                  className="px-2.5 py-1 rounded-lg bg-[#2b0f1b] hover:bg-[#ff0055] text-xs font-semibold text-[#ff5588] hover:text-white transition-colors cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution detail modal */}
      <ExecutionDetailsModal
        execution={selectedExecution}
        onClose={() => setSelectedExecution(null)}
      />
    </div>
  );
};
