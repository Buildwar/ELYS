import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { Destination, Credential, SystemType } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Server,
  Monitor,
  Terminal,
  Cpu,
  HardDrive,
  Plus,
  Search,
  RefreshCw,
  Power,
  Edit2,
  Trash2,
  Radio,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Layers,
  ChevronDown,
  ChevronRight,
  Wifi,
  KeyRound,
  ListTodo,
} from 'lucide-react';
import { DestinationModal } from '../components/modals/DestinationModal.js';
import { ConfirmModal } from '../components/modals/ConfirmModal.js';

interface DestinationsViewProps {
  initialSystemFilter?: string;
}

const SYSTEM_CATEGORIES: { id: SystemType; label: string; icon: React.FC<any>; color: string; border: string; bg: string }[] = [
  { id: 'windows_server', label: 'Windows Server', icon: Server, color: '#00f0ff', border: 'border-[#00f0ff]/30', bg: 'bg-[#00f0ff]/10' },
  { id: 'windows_desktop', label: 'Windows Desktop', icon: Monitor, color: '#38bdf8', border: 'border-[#38bdf8]/30', bg: 'bg-[#38bdf8]/10' },
  { id: 'linux', label: 'Linux', icon: Terminal, color: '#ff9900', border: 'border-[#ff9900]/30', bg: 'bg-[#ff9900]/10' },
  { id: 'bsd', label: 'BSD', icon: Cpu, color: '#a855f7', border: 'border-[#a855f7]/30', bg: 'bg-[#a855f7]/10' },
  { id: 'other', label: 'Otros', icon: HardDrive, color: '#94a3b8', border: 'border-[#94a3b8]/30', bg: 'bg-[#94a3b8]/10' },
];

