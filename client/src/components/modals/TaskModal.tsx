import React, { useState, useEffect } from 'react';
import { 
  X, Clock, Terminal, Globe, Code, Calendar, AlertCircle, 
  Server, Shield, Layers, Plus, Trash2, Key, Cpu, GitBranch, 
  Settings2, Bell, Check, Copy, HelpCircle, Sparkles, ChevronRight, Play, ArrowRight 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { 
  Task, Category, Destination, Credential, Template, 
  CommandType, ScheduleType, TaskVariable, TaskDependency 
} from '../../types/index.js';
import { api } from '../../services/api.js';

interface TaskModalProps {
  isOpen: boolean;
  task: Task | null;
  categories: Category[];
  destinations: Destination[];
  credentials: Credential[];
  templates: Template[];
  allTasks?: Task[];
  prefilledTemplate?: Template | null;
  onSave: (taskData: any) => Promise<void>;
  onClose: () => void;
}

type TabType = 'general' | 'destinations' | 'command' | 'schedule' | 'concurrency' | 'variables' | 'dependencies' | 'notifications';

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET/CEST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
  { value: 'America/Buenos_Aires', label: 'America/Buenos_Aires (ART)' },
  { value: 'America/Mexico_City', label: 'America/Mexico_City (CST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  task,
  categories,
  destinations,
  credentials,
  templates,
  allTasks = [],
  prefilledTemplate,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const [modalMode, setModalMode] = useState<'basic' | 'advanced'>('basic');
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [tagsInput, setTagsInput] = useState('');

  // Target destinations
  const [targetType, setTargetType] = useState<'single' | 'multiple' | 'group' | 'local'>('single');
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<string[]>([]);
  const [targetGroup, setTargetGroup] = useState('windows_server');
  const [credentialId, setCredentialId] = useState('');
  const [multitargetErrorPolicy, setMultitargetErrorPolicy] = useState<'continue_others' | 'abort_group'>('continue_others');
  const [targetParamsRaw, setTargetParamsRaw] = useState('{}');

  // Execution & Command
  const [commandType, setCommandType] = useState<CommandType>('powershell');
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(300);

  // HTTP webhook options
  const [httpUrl, setHttpUrl] = useState('');
  const [httpMethod, setHttpMethod] = useState('GET');
  const [httpHeaders, setHttpHeaders] = useState('');
  const [httpBody, setHttpBody] = useState('');

  // Scheduling & Timezone
  const [scheduleType, setScheduleType] = useState<ScheduleType>('daily');
  const [scheduleExpression, setScheduleExpression] = useState('03:00');
  const [intervalVal, setIntervalVal] = useState('15');
  const [intervalUnit, setIntervalUnit] = useState('m');
  const [weeklyDay, setWeeklyDay] = useState('1');
  const [weeklyTime, setWeeklyTime] = useState('09:00');
  const [monthlyDay, setMonthlyDay] = useState('1');
  const [monthlyTime, setMonthlyTime] = useState('00:00');
  const [onceDateTime, setOnceDateTime] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [misfirePolicy, setMisfirePolicy] = useState<'run_immediately' | 'skip' | 'tolerance_window'>('run_immediately');
  const [misfireToleranceMinutes, setMisfireToleranceMinutes] = useState(15);

  // Concurrency & Retries
  const [concurrencyLimit, setConcurrencyLimit] = useState(1);
  const [concurrencyPolicy, setConcurrencyPolicy] = useState<'allow' | 'block' | 'queue' | 'replace'>('block');
  const [maxRetries, setMaxRetries] = useState(0);
  const [retryIntervalSeconds, setRetryIntervalSeconds] = useState(60);
  const [retryBackoff, setRetryBackoff] = useState<'fixed' | 'progressive'>('fixed');
  const [onError, setOnError] = useState<'continue' | 'abort' | 'retry'>('continue');

  // Variables
  const [variables, setVariables] = useState<TaskVariable[]>([]);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Dependencies
  const [dependencies, setDependencies] = useState<Array<{ depends_on_task_id: string; condition: 'success' | 'failed' | 'completed' }>>([]);

  // Notifications
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(true);
  const [notifyOnFail, setNotifyOnFail] = useState(true);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setName(task.name);
      setDescription(task.description || '');
      setCategoryId(task.category_id || '');
      setTemplateId(task.template_id || '');
      setCredentialId(task.credential_id || '');
      setTargetType(task.target_type || 'single');
      setTargetGroup(task.target_group || 'windows_server');
      setSelectedDestinationIds(task.destinations?.map((d) => d.id) || []);
      setMultitargetErrorPolicy(
        task.multitarget_error_policy === 'stop_all' || task.multitarget_error_policy === 'abort_group'
          ? 'abort_group'
          : 'continue_others'
      );
      setTargetParamsRaw(
        typeof task.target_params === 'object' 
          ? JSON.stringify(task.target_params, null, 2) 
          : (task.target_params || '{}')
      );

      setCommandType(task.command_type || 'powershell');
      setIsActive(task.is_active === 1);
      setScheduleType(task.schedule_type);
      setScheduleExpression(task.schedule_expression);
      setTimezone(task.timezone || 'UTC');
      setTimeoutSeconds(task.timeout_seconds || 300);
      setMisfirePolicy(task.misfire_policy || 'run_immediately');
      setMisfireToleranceMinutes(task.misfire_tolerance_minutes || 15);

      setConcurrencyLimit(task.concurrency_limit || 1);
      setConcurrencyPolicy(task.concurrency_policy || 'block');
      setMaxRetries(task.max_retries || 0);
      setRetryIntervalSeconds(task.retry_interval_seconds || 60);
      setRetryBackoff(task.retry_backoff || 'fixed');
      setOnError(task.on_error || 'continue');

      // Variables
      if (Array.isArray(task.variables)) {
        setVariables(task.variables);
      } else {
        try {
          setVariables(JSON.parse(task.variables || '[]'));
        } catch {
          setVariables([]);
        }
      }

      // Dependencies
      if (Array.isArray(task.dependencies)) {
        setDependencies(task.dependencies.map(d => ({
          depends_on_task_id: d.depends_on_task_id,
          condition: d.condition
        })));
      } else if (task.id) {
        api.getTaskDependencies(task.id)
          .then(res => {
            if (res.dependencies) {
              setDependencies(res.dependencies.map(d => ({
                depends_on_task_id: d.depends_on_task_id,
                condition: d.condition
              })));
            }
          })
          .catch(() => {});
      }

      // Notifications
      setNotifyTelegram(Boolean(task.notify_telegram));
      setNotifyEmail(Boolean(task.notify_email));
      setNotifyOnSuccess(task.notify_on_success !== 0);
      setNotifyOnFail(task.notify_on_fail !== 0);

      try {
        const payload = JSON.parse(task.payload);
        if (task.command_type === 'http') {
          setHttpUrl(payload.url || '');
          setHttpMethod(payload.method || 'GET');
          setHttpHeaders(payload.headers ? JSON.stringify(payload.headers, null, 2) : '');
          setHttpBody(typeof payload.body === 'object' ? JSON.stringify(payload.body, null, 2) : (payload.body || ''));
        } else {
          setCommand(payload.command || '');
          setCwd(payload.cwd || '');
        }
      } catch {
        setCommand(task.payload || '');
      }

      if (task.schedule_type === 'interval') {
        const match = task.schedule_expression.match(/^(\d+)\s*([smhd])$/i);
        if (match) {
          setIntervalVal(match[1]);
          setIntervalUnit(match[2].toLowerCase());
        }
      } else if (task.schedule_type === 'weekly') {
        const [d, time] = task.schedule_expression.split(',');
        setWeeklyDay(d || '1');
        setWeeklyTime(time || '09:00');
      } else if (task.schedule_type === 'monthly') {
        const [d, time] = task.schedule_expression.split(',');
        setMonthlyDay(d || '1');
        setMonthlyTime(time || '00:00');
      } else if (task.schedule_type === 'once') {
        setOnceDateTime(task.schedule_expression);
      }

      try {
        const parsedTags = typeof task.tags === 'string' ? JSON.parse(task.tags || '[]') : task.tags;
        setTagsInput(Array.isArray(parsedTags) ? parsedTags.join(', ') : '');
      } catch {
        setTagsInput(typeof task.tags === 'string' ? task.tags : '');
      }
    } else if (prefilledTemplate) {
      setName(prefilledTemplate.name);
      setDescription(prefilledTemplate.description || '');
      setTemplateId(prefilledTemplate.id);
      setCommandType(prefilledTemplate.command_type as CommandType);
      setCommand(prefilledTemplate.command_template);
      setTimeoutSeconds(prefilledTemplate.default_timeout || 300);
      setTargetType('single');
      setSelectedDestinationIds(destinations.length > 0 ? [destinations[0].id] : []);
      setIsActive(true);
      setScheduleType('daily');
      setScheduleExpression('03:00');
      setVariables([]);
      setDependencies([]);
    } else {
      setName('');
      setDescription('');
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      setTemplateId('');
      setCredentialId(credentials.length > 0 ? credentials[0].id : '');
      setTargetType('single');
      setSelectedDestinationIds(destinations.length > 0 ? [destinations[0].id] : []);
      setTargetGroup('windows_server');
      setMultitargetErrorPolicy('continue_others');
      setTargetParamsRaw('{}');
      setCommandType('powershell');
      setCommand('Write-Output "Ejecución iniciada con éxito en destino"');
      setCwd('');
      setHttpUrl('');
      setHttpMethod('GET');
      setHttpHeaders('');
      setHttpBody('');
      setScheduleType('daily');
      setScheduleExpression('03:00');
      setIntervalVal('15');
      setIntervalUnit('m');
      setWeeklyDay('1');
      setWeeklyTime('09:00');
      setMonthlyDay('1');
      setMonthlyTime('00:00');
      setTimezone('UTC');
      setMisfirePolicy('run_immediately');
      setMisfireToleranceMinutes(15);
      setConcurrencyLimit(1);
      setConcurrencyPolicy('block');
      setTimeoutSeconds(300);
      setMaxRetries(0);
      setRetryIntervalSeconds(60);
      setRetryBackoff('fixed');
      setOnError('continue');
      setTagsInput('');
      setVariables([]);
      setDependencies([]);
      setNotifyTelegram(false);
      setNotifyEmail(false);
      setNotifyOnSuccess(true);
      setNotifyOnFail(true);
      setIsActive(true);
    }
    setError(null);
  }, [task, prefilledTemplate, isOpen, categories, destinations, credentials]);

  if (!isOpen) return null;

  const handleApplyTemplate = (tmplId: string) => {
    setTemplateId(tmplId);
    const found = templates.find((t) => t.id === tmplId);
    if (found) {
      if (!name) setName(found.name);
      if (!description) setDescription(found.description || '');
      setCommandType(found.command_type as CommandType);
      setCommand(found.command_template);
      setTimeoutSeconds(found.default_timeout);
    }
  };

  const getCompiledScheduleExpression = (): string => {
    switch (scheduleType) {
      case 'interval':
        return `${intervalVal}${intervalUnit}`;
      case 'daily':
        return scheduleExpression;
      case 'weekly':
        return `${weeklyDay},${weeklyTime}`;
      case 'monthly':
        return `${monthlyDay},${monthlyTime}`;
      case 'cron':
        return scheduleExpression;
      case 'hourly':
        return scheduleExpression;
      case 'once':
        return onceDateTime;
      default:
        return scheduleExpression;
    }
  };

  const toggleDestinationSelection = (destId: string) => {
    if (targetType === 'single') {
      setSelectedDestinationIds([destId]);
    } else {
      if (selectedDestinationIds.includes(destId)) {
        setSelectedDestinationIds(selectedDestinationIds.filter((id) => id !== destId));
      } else {
        setSelectedDestinationIds([...selectedDestinationIds, destId]);
      }
    }
  };

  // Variables Management
  const addVariable = () => {
    setVariables([...variables, { key: '', value: '', is_secret: false }]);
  };

  const updateVariable = (index: number, field: keyof TaskVariable, val: any) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: val };
    setVariables(updated);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, idx) => idx !== index));
  };

  const copyVariableExample = (example: string) => {
    navigator.clipboard.writeText(example);
    setCopiedVar(example);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  // Dependencies Management
  const addDependency = () => {
    const available = allTasks.filter(t => t.id !== task?.id && !dependencies.some(d => d.depends_on_task_id === t.id));
    if (available.length === 0) return;
    setDependencies([...dependencies, { depends_on_task_id: available[0].id, condition: 'success' }]);
  };

  const updateDependency = (index: number, field: 'depends_on_task_id' | 'condition', val: any) => {
    const updated = [...dependencies];
    updated[index] = { ...updated[index], [field]: val };
    setDependencies(updated);
  };

  const removeDependency = (index: number) => {
    setDependencies(dependencies.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre de la tarea es obligatorio');
      setActiveTab('general');
      return;
    }

    const compiledExpression = getCompiledScheduleExpression();
    if (!compiledExpression) {
      setError('La configuración del horario es obligatoria');
      setActiveTab('schedule');
      return;
    }

    let payloadObj: any = {};
    if (commandType === 'http') {
      if (!httpUrl.trim()) {
        setError('La URL de petición HTTP es obligatoria');
        setActiveTab('command');
        return;
      }
      payloadObj = { url: httpUrl.trim(), method: httpMethod };
      if (httpHeaders.trim()) {
        try {
          payloadObj.headers = JSON.parse(httpHeaders.trim());
        } catch {
          setError('Las cabeceras HTTP deben ser un JSON válido');
          setActiveTab('command');
          return;
        }
      }
      if (httpBody.trim()) {
        try {
          payloadObj.body = JSON.parse(httpBody.trim());
        } catch {
          payloadObj.body = httpBody.trim();
        }
      }
    } else {
      if (!command.trim()) {
        setError('El comando a ejecutar es obligatorio');
        setActiveTab('command');
        return;
      }
      payloadObj = { command: command.trim(), cwd: cwd.trim() || undefined };
    }

    // Validate targetParams
    let parsedTargetParams = {};
    if (targetParamsRaw.trim()) {
      try {
        parsedTargetParams = JSON.parse(targetParamsRaw.trim());
      } catch {
        setError('Los parámetros por destino deben ser un objeto JSON válido');
        setActiveTab('destinations');
        return;
      }
    }

    // Filter valid variables
    const validVariables = variables
      .filter(v => v.key.trim().length > 0)
      .map(v => ({
        key: v.key.trim().toLowerCase(),
        value: v.value,
        is_secret: Boolean(v.is_secret)
      }));

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        categoryId: categoryId || null,
        templateId: templateId || null,
        credentialId: credentialId || null,
        targetType,
        targetGroup: targetType === 'group' ? targetGroup : null,
        destinationIds: targetType === 'local' ? [] : selectedDestinationIds,
        multitargetErrorPolicy,
        targetParams: parsedTargetParams,
        taskType: commandType === 'http' ? 'http' : 'command',
        commandType,
        payload: payloadObj,
        scheduleType,
        scheduleExpression: compiledExpression,
        timezone,
        misfirePolicy,
        misfireToleranceMinutes: Number(misfireToleranceMinutes),
        concurrencyLimit: Number(concurrencyLimit),
        concurrencyPolicy,
        timeoutSeconds: Number(timeoutSeconds),
        maxRetries: Number(maxRetries),
        retryIntervalSeconds: Number(retryIntervalSeconds),
        retryBackoff,
        onError,
        isActive: isActive ? 1 : 0,
        tags,
        variables: validVariables,
        dependencies,
        notifyTelegram: notifyTelegram ? 1 : 0,
        notifyEmail: notifyEmail ? 1 : 0,
        notifyOnSuccess: notifyOnSuccess ? 1 : 0,
        notifyOnFail: notifyOnFail ? 1 : 0,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la tarea');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl rounded-2xl bg-[#0c1220] border border-[#202e48] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#182338] bg-[#070a12]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#111928] border border-[#1e2d48] text-[var(--cyber-primary)]">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {task ? t('tasks.modal.editTitle') : t('tasks.modal.createTitle')}
              </h3>
              <p className="text-xs text-[#8493a8]">
                {modalMode === 'basic' ? 'Flujo guiado simple en 3 pasos' : 'Configuración técnica avanzada del scheduler centralizado'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-[#0c1220] border border-[#1e2d48]">
              <button
                type="button"
                onClick={() => setModalMode('basic')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  modalMode === 'basic'
                    ? 'bg-[var(--cyber-primary)] text-black font-bold shadow-sm'
                    : 'text-[#8493a8] hover:text-white'
                }`}
              >
                ✨ Modo Básico
              </button>
              <button
                type="button"
                onClick={() => setModalMode('advanced')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  modalMode === 'advanced'
                    ? 'bg-[var(--cyber-primary)] text-black font-bold shadow-sm'
                    : 'text-[#8493a8] hover:text-white'
                }`}
              >
                ⚙️ Modo Avanzado
              </button>
            </div>

            <button onClick={onClose} className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#182338] cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation (Visible ONLY in Advanced Mode) */}
        {modalMode === 'advanced' && (
          <div className="flex items-center gap-1 px-6 bg-[#080d17] border-b border-[#182338] overflow-x-auto scrollbar-none text-xs font-semibold">
            {[
              { id: 'general', label: 'General', icon: Settings2 },
              { id: 'destinations', label: 'Destinos & Parámetros', icon: Server },
              { id: 'command', label: 'Comando / HTTP', icon: Terminal },
              { id: 'schedule', label: 'Programación & Timezone', icon: Clock },
              { id: 'concurrency', label: 'Concurrencia & Reintentos', icon: Cpu },
              { id: 'variables', label: `Variables (${variables.length})`, icon: Key },
              { id: 'dependencies', label: `Dependencias (${dependencies.length})`, icon: GitBranch },
              { id: 'notifications', label: 'Notificaciones', icon: Bell },
            ].map((tab) => {
              const Icon = tab.icon;
              const isCurrent = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    isCurrent
                      ? 'border-[var(--cyber-primary)] text-[var(--cyber-primary)] bg-[#101726]'
                      : 'border-transparent text-[#8493a8] hover:text-white hover:bg-[#0c1220]'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-[#ff0055]/10 border border-[#ff0055]/30 text-xs text-[#ff5588] flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {modalMode === 'basic' ? (
            <div className="space-y-6">
              {/* Step 1: ¿Qué hace? */}
              <div className="p-4 rounded-xl bg-[#090d16] border border-[#1e2d48] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--cyber-primary)] text-black font-bold flex items-center justify-center text-xs">1</span>
                    <h4 className="font-bold text-white text-sm">¿Qué hace la tarea?</h4>
                  </div>
                  {templates.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#64748b]">Plantilla rápida:</span>
                      <select
                        value={templateId}
                        onChange={(e) => handleApplyTemplate(e.target.value)}
                        className="px-2 py-1 rounded bg-[#070a12] border border-[#1e2b45] text-white text-xs cursor-pointer"
                      >
                        <option value="">(Sin plantilla)</option>
                        {templates.map(tmpl => (
                          <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-[#8493a8] uppercase text-[11px] mb-1">
                      {t('tasks.modal.name')} *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Backup Base de Datos Producción, Limpieza de Logs..."
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase text-[11px] mb-1">
                      Tipo de Ejecución
                    </label>
                    <select
                      value={commandType}
                      onChange={(e) => setCommandType(e.target.value as CommandType)}
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] cursor-pointer"
                    >
                      <option value="powershell">PowerShell (Windows)</option>
                      <option value="bash">Bash / Shell (Linux/macOS)</option>
                      <option value="cmd">CMD (Windows)</option>
                      <option value="http">Petición HTTP / Webhook</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase text-[11px] mb-1">
                    {t('tasks.modal.description')} (Opcional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción rápida para identificar la tarea en el Dashboard"
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)]"
                  />
                </div>

                {commandType === 'http' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-[#8493a8] uppercase text-[11px] mb-1">Método</label>
                      <select
                        value={httpMethod}
                        onChange={(e) => setHttpMethod(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-[#8493a8] uppercase text-[11px] mb-1">URL del Webhook / Endpoint *</label>
                      <input
                        type="url"
                        value={httpUrl}
                        onChange={(e) => setHttpUrl(e.target.value)}
                        placeholder="https://api.empresa.com/v1/trigger"
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase text-[11px] mb-1">Comando o Script a ejecutar *</label>
                    <textarea
                      rows={3}
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="Introduce los comandos a ejecutar..."
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono focus:outline-none focus:border-[var(--cyber-primary)]"
                    />
                  </div>
                )}
              </div>

              {/* Step 2: ¿Dónde se ejecuta? */}
              <div className="p-4 rounded-xl bg-[#090d16] border border-[#1e2d48] space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-[#182338]">
                  <span className="w-6 h-6 rounded-full bg-[var(--cyber-primary)] text-black font-bold flex items-center justify-center text-xs">2</span>
                  <h4 className="font-bold text-white text-sm">¿Dónde se ejecuta?</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => { setTargetType('local'); setSelectedDestinationIds([]); }}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      targetType === 'local'
                        ? 'bg-[#101b2e] border-[var(--cyber-primary)] text-white shadow-sm'
                        : 'bg-[#070a12] border-[#1e2b45] text-[#8493a8] hover:border-[#2a3c5d]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetTypeBasic"
                      checked={targetType === 'local'}
                      onChange={() => { setTargetType('local'); setSelectedDestinationIds([]); }}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>🖥️ Host Local de ELYS</span>
                      </div>
                      <p className="text-[11px] text-[#64748b] mt-0.5">
                        Se ejecuta directamente en el host o contenedor central donde corre ELYS.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setTargetType('single');
                      if (selectedDestinationIds.length === 0 && destinations.length > 0) {
                        setSelectedDestinationIds([destinations[0].id]);
                      }
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      targetType !== 'local'
                        ? 'bg-[#101b2e] border-[var(--cyber-primary)] text-white shadow-sm'
                        : 'bg-[#070a12] border-[#1e2b45] text-[#8493a8] hover:border-[#2a3c5d]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetTypeBasic"
                      checked={targetType !== 'local'}
                      onChange={() => {
                        setTargetType('single');
                        if (selectedDestinationIds.length === 0 && destinations.length > 0) {
                          setSelectedDestinationIds([destinations[0].id]);
                        }
                      }}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>🌐 Servidor Remoto</span>
                      </div>
                      <p className="text-[11px] text-[#64748b] mt-0.5">
                        Ejecutar mediante SSH, WinRM o agente en un equipo de la infraestructura.
                      </p>
                    </div>
                  </div>
                </div>

                {targetType !== 'local' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-semibold text-[#8493a8] uppercase text-[11px] mb-1">
                        Destino Seleccionado *
                      </label>
                      <select
                        value={selectedDestinationIds[0] || ''}
                        onChange={(e) => setSelectedDestinationIds(e.target.value ? [e.target.value] : [])}
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white cursor-pointer"
                      >
                        <option value="">-- Selecciona un destino --</option>
                        {destinations.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.os_name || d.system_type || 'Desconocido'} - {d.hostname})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#8493a8] uppercase text-[11px] mb-1">
                        Credencial Asociada (Opcional)
                      </label>
                      <select
                        value={credentialId}
                        onChange={(e) => setCredentialId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white cursor-pointer"
                      >
                        <option value="">(Usar credencial del destino)</option>
                        {credentials.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: ¿Cuándo se ejecuta? */}
              <div className="p-4 rounded-xl bg-[#090d16] border border-[#1e2d48] space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-[#182338]">
                  <span className="w-6 h-6 rounded-full bg-[var(--cyber-primary)] text-black font-bold flex items-center justify-center text-xs">3</span>
                  <h4 className="font-bold text-white text-sm">¿Cuándo se ejecuta?</h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'daily', label: 'Cada día', desc: 'A una hora fija' },
                    { id: 'hourly', label: 'Cada hora', desc: 'En el minuto indicado' },
                    { id: 'weekly', label: 'Semanal', desc: 'Un día de la semana' },
                    { id: 'interval', label: 'Intervalo', desc: 'Cada N min/horas' },
                    { id: 'once', label: 'Una sola vez', desc: 'Fecha y hora fija' },
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setScheduleType(st.id as ScheduleType)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        scheduleType === st.id
                          ? 'bg-[#101b2e] border-[var(--cyber-primary)] text-white shadow-sm'
                          : 'bg-[#070a12] border-[#1e2b45] text-[#8493a8] hover:border-[#2a3c5d]'
                      }`}
                    >
                      <div className="font-bold text-xs text-white">{st.label}</div>
                      <div className="text-[10px] text-[#64748b]">{st.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Dynamic Schedule Controls */}
                <div className="p-3 rounded-lg bg-[#070a12] border border-[#1e2b45]">
                  {scheduleType === 'daily' && (
                    <div className="flex items-center gap-3">
                      <span className="text-white text-xs">Hora de ejecución diaria:</span>
                      <input
                        type="time"
                        value={scheduleExpression}
                        onChange={(e) => setScheduleExpression(e.target.value)}
                        className="px-3 py-1.5 rounded bg-[#0c1220] border border-[#1e2d48] text-white font-mono"
                      />
                    </div>
                  )}

                  {scheduleType === 'hourly' && (
                    <div className="flex items-center gap-3">
                      <span className="text-white text-xs">Minuto de cada hora (0-59):</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={scheduleExpression}
                        onChange={(e) => setScheduleExpression(e.target.value)}
                        className="w-20 px-3 py-1.5 rounded bg-[#0c1220] border border-[#1e2d48] text-white font-mono"
                      />
                    </div>
                  )}

                  {scheduleType === 'weekly' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-[#8493a8] mb-1">Día de la semana</label>
                        <select
                          value={weeklyDay}
                          onChange={(e) => setWeeklyDay(e.target.value)}
                          className="w-full px-3 py-1.5 rounded bg-[#0c1220] border border-[#1e2d48] text-white"
                        >
                          <option value="1">Lunes</option>
                          <option value="2">Martes</option>
                          <option value="3">Miércoles</option>
                          <option value="4">Jueves</option>
                          <option value="5">Viernes</option>
                          <option value="6">Sábado</option>
                          <option value="0">Domingo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#8493a8] mb-1">Hora</label>
                        <input
                          type="time"
                          value={weeklyTime}
                          onChange={(e) => setWeeklyTime(e.target.value)}
                          className="w-full px-3 py-1.5 rounded bg-[#0c1220] border border-[#1e2d48] text-white font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {scheduleType === 'interval' && (
                    <div className="flex items-center gap-3">
                      <span className="text-white text-xs">Repetir cada:</span>
                      <input
                        type="number"
                        min={1}
                        value={intervalVal}
                        onChange={(e) => setIntervalVal(e.target.value)}
                        className="w-20 px-3 py-1.5 rounded bg-[#0c1220] border border-[#1e2d48] text-white font-mono"
                      />
                      <select
                        value={intervalUnit}
                        onChange={(e) => setIntervalUnit(e.target.value)}
                        className="px-3 py-1.5 rounded bg-[#0c1220] border border-[#1e2d48] text-white"
                      >
                        <option value="m">Minutos</option>
                        <option value="h">Horas</option>
                        <option value="s">Segundos</option>
                      </select>
                    </div>
                  )}

                  {scheduleType === 'once' && (
                    <div className="flex items-center gap-3">
                      <span className="text-white text-xs">Fecha y hora exacta:</span>
                      <input
                        type="datetime-local"
                        value={onceDateTime}
                        onChange={(e) => setOnceDateTime(e.target.value)}
                        className="px-3 py-1.5 rounded bg-[#0c1220] border border-[#1e2d48] text-white font-mono"
                      />
                    </div>
                  )}

                  {scheduleType === 'cron' && (
                    <div className="flex items-center gap-3">
                      <span className="text-white text-xs">Expresión Cron:</span>
                      <input
                        type="text"
                        value={scheduleExpression}
                        onChange={(e) => setScheduleExpression(e.target.value)}
                        placeholder="0 2 * * *"
                        className="px-3 py-1.5 rounded bg-[#0c1220] border border-[#1e2d48] text-white font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Progressive Disclosure Callout */}
              <div className="p-3.5 rounded-xl bg-[#0b1322] border border-[#1d2d47] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles size={16} className="text-[var(--cyber-primary)] shrink-0" />
                  <span className="text-xs text-[#94a3b8]">
                    ¿Necesitas <strong>reintentos automáticos, dependencias, variables de entorno, timeout o concurrencia</strong>?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalMode('advanced')}
                  className="px-3 py-1.5 rounded-lg bg-[#142033] hover:bg-[#1a2b45] text-white text-xs font-semibold flex items-center gap-1 border border-[#233552] transition-colors cursor-pointer shrink-0"
                >
                  <span>Abrir Modo Avanzado</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TAB: GENERAL */}
              {activeTab === 'general' && (
                <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    {t('tasks.modal.name')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('tasks.modal.namePlaceholder')}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Plantilla Rápida
                  </label>
                  <select
                    value={templateId}
                    onChange={(e) => handleApplyTemplate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)]"
                  >
                    <option value="">(Sin plantilla)</option>
                    {templates.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                  {t('tasks.modal.description')}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalla el propósito de la tarea..."
                  className="w-full px-3.5 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    {t('tasks.modal.category')}
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)]"
                  >
                    <option value="">(Sin categoría)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Etiquetas (separadas por comas)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="backup, sql, producción, crítico"
                    className="w-full px-3.5 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded bg-[#070a12] border-[#1e2b45] text-[var(--cyber-primary)] focus:ring-0 w-4 h-4"
                  />
                  <span className="text-white font-medium">Habilitar tarea inmediatamente (Estado ACTIVO)</span>
                </label>
                <p className="text-[#64748b] text-[11px] mt-0.5 ml-6">
                  Si se desmarca, la tarea se guardará en estado DESACTIVADA y no se ejecutará automáticamente.
                </p>
              </div>
            </div>
          )}

          {/* TAB: DESTINOS & PARÁMETROS */}
          {activeTab === 'destinations' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-2">
                  Tipo de Destino
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'single', label: 'Destino Único' },
                    { id: 'multiple', label: 'Multi-Destino' },
                    { id: 'group', label: 'Por Sistema/Grupo' },
                    { id: 'local', label: 'Local (Servidor ELYS)' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setTargetType(mode.id as any)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        targetType === mode.id
                          ? 'bg-[var(--cyber-primary)]/10 border-[var(--cyber-primary)] text-white'
                          : 'bg-[#070a12] border-[#1e2b45] text-[#8493a8] hover:border-[#2e3b55]'
                      }`}
                    >
                      <div className="font-semibold">{mode.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {targetType === 'group' && (
                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Grupo de Sistemas
                  </label>
                  <select
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                  >
                    <option value="windows_server">Windows Server</option>
                    <option value="windows_desktop">Windows Desktop</option>
                    <option value="linux">Linux</option>
                    <option value="bsd">BSD</option>
                    <option value="other">Otros Sistemas</option>
                  </select>
                </div>
              )}

              {targetType !== 'local' && targetType !== 'group' && (
                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    {targetType === 'single' ? 'Seleccionar Destino' : 'Seleccionar Destinos'} ({selectedDestinationIds.length} seleccionados)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg bg-[#070a12] border border-[#1e2b45]">
                    {destinations.map((d) => {
                      const isSelected = selectedDestinationIds.includes(d.id);
                      return (
                        <div
                          key={d.id}
                          onClick={() => toggleDestinationSelection(d.id)}
                          className={`flex items-center gap-2.5 p-2 rounded border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[var(--cyber-primary)]/15 border-[var(--cyber-primary)]/50 text-white'
                              : 'bg-[#090d16] border-[#182338] text-[#8493a8] hover:border-[#202e48]'
                          }`}
                        >
                          <Server size={14} className={isSelected ? 'text-[var(--cyber-primary)]' : 'text-[#64748b]'} />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs truncate">{d.name}</div>
                            <div className="text-[10px] text-[#64748b] font-mono truncate">{d.hostname} • {d.system_type}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Credencial Remota Predeterminada
                  </label>
                  <select
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)]"
                  >
                    <option value="">(Usar credencial asociada al destino)</option>
                    {credentials.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Política de Fallo en Multi-Destino
                  </label>
                  <select
                    value={multitargetErrorPolicy}
                    onChange={(e) => setMultitargetErrorPolicy(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                  >
                    <option value="continue_others">Continuar en los demás destinos (Aislar fallo)</option>
                    <option value="abort_group">Abortar resto de destinos si uno falla</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                  Parámetros Específicos por Destino (JSON)
                </label>
                <textarea
                  rows={3}
                  value={targetParamsRaw}
                  onChange={(e) => setTargetParamsRaw(e.target.value)}
                  placeholder='{ "dest-uuid-1": { "env": "prod", "db_port": 5432 } }'
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-[var(--cyber-primary)] font-mono text-xs focus:outline-none focus:border-[var(--cyber-primary)] resize-none"
                />
                <p className="text-[#64748b] text-[11px] mt-1">
                  Define variables que sobreescriben valores de la tarea según el ID o nombre del destino.
                </p>
              </div>
            </div>
          )}

          {/* TAB: COMANDO / HTTP */}
          {activeTab === 'command' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Tipo de Intérprete
                  </label>
                  <select
                    value={commandType}
                    onChange={(e) => setCommandType(e.target.value as CommandType)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                  >
                    <option value="powershell">PowerShell</option>
                    <option value="bash">Bash / Shell</option>
                    <option value="cmd">CMD (Command Prompt)</option>
                    <option value="python">Python 3</option>
                    <option value="node">Node.js</option>
                    <option value="vbscript">VBScript</option>
                    <option value="http">Petición HTTP / Webhook</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Directorio de Trabajo (cwd)
                  </label>
                  <input
                    type="text"
                    value={cwd}
                    onChange={(e) => setCwd(e.target.value)}
                    placeholder="C:\Scripts o /var/scripts"
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Timeout (segundos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="86400"
                    value={timeoutSeconds}
                    onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                  />
                </div>
              </div>

              {commandType === 'http' ? (
                <div className="space-y-3 p-4 rounded-xl bg-[#090d16] border border-[#182338]">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-1">
                      <label className="block font-semibold text-[#8493a8] uppercase mb-1">Método</label>
                      <select
                        value={httpMethod}
                        onChange={(e) => setHttpMethod(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block font-semibold text-[#8493a8] uppercase mb-1">URL Webhook</label>
                      <input
                        type="url"
                        value={httpUrl}
                        onChange={(e) => setHttpUrl(e.target.value)}
                        placeholder="https://api.empresa.com/v1/jobs/trigger"
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">Cabeceras HTTP (JSON)</label>
                    <textarea
                      rows={2}
                      value={httpHeaders}
                      onChange={(e) => setHttpHeaders(e.target.value)}
                      placeholder='{ "Authorization": "Bearer token", "Content-Type": "application/json" }'
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">Cuerpo / Payload (JSON)</label>
                    <textarea
                      rows={3}
                      value={httpBody}
                      onChange={(e) => setHttpBody(e.target.value)}
                      placeholder='{ "task": "{{task_name}}", "timestamp": "{{timestamp}}" }'
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-[#8493a8] uppercase">
                      Script / Comando a Ejecutar *
                    </label>
                    <span className="text-[11px] text-[var(--cyber-primary)] font-mono">
                      Soporta variables: {'{{hostname}}'}, {'{{date}}'}, etc.
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="Escribe el comando o script a ejecutar..."
                    className="w-full px-3.5 py-3 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono text-xs focus:outline-none focus:border-[var(--cyber-primary)] resize-y leading-relaxed"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB: PROGRAMACIÓN & TIMEZONE */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'daily', label: 'Diario' },
                  { id: 'weekly', label: 'Semanal' },
                  { id: 'monthly', label: 'Mensual' },
                  { id: 'interval', label: 'Intervalo' },
                  { id: 'cron', label: 'Cron' },
                  { id: 'hourly', label: 'Cada Hora' },
                  { id: 'once', label: 'Una Vez' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setScheduleType(st.id as ScheduleType)}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      scheduleType === st.id
                        ? 'bg-[var(--cyber-primary)]/15 border-[var(--cyber-primary)] text-white font-bold'
                        : 'bg-[#070a12] border-[#1e2b45] text-[#8493a8] hover:border-[#2e3b55]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Dynamic Schedule inputs */}
              <div className="p-4 rounded-xl bg-[#090d16] border border-[#182338]">
                {scheduleType === 'daily' && (
                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">Hora de ejecución diaria</label>
                    <input
                      type="time"
                      value={scheduleExpression}
                      onChange={(e) => setScheduleExpression(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                    />
                  </div>
                )}

                {scheduleType === 'interval' && (
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block font-semibold text-[#8493a8] uppercase mb-1">Cada cuanto tiempo</label>
                      <input
                        type="number"
                        min="1"
                        value={intervalVal}
                        onChange={(e) => setIntervalVal(e.target.value)}
                        className="w-24 px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#8493a8] uppercase mb-1">Unidad</label>
                      <select
                        value={intervalUnit}
                        onChange={(e) => setIntervalUnit(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                      >
                        <option value="m">Minutos</option>
                        <option value="h">Horas</option>
                        <option value="s">Segundos</option>
                        <option value="d">Días</option>
                      </select>
                    </div>
                  </div>
                )}

                {scheduleType === 'weekly' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#8493a8] uppercase mb-1">Día de la semana</label>
                      <select
                        value={weeklyDay}
                        onChange={(e) => setWeeklyDay(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                      >
                        <option value="1">Lunes</option>
                        <option value="2">Martes</option>
                        <option value="3">Miércoles</option>
                        <option value="4">Jueves</option>
                        <option value="5">Viernes</option>
                        <option value="6">Sábado</option>
                        <option value="0">Domingo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#8493a8] uppercase mb-1">Hora</label>
                      <input
                        type="time"
                        value={weeklyTime}
                        onChange={(e) => setWeeklyTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                      />
                    </div>
                  </div>
                )}

                {scheduleType === 'monthly' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#8493a8] uppercase mb-1">Día del mes (1-31)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={monthlyDay}
                        onChange={(e) => setMonthlyDay(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#8493a8] uppercase mb-1">Hora</label>
                      <input
                        type="time"
                        value={monthlyTime}
                        onChange={(e) => setMonthlyTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                      />
                    </div>
                  </div>
                )}

                {scheduleType === 'cron' && (
                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">Expresión Cron (5 campos: min hora dom mes dow)</label>
                    <input
                      type="text"
                      value={scheduleExpression}
                      onChange={(e) => setScheduleExpression(e.target.value)}
                      placeholder="0 3 * * 1-5"
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                    />
                  </div>
                )}

                {scheduleType === 'hourly' && (
                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">Minuto de cada hora (:MM)</label>
                    <input
                      type="text"
                      value={scheduleExpression}
                      onChange={(e) => setScheduleExpression(e.target.value)}
                      placeholder=":15"
                      className="w-32 px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                    />
                  </div>
                )}

                {scheduleType === 'once' && (
                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">Fecha y Hora</label>
                    <input
                      type="datetime-local"
                      value={onceDateTime}
                      onChange={(e) => setOnceDateTime(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Timezone & Misfire */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Zona Horaria (Timezone)
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono text-xs"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Política de Ejecuciones Perdidas (Misfire)
                  </label>
                  <select
                    value={misfirePolicy}
                    onChange={(e) => setMisfirePolicy(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono text-xs"
                  >
                    <option value="run_immediately">Ejecutar inmediatamente al recuperar el servicio</option>
                    <option value="skip">Omitir y esperar a la próxima fecha programada</option>
                    <option value="tolerance_window">Ejecutar solo dentro de ventana de tolerancia</option>
                  </select>
                </div>
              </div>

              {misfirePolicy === 'tolerance_window' && (
                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    Ventana de Tolerancia (Minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={misfireToleranceMinutes}
                    onChange={(e) => setMisfireToleranceMinutes(Number(e.target.value))}
                    className="w-36 px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                  />
                  <p className="text-[#64748b] text-[11px] mt-1">
                    Si el scheduler estuvo apagado y la hora perdida fue hace menos de {misfireToleranceMinutes} min, se ejecutará. Si pasó más tiempo, se omitirá.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB: CONCURRENCIA & REINTENTOS */}
          {activeTab === 'concurrency' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#090d16] border border-[#182338] space-y-3">
                <div className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
                  <Cpu size={14} className="text-[var(--cyber-primary)]" />
                  Control de Concurrencia y Bloqueo de Ejecuciones
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                      Límite de Concurrencia Simultánea
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={concurrencyLimit}
                      onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                    />
                    <p className="text-[#64748b] text-[11px] mt-1">
                      Máximo de instancias concurrentes permitidas para esta tarea. Por defecto 1.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                      Política ante Conflicto de Concurrencia
                    </label>
                    <select
                      value={concurrencyPolicy}
                      onChange={(e) => setConcurrencyPolicy(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                    >
                      <option value="block">Bloquear / Omitir nueva ejecución</option>
                      <option value="allow">Permitir (ejecución paralela)</option>
                      <option value="queue">Encolar (esperar finalización)</option>
                      <option value="replace">Reemplazar (cancelar la anterior e iniciar la nueva)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#090d16] border border-[#182338] space-y-3">
                <div className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
                  <Shield size={14} className="text-[var(--cyber-primary)]" />
                  Gestión Avanzada de Reintentos ante Errores
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                      {t('tasks.modal.maxRetries')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                      Intervalo entre Reintentos (seg)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="3600"
                      value={retryIntervalSeconds}
                      onChange={(e) => setRetryIntervalSeconds(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                      Estrategia de Backoff
                    </label>
                    <select
                      value={retryBackoff}
                      onChange={(e) => setRetryBackoff(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white font-mono"
                    >
                      <option value="fixed">Fijo (mismo intervalo)</option>
                      <option value="progressive">Progresivo / Exponencial (doble de tiempo)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: VARIABLES */}
          {activeTab === 'variables' && (
            <div className="space-y-4">
              {/* Custom Variables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                      Variables Personalizadas de la Tarea
                    </h4>
                    <p className="text-[#64748b] text-[11px]">
                      Se interpolarán automáticamente en scripts y payloads como {'{{nombre_variable}}'}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addVariable}
                    className="px-2.5 py-1 text-xs rounded-md bg-[var(--cyber-primary)]/10 text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/30 hover:bg-[var(--cyber-primary)]/20 transition-colors flex items-center gap-1 font-semibold"
                  >
                    <Plus size={13} /> Añadir Variable
                  </button>
                </div>

                {variables.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#070a12] border border-[#182338] text-center text-[#64748b]">
                    No hay variables personalizadas definidas para esta tarea.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {variables.map((variable, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[#070a12] border border-[#1e2b45]">
                        <input
                          type="text"
                          value={variable.key}
                          onChange={(e) => updateVariable(idx, 'key', e.target.value)}
                          placeholder="nombre_variable"
                          className="w-1/3 px-2.5 py-1.5 rounded bg-[#0b101c] border border-[#202e48] text-white font-mono text-xs"
                        />
                        <input
                          type={variable.is_secret ? 'password' : 'text'}
                          value={variable.value}
                          onChange={(e) => updateVariable(idx, 'value', e.target.value)}
                          placeholder="valor de la variable"
                          className="flex-1 px-2.5 py-1.5 rounded bg-[#0b101c] border border-[#202e48] text-white font-mono text-xs"
                        />
                        <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0b101c] border border-[#202e48] text-[#8493a8] cursor-pointer text-[11px] whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={Boolean(variable.is_secret)}
                            onChange={(e) => updateVariable(idx, 'is_secret', e.target.checked)}
                            className="rounded bg-[#070a12] text-[var(--cyber-primary)] focus:ring-0"
                          />
                          <span>Secreto / Ocultar en logs</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeVariable(idx)}
                          className="p-1.5 rounded text-[#ff0055] hover:bg-[#ff0055]/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Built-in System Variables Help */}
              <div className="p-4 rounded-xl bg-[#090d16] border border-[#182338] space-y-2">
                <div className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-[var(--cyber-primary)]" />
                  Variables Automáticas del Sistema (Disponibles en cualquier ejecución)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    { token: '{{task_name}}', desc: 'Nombre de la tarea actual' },
                    { token: '{{hostname}}', desc: 'Hostname del destino' },
                    { token: '{{target_name}}', desc: 'Nombre descriptivo del destino' },
                    { token: '{{target_ip}}', desc: 'Dirección IP o host del destino' },
                    { token: '{{date}}', desc: 'Fecha actual (YYYY-MM-DD)' },
                    { token: '{{time}}', desc: 'Hora actual (HH:MM:SS)' },
                    { token: '{{datetime}}', desc: 'Fecha y hora ISO (YYYY-MM-DD_HH-mm-ss)' },
                    { token: '{{timestamp}}', desc: 'Timestamp en milisegundos' },
                  ].map((item) => (
                    <div
                      key={item.token}
                      onClick={() => copyVariableExample(item.token)}
                      className="p-2 rounded bg-[#070a12] border border-[#182338] hover:border-[var(--cyber-primary)]/50 cursor-pointer flex items-center justify-between group transition-colors"
                      title="Click para copiar al portapapeles"
                    >
                      <div>
                        <span className="text-[var(--cyber-primary)] font-bold">{item.token}</span>
                        <div className="text-[10px] text-[#64748b]">{item.desc}</div>
                      </div>
                      {copiedVar === item.token ? (
                        <Check size={13} className="text-[#00ff88]" />
                      ) : (
                        <Copy size={13} className="text-[#475569] group-hover:text-white" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: DEPENDENCIAS */}
          {activeTab === 'dependencies' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                    Dependencias entre Tareas (Pipeline de Ejecución)
                  </h4>
                  <p className="text-[#64748b] text-[11px]">
                    Esta tarea solo se ejecutará cuando las tareas predecesoras cumplan la condición indicada.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addDependency}
                  className="px-2.5 py-1 text-xs rounded-md bg-[var(--cyber-primary)]/10 text-[var(--cyber-primary)] border border-[var(--cyber-primary)]/30 hover:bg-[var(--cyber-primary)]/20 transition-colors flex items-center gap-1 font-semibold"
                >
                  <Plus size={13} /> Añadir Dependencia
                </button>
              </div>

              {dependencies.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#070a12] border border-[#182338] text-center text-[#64748b]">
                  Esta tarea no tiene predecesoras y puede ejecutarse de forma independiente según su programación.
                </div>
              ) : (
                <div className="space-y-2">
                  {dependencies.map((dep, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45]">
                      <span className="text-white font-mono text-xs">Esperar a:</span>
                      <select
                        value={dep.depends_on_task_id}
                        onChange={(e) => updateDependency(idx, 'depends_on_task_id', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded bg-[#0b101c] border border-[#202e48] text-white font-mono text-xs"
                      >
                        {allTasks
                          .filter((t) => t.id !== task?.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                      <span className="text-white font-mono text-xs">con resultado:</span>
                      <select
                        value={dep.condition}
                        onChange={(e) => updateDependency(idx, 'condition', e.target.value)}
                        className="w-40 px-3 py-1.5 rounded bg-[#0b101c] border border-[#202e48] text-white font-mono text-xs"
                      >
                        <option value="success">ÉXITO (Exit code 0)</option>
                        <option value="failed">FALLO (Exit code != 0)</option>
                        <option value="completed">CUALQUIERA (Completada)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeDependency(idx)}
                        className="p-1.5 rounded text-[#ff0055] hover:bg-[#ff0055]/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: NOTIFICACIONES */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 p-4 rounded-xl bg-[#090d16] border border-[#182338]">
              <div className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <Bell size={14} className="text-[var(--cyber-primary)]" />
                Canales de Notificación
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#070a12] border border-[#1e2b45] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyTelegram}
                    onChange={(e) => setNotifyTelegram(e.target.checked)}
                    className="rounded bg-[#070a12] border-[#1e2b45] text-[var(--cyber-primary)] w-4 h-4"
                  />
                  <div>
                    <span className="text-white font-semibold">Notificar por Telegram</span>
                    <span className="block text-[#64748b] text-[11px]">Envía alertas directas al canal/chat configurado</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#070a12] border border-[#1e2b45] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                    className="rounded bg-[#070a12] border-[#1e2b45] text-[var(--cyber-primary)] w-4 h-4"
                  />
                  <div>
                    <span className="text-white font-semibold">Notificar por Correo Electrónico</span>
                    <span className="block text-[#64748b] text-[11px]">Envía reportes SMTP formateados</span>
                  </div>
                </label>
              </div>

              <div className="pt-2 border-t border-[#182338]">
                <div className="font-semibold text-[#8493a8] uppercase text-[11px] mb-2">Eventos a Notificar:</div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnSuccess}
                      onChange={(e) => setNotifyOnSuccess(e.target.checked)}
                      className="rounded bg-[#070a12] text-[var(--cyber-primary)]"
                    />
                    <span className="text-white">Al finalizar con Éxito</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnFail}
                      onChange={(e) => setNotifyOnFail(e.target.checked)}
                      className="rounded bg-[#070a12] text-[var(--cyber-primary)]"
                    />
                    <span className="text-white">Al finalizar con Error / Fallo</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </>
      )}

          {/* Footer with Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#182338]">
            {modalMode === 'basic' ? (
              <span className="text-[11px] text-[#64748b] flex items-center gap-1.5">
                <Sparkles size={13} className="text-[var(--cyber-primary)]" />
                Modo Básico Guiado · Simple por defecto
              </span>
            ) : (
              <span className="text-[11px] text-[#64748b]">
                Pestaña activa: <strong className="text-white capitalize">{activeTab}</strong>
              </span>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#111928] text-[#8493a8] hover:text-white hover:bg-[#182338] transition-colors"
              >
                {t('tasks.modal.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-lg text-xs font-semibold bg-[var(--cyber-primary)] text-black hover:opacity-90 transition-opacity font-mono disabled:opacity-50"
              >
                {isSubmitting ? t('tasks.modal.saving') : t('tasks.modal.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
