import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, X, Server, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';
import { Task, Destination } from '../../types/index.js';

interface ExecuteTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onConfirm: (taskId: string, destinationId?: string, isDryRun?: boolean) => Promise<void>;
}

export const ExecuteTaskModal: React.FC<ExecuteTaskModalProps> = ({
  isOpen,
  task,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [selectedDestId, setSelectedDestId] = useState<string>('all');
  const [isDryRun, setIsDryRun] = useState(false);
  const [executing, setExecuting] = useState(false);

  if (!isOpen || !task) return null;

  const destinations = task.destinations || [];

  const handleExecute = async () => {
    try {
      setExecuting(true);
      await onConfirm(
        task.id,
        selectedDestId === 'all' ? undefined : selectedDestId,
        isDryRun
      );
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al ejecutar tarea');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0c1220] border border-[#202e48] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#182338] bg-[#070a12]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--cyber-primary)]/10 border border-[var(--cyber-primary)]/30 text-[var(--cyber-primary)]">
              <Play size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Ejecutar Tarea
              </h3>
              <p className="text-xs text-[#8493a8] font-mono">
                {task.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#182338] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {/* Destination Selector if multiple destinations */}
          {destinations.length > 1 ? (
            <div className="space-y-2">
              <label className="block font-semibold text-[#8493a8] uppercase text-[11px]">
                Seleccionar Destino de Ejecución
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedDestId === 'all'
                      ? 'bg-[#10192a] border-[var(--cyber-primary)] text-white'
                      : 'bg-[#070a12] border-[#1a253a] text-[#8493a8] hover:text-white hover:border-[#2a3b5c]'
                  }`}
                >
                  <input
                    type="radio"
                    name="targetDestination"
                    value="all"
                    checked={selectedDestId === 'all'}
                    onChange={() => setSelectedDestId('all')}
                    className="accent-[var(--cyber-primary)]"
                  />
                  <div className="flex items-center justify-between flex-1">
                    <span className="font-semibold">Todos los destinos asignados</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#141e30] border border-[#202e48]">
                      {destinations.length} destinos
                    </span>
                  </div>
                </label>

                {destinations.map((d) => (
                  <label
                    key={d.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedDestId === d.id
                        ? 'bg-[#10192a] border-[var(--cyber-primary)] text-white'
                        : 'bg-[#070a12] border-[#1a253a] text-[#8493a8] hover:text-white hover:border-[#2a3b5c]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetDestination"
                      value={d.id}
                      checked={selectedDestId === d.id}
                      onChange={() => setSelectedDestId(d.id)}
                      className="accent-[var(--cyber-primary)]"
                    />
                    <div className="flex items-center justify-between flex-1">
                      <div className="flex items-center gap-2">
                        <Server size={14} className="text-[var(--cyber-primary)]" />
                        <span className="font-semibold">{d.name}</span>
                        <span className="text-[11px] text-[#64748b]">({(d as any).hostname || (d as any).ip_address || d.system_type})</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#8493a8] uppercase">
                        {d.os_name || d.system_type}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#070a12] border border-[#1a253a] flex items-center justify-between">
              <span className="text-[#8493a8]">Destino de ejecución:</span>
              <div className="flex items-center gap-2 text-white font-mono font-semibold">
                <Server size={14} className="text-[var(--cyber-primary)]" />
                <span>{destinations[0]?.name || 'Host Local (ELYS)'}</span>
              </div>
            </div>
          )}

          {/* Dry Run Toggle */}
          <div className="p-3.5 rounded-xl bg-[#070a12] border border-[#1a253a] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu size={16} className="text-[#a855f7]" />
              <div>
                <span className="text-white font-semibold block">Modo Simulación (Dry Run)</span>
                <span className="text-[#64748b] text-[11px] block">
                  Evalúa variables y conectividad sin ejecutar cambios en el sistema.
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isDryRun}
                onChange={(e) => setIsDryRun(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#1e2b45] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#a855f7]" />
            </label>
          </div>

          {/* Sensitive Notice */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300 text-xs">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <span>
              Esta acción ejecutará la tarea inmediatamente con los parámetros asignados.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#182338] bg-[#070a12]">
          <button
            type="button"
            onClick={onClose}
            disabled={executing}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#8493a8] hover:text-white hover:bg-[#121c2e] border border-[#1e2b45] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={executing}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] transition-all flex items-center gap-2 shadow-lg shadow-[var(--cyber-primary)]/20 cursor-pointer disabled:opacity-50"
          >
            <Play size={14} />
            <span>{executing ? 'Iniciando...' : (isDryRun ? 'Iniciar Simulación' : 'Ejecutar Ahora')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
