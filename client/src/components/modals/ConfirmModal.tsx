import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  isDestructive = true,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-xl bg-[#0f1523] border border-[#22314e] shadow-2xl p-6 overflow-hidden">
        {/* Glow accent */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isDestructive ? 'bg-[#ff0055]' : 'bg-[var(--cyber-primary)]'
          }`}
        />

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg border ${
                isDestructive
                  ? 'bg-[#ff0055]/10 border-[#ff0055]/30 text-[#ff0055]'
                  : 'bg-[var(--cyber-primary)]/10 border-[var(--cyber-primary)]/30 text-[var(--cyber-primary)]'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#64748b] hover:text-white hover:bg-[#1a2438] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[#94a3b8] mb-6 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8493a8] hover:text-white hover:bg-[#1a2538] border border-[#22314e] transition-colors"
          >
            {cancelText || t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 ${
              isDestructive
                ? 'bg-[#ff0055] text-white hover:bg-[#ff1a6b] shadow-lg shadow-[#ff0055]/20'
                : 'bg-[var(--cyber-primary)] text-black hover:bg-[var(--cyber-primary-hover)] font-bold'
            }`}
          >
            {confirmText || (isDestructive ? t('common.delete') : t('common.confirm'))}
          </button>
        </div>
      </div>
    </div>
  );
};
