import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, Terminal, Clock, CheckCircle2, XCircle, 
  AlertCircle, StopCircle, Download, FileText, Code2, Database, ShieldAlert, RotateCcw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Execution, ExecutionLog } from '../../types/index.js';
import { api } from '../../services/api.js';

interface ExecutionDetailsModalProps {
  execution: Execution | null;
  onClose: () => void;
  onCancelExecution?: (id: string) => void;
}

export const ExecutionDetailsModal: React.FC<ExecutionDetailsModalProps> = ({ 
  execution, 
  onClose,
  onCancelExecution 
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'output' | 'structured_logs' | 'command'>('output');

  useEffect(() => {
    if (execution?.id) {
      setLoadingLogs(true);
      api.getExecutionLogs(execution.id)
        .then(res => {
          if (Array.isArray(res)) setLogs(res);
        })
        .catch(() => {})
        .finally(() => setLoadingLogs(false));
    }
  }, [execution?.id]);

  if (!execution) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30">
            <CheckCircle2 size={13} /> {t('tasks.status.success')}
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#ff0055]/10 text-[#ff0055] border border-[#ff0055]/30">
            <XCircle size={13} /> {t('tasks.status.failed')}
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--cyber-primary)]/10 text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/30 animate-pulse">
            <Clock size={13} /> {t('tasks.status.running')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#ffb800]/10 text-[#ffb800] border border-[#ffb800]/30">
            <StopCircle size={13} /> {t('tasks.status.cancelled')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#8493a8]/10 text-[#8493a8] border border-[#8493a8]/30">
            <AlertCircle size={13} /> {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl rounded-xl bg-[#0e1422] border border-[#202d47] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2b45] bg-[#090d16]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#141d2e] border border-[#223352] text-[var(--cyber-primary)]">
              <Terminal size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  {execution.task_name || execution.current_task_name}
                </h3>
                {execution.is_dry_run === 1 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/40">
                    DRY RUN
                  </span>
                )}
                {execution.retry_count !== undefined && execution.retry_count > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <RotateCcw size={10} /> Reintento {execution.retry_count}{execution.max_retries ? `/${execution.max_retries}` : ''}
                  </span>
                )}
                {execution.error_type && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <ShieldAlert size={10} /> {execution.error_type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-[#8493a8] font-mono">
                <span>ID: {execution.id.slice(0, 8)}...</span>
                <span>•</span>
                <span>{new Date(execution.started_at).toLocaleString()}</span>
                {(execution.target_name || execution.destination_name) && (
                  <>
                    <span>•</span>
                    <span className="text-[var(--cyber-primary)]">Destino: {execution.target_name || execution.destination_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getStatusBadge(execution.status)}
            {execution.status === 'running' && onCancelExecution && (
              <button
                onClick={() => onCancelExecution(execution.id)}
                className="px-2.5 py-1 text-xs rounded-md font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors flex items-center gap-1"
              >
                <StopCircle size={13} /> Cancelar
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#182338] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Details bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-6 py-3 bg-[#0a0f1a] border-b border-[#1a253a] text-xs font-mono">
          <div>
            <span className="text-[#64748b] block">{t('executions.columns.trigger')}:</span>
            <span className="text-white capitalize font-semibold truncate block">
              {execution.triggered_by} {execution.triggered_by_user ? `(${execution.triggered_by_user})` : ''}
            </span>
          </div>
          <div>
            <span className="text-[#64748b] block">{t('executions.columns.duration')}:</span>
            <span className="text-white font-semibold">
              {execution.duration_ms !== null && execution.duration_ms !== undefined ? `${execution.duration_ms} ms` : '—'}
            </span>
          </div>
          <div>
            <span className="text-[#64748b] block">{t('executions.columns.exitCode')}:</span>
            <span className={`font-semibold ${execution.exit_code === 0 ? 'text-[#00ff88]' : 'text-[#ff0055]'}`}>
              {execution.exit_code !== null && execution.exit_code !== undefined ? execution.exit_code : '—'}
            </span>
          </div>
          <div>
            <span className="text-[#64748b] block">Finalizado:</span>
            <span className="text-white truncate block">
              {execution.finished_at ? new Date(execution.finished_at).toLocaleTimeString() : 'En curso'}
            </span>
          </div>
          <div>
            <span className="text-[#64748b] block">Descargar Logs:</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <a
                href={api.getExecutionDownloadUrl(execution.id, 'txt')}
                download
                className="px-1.5 py-0.5 rounded text-[10px] bg-[#141d2e] hover:bg-[var(--cyber-primary)]/20 text-[#8493a8] hover:text-[var(--cyber-primary)] border border-[#223352] transition-colors"
                title="Descargar TXT"
              >
                TXT
              </a>
              <a
                href={api.getExecutionDownloadUrl(execution.id, 'json')}
                download
                className="px-1.5 py-0.5 rounded text-[10px] bg-[#141d2e] hover:bg-[var(--cyber-primary)]/20 text-[#8493a8] hover:text-[var(--cyber-primary)] border border-[#223352] transition-colors"
                title="Descargar JSON"
              >
                JSON
              </a>
              <a
                href={api.getExecutionDownloadUrl(execution.id, 'csv')}
                download
                className="px-1.5 py-0.5 rounded text-[10px] bg-[#141d2e] hover:bg-[var(--cyber-primary)]/20 text-[#8493a8] hover:text-[var(--cyber-primary)] border border-[#223352] transition-colors"
                title="Descargar CSV"
              >
                CSV
              </a>
            </div>
          </div>
        </div>

        {/* Cancellation Notice if cancelled */}
        {execution.cancelled_at && (
          <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle size={14} />
              Cancelado por: <strong>{execution.cancelled_by || 'usuario'}</strong> ({new Date(execution.cancelled_at).toLocaleTimeString()})
            </span>
            {execution.cancellation_reason && (
              <span className="font-mono text-amber-200">Motivo: {execution.cancellation_reason}</span>
            )}
          </div>
        )}

        {/* Tabs switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-[#0a0f1a] border-b border-[#1a253a]">
          <button
            onClick={() => setActiveTab('output')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'output'
                ? 'text-[var(--cyber-primary)] border-[var(--cyber-primary)] bg-[#111927]'
                : 'text-[#8493a8] border-transparent hover:text-white'
            }`}
          >
            <Terminal size={13} /> Consola / Salida
          </button>
          <button
            onClick={() => setActiveTab('structured_logs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'structured_logs'
                ? 'text-[var(--cyber-primary)] border-[var(--cyber-primary)] bg-[#111927]'
                : 'text-[#8493a8] border-transparent hover:text-white'
            }`}
          >
            <Database size={13} /> Registros de Ejecución ({logs.length})
          </button>
          {execution.command_resolved && (
            <button
              onClick={() => setActiveTab('command')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'command'
                  ? 'text-[var(--cyber-primary)] border-[var(--cyber-primary)] bg-[#111927]'
                  : 'text-[#8493a8] border-transparent hover:text-white'
              }`}
            >
              <Code2 size={13} /> Comando Resuelto
            </button>
          )}
        </div>

        {/* Terminal logs container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'output' && (
            <>
              {/* Human-Friendly Failure Explanation (Section 15) */}
              {(execution.status === 'failed' || (execution.exit_code !== 0 && execution.exit_code !== null && execution.exit_code !== undefined)) && (
                <div className="p-4 rounded-xl bg-[#200a12] border border-[#ff0055]/40 text-xs space-y-2">
                  <div className="flex items-start gap-2.5 text-[#ff4477] font-semibold text-sm">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <span>La tarea no pudo ejecutarse correctamente</span>
                      <p className="text-xs text-[#ff99aa] font-normal mt-0.5 leading-relaxed">
                        {execution.error_type === 'TIMEOUT'
                          ? 'El tiempo límite de ejecución configurado expiró antes de que finalizara el comando.'
                          : execution.error_type === 'CONNECTION_REFUSED' || execution.error_type === 'HOST_UNREACHABLE'
                          ? 'No se pudo conectar con el destino. Comprueba que el host está encendido y accesible en red.'
                          : execution.error_type === 'AUTHENTICATION_FAILED'
                          ? 'Fallo de autenticación: las credenciales configuradas fueron rechazadas por el equipo de destino.'
                          : execution.exit_code !== 0 && execution.exit_code !== null
                          ? `El comando devolvió un código de error de salida (código ${execution.exit_code}). Consulta el detalle de error a continuación.`
                          : 'Se produjo un error durante la ejecución. Revisa los detalles de salida estándar y error a continuación.'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#ff0055]/20 flex items-center justify-between text-[11px] text-[#ffb3c1]">
                    <span>
                      Destino: <strong className="text-white">{execution.target_name || execution.destination_name || 'Local'}</strong>
                    </span>
                    <span>
                      Código de salida: <strong className="font-mono text-white">{execution.exit_code ?? 'Error'}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Stdout */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#8493a8] tracking-wider uppercase flex items-center gap-1.5">
                    <Terminal size={14} className="text-[var(--cyber-primary)]" />
                    {t('executions.modal.outputLabel')}
                  </span>
                  {execution.output && (
                    <button
                      onClick={() => copyToClipboard(execution.output || '')}
                      className="flex items-center gap-1.5 text-xs text-[#8493a8] hover:text-[var(--cyber-primary)] transition-colors"
                    >
                      {copied ? <Check size={14} className="text-[#00ff88]" /> : <Copy size={14} />}
                      <span>{copied ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  )}
                </div>
                <div className="rounded-lg bg-[#06080e] border border-[#1b263b] p-4 font-mono text-xs text-[#00ff88] overflow-x-auto whitespace-pre-wrap leading-relaxed min-h-[140px] max-h-[300px]">
                  {execution.output ? execution.output : <span className="text-[#475569]">{t('executions.modal.noOutput')}</span>}
                </div>
              </div>

              {/* Stderr if present */}
              {execution.error_output && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#ff0055] tracking-wider uppercase flex items-center gap-1.5">
                      <AlertCircle size={14} />
                      {t('executions.modal.errorLabel')}
                    </span>
                  </div>
                  <div className="rounded-lg bg-[#14080e] border border-[#441122] p-4 font-mono text-xs text-[#ff5588] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[200px]">
                    {execution.error_output}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'structured_logs' && (
            <div>
              {loadingLogs ? (
                <div className="text-center py-8 text-xs text-[#8493a8] font-mono">Cargando registros...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#64748b] font-mono">No hay eventos estructurados registrados para esta ejecución.</div>
              ) : (
                <div className="border border-[#1e2b45] rounded-lg overflow-hidden font-mono text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-[#090d16] text-[#64748b] uppercase border-b border-[#1e2b45]">
                      <tr>
                        <th className="py-2 px-3">Hora</th>
                        <th className="py-2 px-3">Nivel</th>
                        <th className="py-2 px-3">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2b45] bg-[#0c121e]">
                      {logs.map((log) => {
                        const levelColor = 
                          log.level === 'ERROR' ? 'text-rose-400 bg-rose-500/10' :
                          log.level === 'WARN' ? 'text-amber-400 bg-amber-500/10' :
                          'text-emerald-400 bg-emerald-500/10';
                        return (
                          <tr key={log.id} className="hover:bg-[#141d2e] transition-colors">
                            <td className="py-2 px-3 text-[#64748b] whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${levelColor}`}>
                                {log.level}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-[#cbd5e1] whitespace-pre-wrap">
                              {log.message}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'command' && execution.command_resolved && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#8493a8] tracking-wider uppercase flex items-center gap-1.5">
                  <Code2 size={14} className="text-[var(--cyber-primary)]" />
                  Comando ejecutado (con variables resueltas y secretos ofuscados)
                </span>
                <button
                  onClick={() => copyToClipboard(execution.command_resolved || '')}
                  className="flex items-center gap-1.5 text-xs text-[#8493a8] hover:text-[var(--cyber-primary)] transition-colors"
                >
                  {copied ? <Check size={14} className="text-[#00ff88]" /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
              <div className="rounded-lg bg-[#06080e] border border-[#1b263b] p-4 font-mono text-xs text-[var(--cyber-primary)] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {execution.command_resolved}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-[#1e2b45] bg-[#090d16]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#182338] text-white hover:bg-[#202d47] transition-colors"
          >
            {t('executions.modal.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