export const DestinationsView: React.FC<DestinationsViewProps> = ({ initialSystemFilter = '' }) => {
  const { t } = useTranslation();
  const { isOperator } = useAuth();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [systemFilter, setSystemFilter] = useState<string>(initialSystemFilter);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSystemFilter(initialSystemFilter || '');
  }, [initialSystemFilter]);

  // Expand / collapse state per category
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [deletingDestination, setDeletingDestination] = useState<Destination | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    destination: string;
    hostname: string;
    method: string;
    port?: number;
    duration_ms?: number;
    message: string;
    details?: string;
  } | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [destRes, credsRes] = await Promise.all([
        api.getDestinations({
          system_type: systemFilter || undefined,
          search: searchTerm || undefined,
        }),
        api.getCredentials(),
      ]);
      setDestinations(destRes);
      setCredentials(credsRes);
    } catch (err) {
      console.error('Failed to load destinations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [systemFilter, searchTerm]);

  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleSave = async (data: any) => {
    if (editingDestination) {
      await api.updateDestination(editingDestination.id, data);
    } else {
      await api.createDestination(data);
    }
    loadData();
  };

  const handleToggleActive = async (dest: Destination) => {
    try {
      await api.updateDestination(dest.id, { is_active: dest.is_active === 1 ? 0 : 1 });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  const handleTestConnection = async (dest: Destination) => {
    try {
      setTestingId(dest.id);
      setTestResult(null);
      setShowTechnicalDetails(false);
      const res = await api.testDestination(dest.id);
      setTestResult({
        id: dest.id,
        success: Boolean(res.success),
        destination: res.destination || dest.name,
        hostname: res.hostname || dest.hostname,
        method: res.method || dest.connection_method.toUpperCase(),
        port: res.port || dest.port || undefined,
        duration_ms: res.duration_ms,
        message: res.message || 'Conexión verificada correctamente',
        details: res.details,
      });
    } catch (err: any) {
      setTestResult({
        id: dest.id,
        success: false,
        destination: dest.name,
        hostname: dest.hostname,
        method: dest.connection_method.toUpperCase(),
        port: dest.port || undefined,
        duration_ms: undefined,
        message: err.message || 'No se pudo conectar con el destino',
        details: err.details || err.message || 'Comprueba que el equipo está encendido, el puerto está abierto en el firewall y las credenciales son correctas.',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDestination) return;
    try {
      await api.deleteDestination(deletingDestination.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar destino');
    } finally {
      setDeletingDestination(null);
    }
  };

  // Group destinations by Category -> Distribution
  const groupedDestinations = SYSTEM_CATEGORIES.map((cat) => {
    const items = destinations.filter((d) => d.system_type === cat.id);

    // Subgroup by distribution / version
    const distributionMap: Record<string, Destination[]> = {};
    for (const item of items) {
      const distKey = item.os_name + (item.os_version ? ` ${item.os_version}` : '');
      if (!distributionMap[distKey]) {
        distributionMap[distKey] = [];
      }
      distributionMap[distKey].push(item);
    }

    return {
      category: cat,
      totalCount: items.length,
      distributions: Object.entries(distributionMap).map(([distName, hosts]) => ({
        distName,
        hosts,
      })),
    };
  }).filter((group) => {
    if (systemFilter) {
      return group.category.id === systemFilter;
    }
    return group.totalCount > 0 || !searchTerm;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar destino por nombre, IP, hostname, distribución o etiquetas..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-xs focus:outline-none focus:border-[var(--cyber-primary)] transition-colors font-mono"
          />
          <Search size={15} className="absolute left-3.5 top-3 text-[#64748b]" />
        </div>

        {/* Action Button */}
        {isOperator && (
          <button
            onClick={() => {
              setEditingDestination(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-lg bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[var(--cyber-primary)]/20 shrink-0 cursor-pointer"
          >
            <Plus size={16} />
            <span>{t('destinations.create') || 'Nuevo Destino'}</span>
          </button>
        )}
      </div>

      {/* Quick System Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSystemFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
            systemFilter === ''
              ? 'bg-[var(--cyber-primary)] text-black shadow-sm'
              : 'bg-[#0e1422] border border-[#1e2b45] text-[#8493a8] hover:text-white'
          }`}
        >
          TODOS ({destinations.length})
        </button>

        {SYSTEM_CATEGORIES.map((cat) => {
          const count = destinations.filter((d) => d.system_type === cat.id).length;
          const Icon = cat.icon;
          const isSelected = systemFilter === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setSystemFilter(isSelected ? '' : cat.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer border ${
                isSelected
                  ? `${cat.bg} text-white font-bold border-[var(--cyber-primary)] shadow-sm`
                  : 'bg-[#0e1422] border-[#1e2b45] text-[#8493a8] hover:text-white'
              }`}
            >
              <Icon size={14} style={{ color: cat.color }} />
              <span>{cat.label}</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#070a12] text-white">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Connection Test Notification Banner */}
      {testResult && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs font-mono ${
            testResult.success
              ? 'bg-[#00ff88]/10 border-[#00ff88]/30 text-[#00ff88]'
              : 'bg-[#ff0055]/10 border-[#ff0055]/30 text-[#ff0055]'
          }`}
        >
          {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Hierarchical Structure: Category -> Distribution -> Host */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-[#8493a8]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
          <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
        </div>
      ) : destinations.length === 0 ? (
        <div className="p-16 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] text-center text-[#8493a8]">
          <Server className="w-12 h-12 mx-auto text-[#243552] mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No hay destinos registrados</h3>
          <p className="text-xs text-[#64748b] max-w-sm mx-auto mb-4">
            Registra tu primer equipo o servidor (Windows Server, Windows Desktop, Linux, BSD) para poder ejecutar tareas remotas.
          </p>
          {isOperator && (
            <button
              onClick={() => {
                setEditingDestination(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md shadow-[var(--cyber-primary)]/20"
            >
              <Plus size={15} />
              <span>Añadir primer destino</span>
            </button>
          )}
        </div>
      ) : groupedDestinations.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] text-center text-[#8493a8] text-xs font-mono">
          No se encontraron destinos que coincidan con el filtro o búsqueda.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedDestinations.map(({ category: cat, totalCount, distributions }) => {
            const Icon = cat.icon;
            const isCollapsed = !!collapsedCategories[cat.id];

            return (
              <div
                key={cat.id}
                className="rounded-2xl bg-[#0c1220] border border-[#1e2d4a] shadow-xl overflow-hidden transition-all"
              >
                {/* Category Header Card */}
                <div
                  onClick={() => toggleCategoryCollapse(cat.id)}
                  className="p-4 sm:p-5 bg-[#0e1628] border-b border-[#1b273e] flex items-center justify-between cursor-pointer hover:bg-[#121c32] transition-colors select-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{ backgroundColor: `${cat.color}15`, borderColor: `${cat.color}40`, color: cat.color }}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-bold text-white tracking-wide font-mono">
                          {cat.label}
                        </h2>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-mono font-bold"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                        >
                          {totalCount} {totalCount === 1 ? 'equipo' : 'equipos'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748b] font-mono mt-0.5">
                        Clasificación de destinos para ejecución remota y automatización
                      </p>
                    </div>
                  </div>

                  <button className="p-2 text-[#8493a8] hover:text-white transition-colors">
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {/* Distributions & Machines inside category */}
                {!isCollapsed && (
                  <div className="p-5 sm:p-6 space-y-6">
                    {totalCount === 0 ? (
                      <div className="text-center py-6 text-xs text-[#64748b] font-mono">
                        No hay equipos registrados en la categoría {cat.label}.
                      </div>
                    ) : (
                      distributions.map(({ distName, hosts }) => (
                        <div key={distName} className="space-y-3">
                          {/* Distribution Subheader */}
                          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#94a3b8] uppercase tracking-wider pl-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyber-primary)]" />
                            <span>{distName}</span>
                            <span className="text-[10px] text-[#64748b]">({hosts.length})</span>
                          </div>

                          {/* Hosts Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                            {hosts.map((dest) => (
                              <div
                                key={dest.id}
                                className={`p-4 rounded-xl border bg-[#070a12] transition-all flex flex-col justify-between group hover:border-[var(--cyber-primary)]/60 ${
                                  dest.is_active === 1 ? 'border-[#1b2842]' : 'border-[#162033] opacity-60'
                                }`}
                              >
                                <div>
                                  {/* Host Top Row: Status Dot, Name & IP */}
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div
                                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                          dest.is_active === 1 ? 'bg-[#00ff88] shadow-sm shadow-[#00ff88]/50' : 'bg-[#64748b]'
                                        }`}
                                        title={dest.is_active === 1 ? 'Activo' : 'Desactivado'}
                                      />
                                      <span className="font-mono text-sm font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors truncate">
                                        {dest.name}
                                      </span>
                                    </div>

                                    {dest.ip_address && (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#111928] text-[var(--cyber-primary)] border border-[#1e2e4a] shrink-0">
                                        {dest.ip_address}
                                      </span>
                                    )}
                                  </div>

                                  {/* Hostname / FQDN */}
                                  <div className="text-[11px] text-[#8493a8] font-mono truncate mb-3 pl-4.5">
                                    {dest.hostname}
                                  </div>

                                  {/* Specs Badges */}
                                  <div className="flex flex-wrap items-center gap-1.5 mb-3 pl-4.5">
                                    {/* Connection Method */}
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#141d2e] text-[#cbd5e1] border border-[#202e48]">
                                      <Wifi size={10} className="text-[var(--cyber-primary)]" />
                                      <span>{dest.connection_method.toUpperCase()}</span>
                                      {dest.port && <span className="text-[#64748b]">:{dest.port}</span>}
                                    </span>

                                    {/* Associated Credential */}
                                    {dest.credential_name && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#1a1829] text-[#c084fc] border border-[#2e2648] truncate max-w-[140px]" title={dest.credential_name}>
                                        <KeyRound size={10} />
                                        <span className="truncate">{dest.credential_name}</span>
                                      </span>
                                    )}

                                    {/* Associated Tasks Count */}
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#13221b] text-[#4ade80] border border-[#1b3d2b]">
                                      <ListTodo size={10} />
                                      <span>{dest.task_count || 0} tareas</span>
                                    </span>
                                  </div>

                                  {dest.description && (
                                    <p className="text-[11px] text-[#64748b] line-clamp-2 mb-3 pl-4.5">
                                      {dest.description}
                                    </p>
                                  )}
                                </div>

                                {/* Actions Bar */}
                                <div className="pt-3 border-t border-[#162033] flex items-center justify-between gap-1 pl-4.5 mt-2">
                                  <span className="text-[10px] text-[#64748b] font-mono">
                                    {dest.last_used_at
                                      ? `Último uso: ${new Date(dest.last_used_at).toLocaleDateString()}`
                                      : 'Sin ejecuciones'}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    {/* Test Connection */}
                                    <button
                                      onClick={() => handleTestConnection(dest)}
                                      disabled={testingId === dest.id}
                                      className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[var(--cyber-primary)] text-[var(--cyber-primary)] hover:text-black transition-colors cursor-pointer"
                                      title="Comprobar conectividad con este equipo"
                                    >
                                      <Radio size={13} className={testingId === dest.id ? 'animate-spin' : ''} />
                                    </button>

                                    {/* Toggle Active */}
                                    {isOperator && (
                                      <button
                                        onClick={() => handleToggleActive(dest)}
                                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                          dest.is_active === 1
                                            ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30 hover:bg-[#00ff88]/20'
                                            : 'bg-[#182338] text-[#8493a8] border-[#202d47] hover:text-white'
                                        }`}
                                        title={dest.is_active === 1 ? 'Desactivar destino' : 'Activar destino'}
                                      >
                                        <Power size={13} />
                                      </button>
                                    )}

                                    {/* Edit */}
                                    {isOperator && (
                                      <button
                                        onClick={() => {
                                          setEditingDestination(dest);
                                          setIsModalOpen(true);
                                        }}
                                        className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#1f2b42] text-[#8493a8] hover:text-white transition-colors cursor-pointer"
                                        title="Editar especificaciones de equipo"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                    )}

                                    {/* Delete */}
                                    {isOperator && (
                                      <button
                                        onClick={() => {
                                          setDeletingDestination(dest);
                                          setIsConfirmDeleteOpen(true);
                                        }}
                                        className="p-1.5 rounded-lg bg-[#141d2e] hover:bg-[#ff0055]/20 text-[#8493a8] hover:text-[#ff0055] transition-colors cursor-pointer"
                                        title="Eliminar destino"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Destination Modal */}
      <DestinationModal
        isOpen={isModalOpen}
        destination={editingDestination}
        credentials={credentials}
        onSave={handleSave}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        title="¿Eliminar Destino?"
        message={`¿Deseas eliminar permanentemente el equipo "${deletingDestination?.name}" (${deletingDestination?.hostname})?`}
        onConfirm={handleDeleteConfirm}
        onClose={() => setIsConfirmDeleteOpen(false)}
        isDestructive={true}
      />
      {/* Connection Test Result Modal (Section 8 UX) */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0c1220] border border-[#202e48] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
              <div className="flex items-center gap-2.5">
                {testResult.success ? (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={18} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <XCircle size={18} />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {testResult.success ? 'Conectado correctamente' : 'No se pudo conectar con el destino'}
                  </h3>
                  <p className="text-[11px] text-[#8493a8] font-mono">
                    {testResult.destination} ({testResult.hostname})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTestResult(null)}
                className="text-[#64748b] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {testResult.success ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-[#08121d] border border-[#14283f] space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8493a8]">Destino:</span>
                    <strong className="text-white">{testResult.destination}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8493a8]">Método:</span>
                    <strong className="text-[var(--cyber-primary)]">{testResult.method}</strong>
                  </div>
                  {testResult.port && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#8493a8]">Puerto verificado:</span>
                      <strong className="text-white">{testResult.port}</strong>
                    </div>
                  )}
                  {testResult.duration_ms !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#8493a8]">Latencia / Tiempo:</span>
                      <strong className="text-emerald-400">{testResult.duration_ms} ms</strong>
                    </div>
                  )}
                </div>
                <p className="text-xs text-[#8493a8]">{testResult.message}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-[#1f0b12] border border-[#3f1624] text-xs text-[#ff99aa] space-y-1.5">
                  <p className="font-semibold text-rose-300">
                    Comprueba que el equipo está encendido, el puerto {testResult.port ? `${testResult.port} ` : ''}está abierto en el firewall y las credenciales son correctas.
                  </p>
                  <p className="text-[11px] text-[#ff7799]">
                    {testResult.message}
                  </p>
                </div>

                {testResult.details && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                      className="text-xs text-[var(--cyber-primary)] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <span>{showTechnicalDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos'}</span>
                      <ChevronDown size={14} className={`transform transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                    </button>
                    {showTechnicalDetails && (
                      <div className="mt-2 p-3 rounded-lg bg-[#070a12] border border-[#1e2b45] font-mono text-[11px] text-[#cbd5e1] whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {testResult.details}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[#182338]">
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="px-4 py-2 rounded-lg bg-[#141d2e] hover:bg-[#1e2b45] text-white text-xs font-semibold cursor-pointer"
              >
                {testResult.success ? 'Aceptar' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
