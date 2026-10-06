import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { Task, Category, Execution, Destination, Credential, Template, TaskHistoryItem } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Plus,
  Search,
  Server,
  Play,
  Edit2,
  Copy,
  Trash2,
  Terminal,
  Globe,
  Code,
  Clock,
  CheckCircle2,
  XCircle,
  Power,
  RefreshCw,
  Star,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Eye,
  History,
  AlertTriangle,
  ChevronDown,
  Layers,
  Sparkles,
  GitBranch,
} from 'lucide-react';
import { TaskModal } from '../components/modals/TaskModal.js';
import { ConfirmModal } from '../components/modals/ConfirmModal.js';
import { ExecutionDetailsModal } from '../components/modals/ExecutionDetailsModal.js';
import { ExecuteTaskModal } from '../components/modals/ExecuteTaskModal.js';

interface TasksViewProps {
  prefilledTemplate?: Template | null;
  onClearPrefilledTemplate?: () => void;
  initialSearch?: string;
  initialDestinationId?: string;
}

export const TasksView: React.FC<TasksViewProps> = ({
  prefilledTemplate,
  onClearPrefilledTemplate,
  initialSearch = '',
  initialDestinationId = '',
}) => {
  const { t } = useTranslation();
  const { isOperator } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [trashedTasks, setTrashedTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab: 'all' | 'favorites' | 'trash'
  const [viewTab, setViewTab] = useState<'all' | 'favorites' | 'trash'>('all');

  // Multi-selection for bulk operations
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDestination, setSelectedDestination] = useState(initialDestinationId);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [executingTaskModal, setExecutingTaskModal] = useState<Task | null>(null);

  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  // Preview & History modals
  const [previewTaskData, setPreviewTaskData] = useState<{ taskName: string; resolvedScript: string; targets: any[] } | null>(null);
  const [historyTaskData, setHistoryTaskData] = useState<{ taskName: string; items: TaskHistoryItem[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [latestExecution, setLatestExecution] = useState<Execution | null>(null);

  useEffect(() => {
    if (prefilledTemplate) {
      setEditingTask(null);
      setIsTaskModalOpen(true);
    }
  }, [prefilledTemplate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tasksRes, trashedRes, categoriesRes, destinationsRes, credentialsRes, templatesRes] = await Promise.all([
        api.getTasks({
          search: searchTerm || undefined,
          category: selectedCategory || undefined,
          status: selectedStatus || undefined,
          type: selectedType || undefined,
          destination: selectedDestination || undefined,
          tag: selectedTag || undefined,
        }),
        api.getTrashTasks().catch(() => []),
        api.getCategories(),
        api.getDestinations(),
        api.getCredentials(),
        api.getTemplates(),
      ]);
      setTasks(tasksRes);
      setTrashedTasks(trashedRes);
      setCategories(categoriesRes);
      setDestinations(destinationsRes);
      setCredentials(credentialsRes);
      setTemplates(templatesRes);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, selectedCategory, selectedDestination, selectedStatus, selectedType, selectedTag]);

  // Clear selections when switching view tabs
  useEffect(() => {
    setSelectedTaskIds([]);
  }, [viewTab]);

  const handleCreateOrEdit = async (data: any) => {
    if (editingTask) {
      await api.updateTask(editingTask.id, data);
    } else {
      await api.createTask(data);
    }
    setIsTaskModalOpen(false);
    if (onClearPrefilledTemplate) {
      onClearPrefilledTemplate();
    }
    loadData();
  };

  const handleToggleFavorite = async (task: Task) => {
    try {
      await api.toggleFavorite(task.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar favorito');
    }
  };

  const handleToggleActive = async (task: Task) => {
    try {
      await api.toggleTask(task.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado de la tarea');
    }
  };

  const handleTogglePause = async (task: Task) => {
    try {
      if (task.state === 'PAUSED') {
        await api.resumeTask(task.id);
      } else {
        await api.pauseTask(task.id);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al pausar/reanudar tarea');
    }
  };

  const handleDuplicate = async (task: Task) => {
    try {
      await api.duplicateTask(task.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al duplicar tarea');
    }
  };

  const handleConfirmModalExecute = async (taskId: string, destinationId?: string, isDryRun?: boolean) => {
    setExecutingTaskModal(null);
    try {
      setRunningTaskId(taskId);
      const res = await api.runTask(taskId, { specificDestinationId: destinationId, dryRun: isDryRun });
      setTimeout(async () => {
        try {
          const execDetail = await api.getExecution(res.executionId);
          setLatestExecution(execDetail);
        } catch {
          // Ignore
        }
        loadData();
        setRunningTaskId(null);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Error al ejecutar tarea');
      setRunningTaskId(null);
    }
  };

  const handleManualRun = async (task: Task, isDryRun: boolean = false) => {
    try {
      setRunningTaskId(task.id);
      const res = await api.runTask(task.id, { dryRun: isDryRun });
      setTimeout(async () => {
        try {
          const execDetail = await api.getExecution(res.executionId);
          setLatestExecution(execDetail);
        } catch {
          // Ignore
        }
        loadData();
        setRunningTaskId(null);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Error al ejecutar tarea');
      setRunningTaskId(null);
    }
  };

  const handlePreviewCommand = async (task: Task) => {
    try {
      const res = await api.previewTask(task.id);
      const first = Array.isArray(res) && res.length > 0 ? res[0] : null;
      setPreviewTaskData({
        taskName: task.name,
        resolvedScript: first ? first.resolved_command : (typeof (res as any)?.resolvedScript === 'string' ? (res as any).resolvedScript : 'Comando evaluado correctamente'),
        targets: Array.isArray(res) ? res : ((res as any)?.targets || []),
      });
    } catch (err: any) {
      alert(err.message || 'Error al previsualizar comando');
    }
  };

  const handleShowHistory = async (task: Task) => {
    try {
      setHistoryLoading(true);
      setHistoryTaskData({ taskName: task.name, items: [] });
      const res = await api.getTaskHistory(task.id);
      setHistoryTaskData({ taskName: task.name, items: Array.isArray(res) ? res : ((res as any)?.history || []) });
    } catch (err: any) {
      alert(err.message || 'Error al cargar historial');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteClick = (task: Task, permanent: boolean = false) => {
    setDeletingTask(task);
    setIsPermanentDelete(permanent);
    setIsConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTask) return;
    try {
      if (isPermanentDelete) {
        await api.permanentDeleteTask(deletingTask.id);
      } else {
        await api.deleteTask(deletingTask.id);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar tarea');
    } finally {
      setDeletingTask(null);
      setIsConfirmDeleteOpen(false);
    }
  };

  const handleRestoreFromTrash = async (taskId: string) => {
    try {
      await api.restoreTask(taskId);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al restaurar tarea');
    }
  };

  // Bulk actions handler
  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'pause' | 'run' | 'move_to_trash' | 'restore_trash' | 'delete_permanent') => {
    if (selectedTaskIds.length === 0) return;
    try {
      await api.bulkTasks(selectedTaskIds, action);
      setSelectedTaskIds([]);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error en acción masiva');
    }
  };

  // Export tasks
  const handleExportTasks = async (ids?: string[]) => {
    try {
      const dataToExport = await api.exportTasks(ids);
      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elys-tasks-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error al exportar tareas');
    }
  };

  // Import tasks
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await api.importTasks(parsed);
      alert(`Importación completada: ${res.imported} importadas, ${res.updated} actualizadas, ${res.skipped} omitidas.`);
      loadData();
    } catch (err: any) {
      alert('Error importando archivo JSON: ' + (err.message || 'Formato no válido'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Filter tasks according to view tab
  const displayedTasks = 
    viewTab === 'trash'
      ? trashedTasks
      : viewTab === 'favorites'
      ? tasks.filter((t) => t.is_favorite === 1)
      : tasks;

  // Toggle selection
  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.length === displayedTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(displayedTasks.map((t) => t.id));
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'command':
        return <Terminal size={14} className="text-[var(--cyber-primary)]" />;
      case 'http':
        return <Globe size={14} className="text-[#a855f7]" />;
      case 'script':
        return <Code size={14} className="text-[#00ff88]" />;
      default:
        return <Terminal size={14} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top View Selector Tabs (All, Favorites, Trash) */}
      <div className="flex items-center justify-between border-b border-[#182338] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              viewTab === 'all'
                ? 'bg-[var(--cyber-primary)]/15 text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/30'
                : 'text-[#8493a8] hover:text-white hover:bg-[#121929]'
            }`}
          >
            <Layers size={14} />
            <span>Todas las Tareas</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#121929] text-[#94a3b8]">
              {tasks.length}
            </span>
          </button>

          <button
            onClick={() => setViewTab('favorites')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              viewTab === 'favorites'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-[#8493a8] hover:text-white hover:bg-[#121929]'
            }`}
          >
            <Star size={14} className="fill-amber-400/30 text-amber-400" />
            <span>Favoritas</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#121929] text-[#94a3b8]">
              {tasks.filter((t) => t.is_favorite === 1).length}
            </span>
          </button>

          <button
            onClick={() => setViewTab('trash')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              viewTab === 'trash'
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : 'text-[#8493a8] hover:text-white hover:bg-[#121929]'
            }`}
          >
            <Trash2 size={14} />
            <span>Papelera</span>
            {trashedTasks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-400 font-bold">
                {trashedTasks.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Import / Export / Create */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111928] text-[#8493a8] hover:text-white hover:bg-[#1a2538] border border-[#202e48] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Importar tareas desde archivo JSON"
          >
            <Upload size={13} />
            <span className="hidden sm:inline">Importar</span>
          </button>

          <button
            onClick={() => handleExportTasks(selectedTaskIds.length > 0 ? selectedTaskIds : undefined)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111928] text-[#8493a8] hover:text-white hover:bg-[#1a2538] border border-[#202e48] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Exportar tareas seleccionadas o todas en JSON"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          {isOperator && (
            <button
              onClick={() => {
                setEditingTask(null);
                setIsTaskModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-[var(--cyber-primary)]/20 shrink-0 cursor-pointer"
            >
              <Plus size={15} />
              <span>{t('tasks.createTask')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Filter and Search Bar (Active when not in trash) */}
      {viewTab !== 'trash' && (
        <div className="p-4 rounded-xl bg-[#0e1422] border border-[#1e2b45] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('tasks.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] transition-colors font-mono"
            />
            <Search size={15} className="absolute left-3.5 top-3 text-[#64748b]" />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Destination Filter */}
            <select
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)]"
            >
              <option value="">{t('tasks.filterDestination') || 'Todos los Destinos'}</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.os_name || d.system_type})
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)]"
            >
              <option value="">{t('tasks.filterCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)]"
            >
              <option value="">{t('tasks.filterStatus')}</option>
              <option value="active">{t('tasks.active')}</option>
              <option value="disabled">{t('tasks.disabled')}</option>
              <option value="paused">Pausadas</option>
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)]"
            >
              <option value="">{t('tasks.filterType')}</option>
              <option value="command">{t('tasks.types?.command') || 'Comando'}</option>
              <option value="http">{t('tasks.types?.http') || 'HTTP'}</option>
              <option value="script">{t('tasks.types?.script') || 'Script'}</option>
            </select>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedTaskIds.length > 0 && (
        <div className="p-3 rounded-xl bg-[#111928] border border-[var(--cyber-primary)]/50 shadow-2xl flex items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <span className="px-2 py-0.5 rounded bg-[var(--cyber-primary)] text-black font-bold">
              {selectedTaskIds.length}
            </span>
            <span>tareas seleccionadas</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {viewTab === 'trash' ? (
              <>
                <button
                  onClick={() => handleBulkAction('restore_trash')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors font-semibold flex items-center gap-1.5"
                >
                  <RotateCcw size={13} /> Restaurar
                </button>
                <button
                  onClick={() => handleBulkAction('delete_permanent')}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors font-semibold flex items-center gap-1.5"
                >
                  <Trash2 size={13} /> Eliminar Definitivamente
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleBulkAction('activate')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors font-semibold"
                >
                  Activar
                </button>
                <button
                  onClick={() => handleBulkAction('deactivate')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-700/40 text-slate-300 border border-slate-600/50 hover:bg-slate-700/60 transition-colors font-semibold"
                >
                  Desactivar
                </button>
                <button
                  onClick={() => handleBulkAction('pause')}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors font-semibold"
                >
                  Pausar
                </button>
                <button
                  onClick={() => handleBulkAction('run')}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--cyber-primary)]/20 text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/40 hover:bg-[var(--cyber-primary)]/30 transition-colors font-semibold"
                >
                  Ejecutar
                </button>
                <button
                  onClick={() => handleBulkAction('move_to_trash')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors font-semibold flex items-center gap-1"
                >
                  <Trash2 size={13} /> A Papelera
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedTaskIds([])}
              className="px-2.5 py-1.5 rounded-lg text-[#8493a8] hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tasks Table / Grid */}
      <div className="rounded-xl bg-[#0e1422] border border-[#1e2b45] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-[#8493a8]">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
            <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="p-12 text-center text-[#8493a8]">
            <Layers className="w-12 h-12 mx-auto text-[#2b3a55] mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">
              {viewTab === 'trash' ? 'La papelera de reciclaje está vacía' : 'No hay tareas configuradas'}
            </h3>
            <p className="text-xs text-[#64748b] max-w-sm mx-auto mb-4">
              {viewTab === 'trash'
                ? 'Las tareas eliminadas se conservan aquí antes de su borrado definitivo.'
                : 'Crea tu primera tarea programada para comenzar a automatizar ejecuciones en tus destinos.'}
            </p>
            {viewTab !== 'trash' && isOperator && (
              <button
                onClick={() => {
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md shadow-[var(--cyber-primary)]/20"
              >
                <Plus size={15} />
                <span>Crear primera tarea</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1e2b45] bg-[#090d16] text-[11px] font-semibold text-[#8493a8] uppercase tracking-wider">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.length > 0 && selectedTaskIds.length === displayedTasks.length}
                      onChange={toggleSelectAll}
                      className="rounded bg-[#070a12] border-[#1e2b45] text-[var(--cyber-primary)] w-3.5 h-3.5"
                    />
                  </th>
                  <th className="py-3 px-2 w-8"></th>
                  <th className="py-3 px-4">{t('tasks.columns.name')}</th>
                  <th className="py-3 px-4">{t('tasks.columns.destinations')}</th>
                  <th className="py-3 px-4">{t('tasks.columns.category')}</th>
                  <th className="py-3 px-4">{t('tasks.columns.schedule')}</th>
                  <th className="py-3 px-4">{t('tasks.columns.nextRun')}</th>
                  <th className="py-3 px-4">{t('tasks.columns.lastRun')}</th>
                  <th className="py-3 px-4 text-right">{t('tasks.columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162033] text-xs">
                {displayedTasks.map((task) => {
                  const isSelected = selectedTaskIds.includes(task.id);
                  const isPaused = task.state === 'PAUSED';
                  const isFavorite = task.is_favorite === 1;

                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-[#121929] transition-colors group ${
                        isSelected ? 'bg-[var(--cyber-primary)]/5' : ''
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className="py-3.5 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectTask(task.id)}
                          className="rounded bg-[#070a12] border-[#1e2b45] text-[var(--cyber-primary)] w-3.5 h-3.5"
                        />
                      </td>

                      {/* Favorite Star */}
                      <td className="py-3.5 px-2">
                        {viewTab !== 'trash' && (
                          <button
                            onClick={() => handleToggleFavorite(task)}
                            className="p-1 text-[#475569] hover:text-amber-400 transition-colors"
                            title={isFavorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
                          >
                            <Star
                              size={14}
                              className={isFavorite ? 'fill-amber-400 text-amber-400' : ''}
                            />
                          </button>
                        )}
                      </td>

                      {/* Name & Type & Tags */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-[#141d2e] border border-[#223352] shrink-0 mt-0.5">
                            {getTypeIcon(task.task_type)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors">
                                {task.name}
                              </span>
                              
                              {/* State badge */}
                              {isPaused ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                  PAUSADA
                                </span>
                              ) : task.is_active === 1 ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#00ff88]/10 text-[#00ff88]">
                                  {t('tasks.status.active')}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#64748b]/20 text-[#94a3b8]">
                                  {t('tasks.status.disabled')}
                                </span>
                              )}

                              {/* Dependencies indicator */}
                              {task.dependencies && task.dependencies.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  title={`${task.dependencies.length} dependencias`}
                                >
                                  <GitBranch size={10} /> {task.dependencies.length} deps
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p className="text-[11px] text-[#64748b] truncate max-w-sm mt-0.5">
                                {task.description}
                              </p>
                            )}

                            {/* Tags */}
                            {task.tags && Array.isArray(task.tags) && task.tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {task.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono cursor-pointer transition-colors ${
                                      selectedTag === tag
                                        ? 'bg-[var(--cyber-primary)] text-black font-bold'
                                        : 'bg-[#141d2e] text-[#8493a8] hover:text-white'
                                    }`}
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Target Host / Destination Column */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {task.target_type === 'local' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e293b]/60 border border-[#334155]/60 text-[#94a3b8] text-[11px]">
                            <Terminal size={12} className="text-[#94a3b8]" />
                            <span>Local (ELYS)</span>
                          </span>
                        ) : task.target_type === 'group' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-[11px]">
                            <Server size={12} />
                            <span className="capitalize">Grupo: {task.target_group?.replace('_', ' ') || 'Hosts'}</span>
                          </span>
                        ) : task.destinations && task.destinations.length > 0 ? (
                          <div className="flex flex-col gap-1 max-w-[180px]">
                            {task.destinations.slice(0, 2).map((d) => {
                              const isWin = d.system_type?.includes('windows');
                              const isLinux = d.system_type === 'linux';
                              return (
                                <span
                                  key={d.id}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border truncate ${
                                    isWin
                                      ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff]'
                                      : isLinux
                                      ? 'bg-[#ff9900]/10 border-[#ff9900]/30 text-[#ff9900]'
                                      : 'bg-[#a855f7]/10 border-[#a855f7]/30 text-[#a855f7]'
                                  }`}
                                  title={`${d.name} (${d.os_name || d.system_type})`}
                                >
                                  <Server size={11} className="shrink-0" />
                                  <span className="font-bold truncate">{d.name}</span>
                                </span>
                              );
                            })}
                            {task.destinations.length > 2 && (
                              <span className="text-[10px] text-[#64748b]">
                                +{task.destinations.length - 2} más...
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#64748b] text-[11px] italic">Sin destino</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        {task.category_name ? (
                          <span
                            className="px-2.5 py-1 rounded-md text-[11px] font-mono inline-block"
                            style={{
                              backgroundColor: `${task.category_color}15`,
                              color: task.category_color,
                              border: `1px solid ${task.category_color}35`,
                            }}
                          >
                            {task.category_name}
                          </span>
                        ) : (
                          <span className="text-[#64748b] text-[11px]">—</span>
                        )}
                      </td>

                      {/* Schedule */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="text-white block font-semibold">
                          {task.schedule_expression}
                        </span>
                        <span className="text-[10px] text-[#64748b] uppercase">
                          {task.schedule_type} {task.timezone && task.timezone !== 'UTC' ? `(${task.timezone})` : ''}
                        </span>
                      </td>

                      {/* Next Run */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {task.is_active === 1 && !isPaused && task.next_run_at ? (
                          <div>
                            <span className="text-[var(--cyber-primary)] font-semibold block">
                              {new Date(task.next_run_at).toLocaleTimeString()}
                            </span>
                            <span className="text-[10px] text-[#64748b] block">
                              {new Date(task.next_run_at).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#64748b] text-xs">
                            {isPaused ? 'Pausada' : '—'}
                          </span>
                        )}
                      </td>

                      {/* Last Run & Status */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {task.last_run_at ? (
                          <div className="flex items-center gap-2">
                            {task.last_status === 'success' && (
                              <CheckCircle2 size={14} className="text-[#00ff88]" />
                            )}
                            {task.last_status === 'failed' && (
                              <XCircle size={14} className="text-[#ff0055]" />
                            )}
                            <div>
                              <span className="text-white block">
                                {new Date(task.last_run_at).toLocaleTimeString()}
                              </span>
                              <span className="text-[10px] text-[#64748b] block">
                                {task.last_duration_ms ? `${task.last_duration_ms}ms` : ''}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#64748b] text-xs">Nunca</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {viewTab === 'trash' ? (
                            <>
                              {/* Restore button */}
                              <button
                                onClick={() => handleRestoreFromTrash(task.id)}
                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                                title="Restaurar tarea"
                              >
                                <RotateCcw size={14} />
                              </button>

                              {/* Permanent delete button */}
                              <button
                                onClick={() => handleDeleteClick(task, true)}
                                className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
                                title="Eliminar definitivamente"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Run / Execute */}
                              {isOperator && (
                                <button
                                  onClick={() => setExecutingTaskModal(task)}
                                  disabled={runningTaskId === task.id}
                                  className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[var(--cyber-primary)] text-[var(--cyber-primary)] hover:text-black transition-colors cursor-pointer"
                                  title="Ejecutar tarea..."
                                >
                                  <Play size={14} className={runningTaskId === task.id ? 'animate-spin' : ''} />
                                </button>
                              )}

                              {/* Dry Run / Simulation */}
                              {isOperator && (
                                <button
                                  onClick={() => handleManualRun(task, true)}
                                  disabled={runningTaskId === task.id}
                                  className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-purple-600 text-purple-400 hover:text-white transition-colors"
                                  title="Simular ejecución (Dry Run)"
                                >
                                  <Sparkles size={14} />
                                </button>
                              )}

                              {/* Toggle Pause */}
                              {isOperator && (
                                <button
                                  onClick={() => handleTogglePause(task)}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    isPaused
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                      : 'bg-[#141d2e] text-[#8493a8] border-[#223352] hover:text-white'
                                  }`}
                                  title={isPaused ? 'Reanudar tarea' : 'Pausar temporalmente'}
                                >
                                  <Pause size={14} />
                                </button>
                              )}

                              {/* Preview Resolved Command */}
                              <button
                                onClick={() => handlePreviewCommand(task)}
                                className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#1f2b42] text-[#8493a8] hover:text-white transition-colors"
                                title="Previsualizar comando resuelto"
                              >
                                <Eye size={14} />
                              </button>

                              {/* Audit Change History */}
                              <button
                                onClick={() => handleShowHistory(task)}
                                className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#1f2b42] text-[#8493a8] hover:text-white transition-colors"
                                title="Historial de cambios y auditoría"
                              >
                                <History size={14} />
                              </button>

                              {/* Duplicate */}
                              {isOperator && (
                                <button
                                  onClick={() => handleDuplicate(task)}
                                  className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#1f2b42] text-[#8493a8] hover:text-white transition-colors"
                                  title={t('tasks.actions.duplicate')}
                                >
                                  <Copy size={14} />
                                </button>
                              )}

                              {/* Edit */}
                              {isOperator && (
                                <button
                                  onClick={() => {
                                    setEditingTask(task);
                                    setIsTaskModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#1f2b42] text-[#8493a8] hover:text-white transition-colors"
                                  title={t('tasks.actions.edit')}
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}

                              {/* Move to Trash */}
                              {isOperator && (
                                <button
                                  onClick={() => handleDeleteClick(task, false)}
                                  className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#ff0055]/20 text-[#8493a8] hover:text-[#ff0055] transition-colors"
                                  title="Mover a la papelera"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task Modal (Create / Edit) */}
      <TaskModal
        isOpen={isTaskModalOpen}
        task={editingTask}
        allTasks={tasks}
        categories={categories}
        destinations={destinations}
        credentials={credentials}
        templates={templates}
        prefilledTemplate={prefilledTemplate}
        onSave={handleCreateOrEdit}
        onClose={() => {
          setIsTaskModalOpen(false);
          if (onClearPrefilledTemplate) {
            onClearPrefilledTemplate();
          }
        }}
      />

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        title={isPermanentDelete ? 'Eliminar Definitivamente' : t('tasks.deleteConfirmTitle')}
        message={
          isPermanentDelete
            ? `¿Estás seguro de eliminar permanentemente la tarea "${deletingTask?.name}"? Esta acción borrará todas sus dependencias y no se puede deshacer.`
            : `¿Mover la tarea "${deletingTask?.name}" a la papelera? Podrás restaurarla en cualquier momento desde la pestaña "Papelera".`
        }
        onConfirm={handleDeleteConfirm}
        onClose={() => setIsConfirmDeleteOpen(false)}
        isDestructive={true}
      />

      {/* Command Preview Modal */}
      {previewTaskData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl bg-[#0c1220] border border-[#202e48] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-[var(--cyber-primary)]" />
                <h3 className="text-base font-bold text-white">
                  Previsualización de Comando: {previewTaskData.taskName}
                </h3>
              </div>
              <button
                onClick={() => setPreviewTaskData(null)}
                className="text-[#64748b] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <div className="text-xs text-[#8493a8] mb-1 font-semibold uppercase">
                Comando con variables interpoladas y secretos ocultos:
              </div>
              <div className="p-4 rounded-lg bg-[#070a12] border border-[#1e2b45] font-mono text-xs text-[var(--cyber-primary)] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
                {previewTaskData.resolvedScript}
              </div>
            </div>

            {previewTaskData.targets.length > 0 && (
              <div>
                <div className="text-xs text-[#8493a8] mb-1 font-semibold uppercase">
                  Destinos evaluados:
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {previewTaskData.targets.map((t: any) => (
                    <span
                      key={t.destination_id || t.id}
                      className="px-2 py-1 rounded bg-[#111928] border border-[#1e2b45] text-xs font-mono text-white flex items-center gap-1.5"
                    >
                      <Server size={12} className="text-[var(--cyber-primary)]" />
                      {t.destination_name || t.name} ({t.os_name || t.hostname})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[#182338]">
              <button
                onClick={() => setPreviewTaskData(null)}
                className="px-4 py-2 rounded-lg bg-[#141d2e] hover:bg-[#1e2b45] text-white text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task History Modal */}
      {historyTaskData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-3xl rounded-2xl bg-[#0c1220] border border-[#202e48] shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
              <div className="flex items-center gap-2">
                <History size={18} className="text-[var(--cyber-primary)]" />
                <h3 className="text-base font-bold text-white">
                  Historial de Auditoría: {historyTaskData.taskName}
                </h3>
              </div>
              <button
                onClick={() => setHistoryTaskData(null)}
                className="text-[#64748b] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {historyLoading ? (
                <div className="text-center py-8 text-[#8493a8]">Cargando historial...</div>
              ) : historyTaskData.items.length === 0 ? (
                <div className="text-center py-8 text-[#64748b]">No hay registros de auditoría para esta tarea.</div>
              ) : (
                <div className="border border-[#1e2b45] rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-[#090d16] text-[#64748b] uppercase border-b border-[#1e2b45]">
                      <tr>
                        <th className="py-2.5 px-3">Fecha y Hora</th>
                        <th className="py-2.5 px-3">Acción</th>
                        <th className="py-2.5 px-3">Usuario</th>
                        <th className="py-2.5 px-3">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#182338] bg-[#0c1220]">
                      {historyTaskData.items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#111928]">
                          <td className="py-2.5 px-3 text-[#64748b] whitespace-nowrap">
                            {new Date(item.created_at).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#141d2e] text-[var(--cyber-primary)] border border-[#223352]">
                              {item.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-white font-semibold">
                            {item.changed_by}
                          </td>
                          <td className="py-2.5 px-3 text-[#94a3b8]">
                            {item.change_summary || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#182338]">
              <button
                onClick={() => setHistoryTaskData(null)}
                className="px-4 py-2 rounded-lg bg-[#141d2e] hover:bg-[#1e2b45] text-white text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Execute Modal */}
      <ExecuteTaskModal
        isOpen={!!executingTaskModal}
        task={executingTaskModal}
        onClose={() => setExecutingTaskModal(null)}
        onConfirm={handleConfirmModalExecute}
      />

      {/* Latest manual run result modal */}
      <ExecutionDetailsModal
        execution={latestExecution}
        onClose={() => setLatestExecution(null)}
      />
    </div>
  );
};
