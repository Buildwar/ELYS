import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { Template } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Layers,
  Plus,
  Search,
  Code,
  Edit2,
  Trash2,
  ArrowRight,
  RefreshCw,
  X,
  Check,
} from 'lucide-react';
import { ConfirmModal } from '../components/modals/ConfirmModal.js';

interface TemplatesViewProps {
  onUseTemplate: (template: Template) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ onUseTemplate }) => {
  const { t } = useTranslation();
  const { isOperator } = useAuth();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemType, setSystemType] = useState('windows_server');
  const [commandType, setCommandType] = useState('powershell');
  const [commandTemplate, setCommandTemplate] = useState('');
  const [defaultTimeout, setDefaultTimeout] = useState(300);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.getTemplates({ search: searchTerm || undefined });
      setTemplates(res);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [searchTerm]);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setSystemType('windows_server');
    setCommandType('powershell');
    setCommandTemplate('');
    setDefaultTimeout(300);
    setIsModalOpen(true);
  };

  const openEditModal = (tmpl: Template) => {
    setEditingTemplate(tmpl);
    setName(tmpl.name);
    setDescription(tmpl.description || '');
    setSystemType(tmpl.system_type);
    setCommandType(tmpl.command_type);
    setCommandTemplate(tmpl.command_template);
    setDefaultTimeout(tmpl.default_timeout);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, {
          name,
          description,
          system_type: systemType,
          command_type: commandType,
          command_template: commandTemplate,
          default_timeout: defaultTimeout,
        });
      } else {
        await api.createTemplate({
          name,
          description,
          system_type: systemType,
          command_type: commandType,
          command_template: commandTemplate,
          default_timeout: defaultTimeout,
        });
      }
      setIsModalOpen(false);
      loadTemplates();
    } catch (err: any) {
      alert(err.message || 'Error al guardar plantilla');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;
    try {
      await api.deleteTemplate(deletingTemplate.id);
      loadTemplates();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar plantilla');
    } finally {
      setDeletingTemplate(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090e18] border border-[#1a263c] shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar plantilla por nombre o comando..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#060910] border border-[#1c2a44] text-white text-xs font-mono focus:outline-none focus:border-[var(--cyber-primary)] transition-all"
          />
          <Search size={15} className="absolute left-3 top-3 text-[#64748b]" />
        </div>

        {isOperator && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-[var(--cyber-primary)]/20 cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>{t('templates.create')}</span>
          </button>
        )}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-[#8493a8]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
          <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="p-16 rounded-2xl bg-[#0c1220] border border-[#1c2a44] text-center text-[#8493a8]">
          <Layers className="w-12 h-12 mx-auto text-[#243552] mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No hay plantillas creadas</h3>
          <p className="text-xs text-[#64748b] max-w-sm mx-auto mb-4 font-mono">
            Las plantillas permiten guardar comandos y patrones preconfigurados para reutilizarlos rápidamente al crear tareas.
          </p>
          {isOperator && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-[var(--cyber-primary)] hover:bg-[var(--cyber-primary-hover)] text-black font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md shadow-[var(--cyber-primary)]/20"
            >
              <Plus size={15} />
              <span>Crear primera plantilla</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-5 rounded-2xl bg-[#0c1220] border border-[#1a263c] hover:border-[var(--cyber-primary)]/50 transition-all flex flex-col justify-between group shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#10192a] border border-[#1e2d48] text-[var(--cyber-primary)] shrink-0">
                      <Layers size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-[var(--cyber-primary)] transition-colors truncate max-w-[180px]">
                        {tmpl.name}
                      </h3>
                      <span className="text-[10px] text-[#64748b] font-mono uppercase">
                        {tmpl.system_type.replace('_', ' ')} • {tmpl.command_type}
                      </span>
                    </div>
                  </div>

                  {isOperator && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(tmpl)}
                        className="p-1.5 rounded-lg text-[#8493a8] hover:text-white hover:bg-[#121c2e]"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingTemplate(tmpl);
                          setIsConfirmDeleteOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-[#8493a8] hover:text-[#ff0055] hover:bg-[#ff0055]/20"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {tmpl.description && (
                  <p className="text-xs text-[#8493a8] mb-3 line-clamp-2">
                    {tmpl.description}
                  </p>
                )}

                {/* Command Snippet */}
                <div className="p-3 rounded-xl bg-[#06080e] border border-[#182338] font-mono text-[11px] text-[var(--cyber-success)] truncate mb-4">
                  {tmpl.command_template}
                </div>
              </div>

              {/* Action Button: Use Template */}
              <button
                onClick={() => onUseTemplate(tmpl)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#111a28] hover:bg-[var(--cyber-primary)] text-[var(--cyber-primary)] hover:text-black border border-[#1e2d48] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <span>{t('templates.useTemplate')}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Template Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#0c1220] border border-[#202e48] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#182338] mb-4">
              <h3 className="text-base font-bold text-white tracking-wide">
                {editingTemplate ? t('templates.modal.editTitle') : t('templates.modal.createTitle')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-[#64748b] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                  {t('templates.modal.name')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('templates.modal.namePlaceholder')}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                  {t('templates.modal.description')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    {t('templates.modal.systemType')}
                  </label>
                  <select
                    value={systemType}
                    onChange={(e) => setSystemType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)]"
                  >
                    <option value="windows_server">Windows Server</option>
                    <option value="windows_desktop">Windows Desktop</option>
                    <option value="linux">Linux</option>
                    <option value="bsd">BSD</option>
                    <option value="other">Otros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                    {t('templates.modal.commandType')}
                  </label>
                  <select
                    value={commandType}
                    onChange={(e) => setCommandType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white focus:outline-none focus:border-[var(--cyber-primary)]"
                  >
                    <option value="powershell">PowerShell</option>
                    <option value="cmd">CMD</option>
                    <option value="bash">Bash</option>
                    <option value="script">Script</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#8493a8] uppercase mb-1">
                  {t('templates.modal.commandTemplate')} *
                </label>
                <textarea
                  value={commandTemplate}
                  onChange={(e) => setCommandTemplate(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#070a12] border border-[#1e2b45] text-[var(--cyber-success)] font-mono focus:outline-none focus:border-[var(--cyber-primary)] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#182338]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#8493a8] hover:text-white"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--cyber-primary)] text-black font-bold hover:bg-[var(--cyber-primary-hover)] cursor-pointer"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        title={t('templates.deleteConfirmTitle')}
        message={t('templates.deleteConfirmMessage', { name: deletingTemplate?.name || '' })}
        onConfirm={handleDeleteConfirm}
        onClose={() => setIsConfirmDeleteOpen(false)}
        isDestructive={true}
      />
    </div>
  );
};
