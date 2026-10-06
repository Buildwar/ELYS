import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { Task } from '../types/index.js';
import { Calendar as CalendarIcon, Clock, MoveRight, Check, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const CalendarView: React.FC = () => {
  const { t } = useTranslation();
  const { isOperator } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick reschedule state
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [newTime, setNewTime] = useState('04:00');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await api.getTasks({ status: 'active' });
      setTasks(res);
    } catch (err) {
      console.error('Failed to load tasks for calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleQuickReschedule = async () => {
    if (!rescheduleTask || !newTime) return;
    try {
      setIsUpdating(true);
      // If task is daily or interval or once, update schedule_expression
      let newType = rescheduleTask.schedule_type;
      let newExpr = newTime;

      if (rescheduleTask.schedule_type === 'weekly') {
        const [day] = rescheduleTask.schedule_expression.split(',');
        newExpr = `${day || '1'},${newTime}`;
      } else if (rescheduleTask.schedule_type === 'monthly') {
        const [day] = rescheduleTask.schedule_expression.split(',');
        newExpr = `${day || '1'},${newTime}`;
      } else {
        newType = 'daily';
        newExpr = newTime;
      }

      await api.updateTask(rescheduleTask.id, {
        scheduleType: newType,
        scheduleExpression: newExpr,
      });

      setRescheduleTask(null);
      await loadTasks();
    } catch (err: any) {
      alert(err.message || 'Error al reprogramar la tarea');
    } finally {
      setIsUpdating(false);
    }
  };

  // Group tasks by upcoming hours
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="p-5 rounded-xl bg-[#0e1422] border border-[#1e2b45] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <CalendarIcon size={18} className="text-[var(--cyber-primary)]" />
            {t('calendar.title')}
          </h2>
          <p className="text-xs text-[#8493a8] mt-1">{t('calendar.subtitle')}</p>
        </div>

        <button
          onClick={loadTasks}
          className="p-2 rounded-lg bg-[#141d2e] hover:bg-[#1e2b45] text-[var(--cyber-primary)] transition-colors self-end md:self-auto"
          title="Actualizar cronograma"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 24-Hour Interactive Timeline */}
      <div className="rounded-xl bg-[#0e1422] border border-[#1e2b45] p-6 overflow-hidden">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Clock size={14} className="text-[var(--cyber-primary)]" />
          Distribución de Horarios (00:00 - 23:59)
        </h3>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-[#8493a8]">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
            <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {hours.map((hour) => {
              const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
              const matchingTasks = tasks.filter((t) => {
                if (!t.next_run_at) return false;
                const d = new Date(t.next_run_at);
                return d.getHours() === hour;
              });

              return (
                <div
                  key={hour}
                  className={`p-3 rounded-lg border transition-all ${
                    matchingTasks.length > 0
                      ? 'bg-[#101726] border-[var(--cyber-primary)]/40 shadow-sm'
                      : 'bg-[#070a12] border-[#162033]'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#1b263b] mb-2 font-mono">
                    <span className="text-xs font-bold text-[var(--cyber-primary)]">
                      {hourStr}:00
                    </span>
                    <span className="text-[10px] text-[#64748b]">
                      {matchingTasks.length} {matchingTasks.length === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </div>

                  <div className="space-y-1.5 min-h-[50px]">
                    {matchingTasks.length > 0 ? (
                      matchingTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => {
                            if (isOperator) {
                              setRescheduleTask(task);
                              setNewTime(task.next_run_at ? new Date(task.next_run_at).toTimeString().slice(0, 5) : '04:00');
                            }
                          }}
                          className={`p-2 rounded bg-[#090e18] border border-[#223352] text-xs transition-all ${
                            isOperator ? 'hover:border-[var(--cyber-primary)] cursor-pointer group' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white group-hover:text-[var(--cyber-primary)] truncate block max-w-[140px]">
                              {task.name}
                            </span>
                            {task.next_run_at && (
                              <span className="text-[10px] text-[#00ff88] font-mono shrink-0">
                                {new Date(task.next_run_at).getMinutes() < 10
                                  ? `0${new Date(task.next_run_at).getMinutes()}`
                                  : new Date(task.next_run_at).getMinutes()}m
                              </span>
                            )}
                          </div>
                          {task.category_name && (
                            <span
                              className="text-[9px] font-mono mt-1 inline-block px-1.5 py-0.2 rounded"
                              style={{
                                color: task.category_color,
                                backgroundColor: `${task.category_color}15`,
                              }}
                            >
                              {task.category_name}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center text-[11px] text-[#475569] font-mono">
                        Libre
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Reschedule Interactive Modal */}
      {rescheduleTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-xl bg-[#0e1422] border border-[#202d47] shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2b45] mb-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[var(--cyber-primary)]" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {t('calendar.reschedule')}
                </h3>
              </div>
              <button
                onClick={() => setRescheduleTask(null)}
                className="p-1 rounded-md text-[#64748b] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-4">
              <span className="text-xs text-[#8493a8] block">Tarea seleccionada:</span>
              <span className="text-sm font-bold text-white block mt-0.5">
                {rescheduleTask.name}
              </span>
              <span className="text-xs text-[#64748b] font-mono block mt-1">
                Programación actual: {rescheduleTask.schedule_expression} ({rescheduleTask.schedule_type})
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#070a12] border border-[#1e2b45] mb-5">
              <label className="block text-xs font-semibold text-[#8493a8] uppercase mb-1.5">
                Nueva Hora de Ejecución (HH:MM)
              </label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0e1422] border border-[#1e2b45] font-mono text-base text-[var(--cyber-primary)] focus:outline-none focus:border-[var(--cyber-primary)]"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRescheduleTask(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8493a8] hover:text-white hover:bg-[#1a2538]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleQuickReschedule}
                disabled={isUpdating}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-[var(--cyber-primary)] text-black hover:bg-[var(--cyber-primary-hover)] transition-all flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>{isUpdating ? t('common.loading') : t('common.save')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
