import React, { useState, useEffect } from 'react';
import { X, Folder, Database, Wrench, Shield, Globe, Terminal, Cpu, Cloud, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Category } from '../../types/index.js';

interface CategoryModalProps {
  isOpen: boolean;
  category: Category | null;
  onSave: (data: { name: string; description?: string; color: string; icon: string }) => Promise<void>;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#00f0ff', // Cyber Cyan
  '#00ff9d', // Emerald
  '#ffb703', // Amber
  '#ff007f', // Magenta
  '#a855f7', // Violet
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
];

const PRESET_ICONS = [
  { name: 'Folder', Icon: Folder },
  { name: 'Database', Icon: Database },
  { name: 'Wrench', Icon: Wrench },
  { name: 'Shield', Icon: Shield },
  { name: 'Globe', Icon: Globe },
  { name: 'Terminal', Icon: Terminal },
  { name: 'Cpu', Icon: Cpu },
  { name: 'Cloud', Icon: Cloud },
  { name: 'Bell', Icon: Bell },
];

export const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, category, onSave, onClose }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#00f0ff');
  const [icon, setIcon] = useState('Folder');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setDescription(category.description || '');
      setColor(category.color || '#00f0ff');
      setIcon(category.icon || 'Folder');
    } else {
      setName('');
      setDescription('');
      setColor('#00f0ff');
      setIcon('Folder');
    }
    setError(null);
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('categories.modal.nameRequired') || 'El nombre es obligatorio');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar categoría');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-xl bg-[#0e1422] border border-[#202d47] shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[#1e2b45] mb-4">
          <h3 className="text-base font-bold text-white tracking-wide">
            {category ? t('categories.modal.editTitle') : t('categories.modal.createTitle')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#182338] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#ff0055]/10 border border-[#ff0055]/30 text-xs text-[#ff5588]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
              {t('categories.name')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('categories.modal.namePlaceholder')}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-1.5">
              {t('categories.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('categories.modal.descPlaceholder')}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070a12] border border-[#1e2b45] text-white text-sm focus:outline-none focus:border-[var(--cyber-primary)] transition-colors resize-none"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
              {t('categories.color')}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    color === c ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-xs font-semibold text-[#8493a8] uppercase tracking-wider mb-2">
              {t('categories.icon')}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_ICONS.map(({ name: iconName, Icon }) => (
                <button
                  type="button"
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  className={`p-2.5 rounded-lg border flex items-center justify-center transition-all ${
                    icon === iconName
                      ? 'bg-[var(--cyber-card)] border-[var(--cyber-primary)] text-[var(--cyber-primary)]'
                      : 'bg-[#070a12] border-[#1e2b45] text-[#8493a8] hover:text-white hover:border-[#2a3d60]'
                  }`}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2b45] mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8493a8] hover:text-white hover:bg-[#1a2538] transition-colors"
            >
              {t('categories.modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-[var(--cyber-primary)] text-black hover:bg-[var(--cyber-primary-hover)] transition-all shadow-md shadow-[var(--cyber-primary)]/20"
            >
              {isSubmitting ? t('common.loading') : t('categories.modal.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
