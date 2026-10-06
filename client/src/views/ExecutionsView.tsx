import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { Execution } from '../types/index.js';
import {
  Terminal,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  StopCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { ExecutionDetailsModal } from '../components/modals/ExecutionDetailsModal.js';
import { ConfirmModal } from '../components/modals/ConfirmModal.js';
import { useAuth } from '../context/AuthContext.js';

export const ExecutionsView: React.FC = () => {
  const { t } = useTranslation();
  const { isOperator } = useAuth();

  const [executions, setExecutions] = useState<Execution[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const res = await api.getExecutions({
        status: statusFilter || undefined,
        limit,
        offset: page * limit,
      });
      setExecutions(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutions();
    const interval = setInterval(loadExecutions, 6000);
    return () => clearInterval(interval);
  }, [page, statusFilter]);

  const handleCancelExecution = async () => {
    if (!cancellingId) return;
    try {
      await api.cancelExecution(cancellingId);
      loadExecutions();
    } catch (err: any) {
      alert(err.message || 'Error al cancelar la ejecución');
    } finally {
      setCancellingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="p-4 rounded-xl bg-[#0e1422] border border-[#1e2b45] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-[#a855f7]" />
          <h2 className="text-sm font-bold text-white tracking-wide">
            {t('executions.title')}
          </h2>
          <span className="text-xs text-[#64748b] font-mono ml-2">({total} registros)</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)]"
          >
            <option value="">{t('executions.filterAll')}</option>
            <option value="success">{t('tasks.status.success')}</option>
            <option value="failed">{t('tasks.status.failed')}</option>
            <option value="running">{t('tasks.status.running')}</option>
            <option value="cancelled">{t('tasks.status.cancelled')}</option>
          </select>

          {isOperator && (
            <button
              onClick={async () => {
                if (window.confirm('¿Purgar registros de ejecuciones antiguas (más de 30 días)?')) {
                  try {
                    const res = await api.pruneExecutions({ daysToKeep: 30 });
                    alert(`Purga completada: ${res.deletedExecutions} ejecuciones eliminadas.`);
                    loadExecutions();
                  } catch (err: any) {
                    alert(err.message || 'Error al purgar ejecuciones');
                  }
                }
              }}
              className="px-3 py-2 rounded-lg bg-[#141d2e] hover:bg-rose-500/20 text-[#8493a8] hover:text-rose-400 border border-[#223352] text-xs font-semibold transition-colors"
              title="Purgar ejecuciones de más de 30 días"
            >
              Purgar &gt;30d
            </button>
          )}

          <button
            onClick={loadExecutions}
            className="p-2 rounded-lg bg-[#141d2e] hover:bg-[#1f2b42] text-[var(--cyber-primary)] transition-colors"
            title="Refrescar lista"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Executions Table */}
      <div className="rounded-xl bg-[#0e1422] border border-[#1e2b45] overflow-hidden">
        {loading && executions.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-[#8493a8]">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
            <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
          </div>
        ) : executions.length === 0 ? (
          <div className="p-16 text-center text-[#8493a8]">
            <Terminal className="w-12 h-12 mx-auto text-[#243552] mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">No hay ejecuciones registradas</h3>
            <p className="text-xs text-[#64748b] max-w-sm mx-auto font-mono">
              Las ejecuciones aparecerán aquí una vez que se ejecuten tareas de forma manual o automática mediante el programador.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1e2b45] bg-[#090d16] text-[11px] font-semibold text-[#8493a8] uppercase tracking-wider">
                  <th className="py-3 px-4">{t('executions.columns.task')}</th>
                  <th className="py-3 px-4">{t('executions.columns.trigger')}</th>
                  <th className="py-3 px-4">{t('executions.columns.status')}</th>
                  <th className="py-3 px-4">{t('executions.columns.startedAt')}</th>
                  <th className="py-3 px-4">{t('executions.columns.duration')}</th>
                  <th className="py-3 px-4">{t('executions.columns.exitCode')}</th>
                  <th className="py-3 px-4 text-right">{t('executions.columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162033] text-xs font-mono">
                {executions.map((exec) => (
                  <tr
                    key={exec.id}
                    className="hover:bg-[#121929] transition-colors group cursor-pointer"
                    onClick={() => setSelectedExecution(exec)}
                  >
                    <td className="py-3 px-4 font-sans font-semibold text-white group-hover:text-[var(--cyber-primary)] transition-colors">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{exec.task_name || exec.current_task_name}</span>
                        {exec.is_dry_run === 1 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            DRY RUN
                          </span>
                        )}
                        {exec.retry_count !== undefined && exec.retry_count > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Reintento {exec.retry_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#8493a8] capitalize">
                      {exec.triggered_by} {exec.triggered_by_user ? `(${exec.triggered_by_user})` : ''}
                    </td>
                    <td className="py-3 px-4">
                      {exec.status === 'success' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30">
                          <CheckCircle2 size={12} /> {t('tasks.status.success')}
                        </span>
                      )}
                      {exec.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#ff0055]/10 text-[#ff0055] border border-[#ff0055]/30">
                          <XCircle size={12} /> {t('tasks.status.failed')}
                        </span>
                      )}
                      {exec.status === 'running' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[var(--cyber-primary)]/10 text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/30 animate-pulse">
                          <Clock size={12} /> {t('tasks.status.running')}
                        </span>
                      )}
                      {exec.status === 'cancelled' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#ffb800]/10 text-[#ffb800] border border-[#ffb800]/30">
                          <StopCircle size={12} /> {t('tasks.status.cancelled')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-white">
                      {new Date(exec.started_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-[#8493a8]">
                      {exec.duration_ms !== null && exec.duration_ms !== undefined ? `${exec.duration_ms} ms` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={exec.exit_code === 0 ? 'text-[#00ff88]' : 'text-[#ff0055]'}>
                        {exec.exit_code !== null && exec.exit_code !== undefined ? exec.exit_code : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {exec.status === 'running' && isOperator && (
                          <button
                            onClick={() => {
                              setCancellingId(exec.id);
                              setIsConfirmCancelOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-[#ff0055]/10 hover:bg-[#ff0055] text-[#ff5588] hover:text-white border border-[#ff0055]/30 text-[10px] font-sans font-semibold transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedExecution(exec)}
                          className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#1f2b42] text-[var(--cyber-primary)] transition-colors"
                          title={t('executions.viewDetails')}
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e2b45] bg-[#090d16] text-xs">
            <span className="text-[#64748b]">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-1 rounded bg-[#101726] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1a2538]"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 rounded bg-[#101726] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1a2538]"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Execution detail modal */}
      <ExecutionDetailsModal
        execution={selectedExecution}
        onClose={() => setSelectedExecution(null)}
        onCancelExecution={(id) => {
          setCancellingId(id);
          setIsConfirmCancelOpen(true);
        }}
      />

      {/* Confirm cancel modal */}
      <ConfirmModal
        isOpen={isConfirmCancelOpen}
        title={t('executions.cancelExecution')}
        message={t('executions.cancelConfirm')}
        confirmText="Cancelar Ejecución"
        onConfirm={handleCancelExecution}
        onClose={() => setIsConfirmCancelOpen(false)}
        isDestructive={true}
      />
    </div>
  );
};
