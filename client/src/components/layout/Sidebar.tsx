import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import {
  LayoutDashboard,
  ListTodo,
  CalendarClock,
  Server,
  Layers,
  KeyRound,
  Terminal,
  FolderKanban,
  Users,
  Settings,
  Info,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
  Zap,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { t } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const { language, setLanguage } = useTheme();

  // Floating tooltip state for collapsed mode
  const [tooltip, setTooltip] = useState<{ text: string; top: number } | null>(null);

  const showTooltip = (e: React.MouseEvent<HTMLElement>, text: string) => {
    if (collapsed && !mobileOpen) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ text, top: rect.top + rect.height / 2 });
    }
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  interface NavGroup {
    header?: string;
    items: {
      id: string;
      label: string;
      icon: React.FC<any>;
    }[];
  }

  const navGroups: NavGroup[] = [
    {
      items: [
        { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
      ],
    },
    {
      header: t('nav.groupTasks'),
      items: [
        { id: 'tasks', label: t('nav.tasks'), icon: ListTodo },
        { id: 'calendar', label: t('nav.calendar'), icon: CalendarClock },
      ],
    },
    {
      header: t('nav.groupInfrastructure'),
      items: [
        { id: 'destinations', label: t('nav.destinations'), icon: Server },
        { id: 'credentials', label: t('nav.credentials'), icon: KeyRound },
        { id: 'categories', label: t('nav.categories'), icon: FolderKanban },
      ],
    },
    {
      header: t('nav.groupAutomation'),
      items: [
        { id: 'templates', label: t('nav.templates'), icon: Layers },
      ],
    },
    {
      header: t('nav.groupOperations'),
      items: [
        { id: 'executions', label: t('nav.executions'), icon: Terminal },
      ],
    },
    {
      header: t('nav.groupSystem'),
      items: [
        ...(isAdmin ? [{ id: 'users', label: t('nav.users'), icon: Users }] : []),
        { id: 'settings', label: t('nav.settings'), icon: Settings },
      ],
    },
    {
      items: [
        { id: 'about', label: t('nav.about'), icon: Info },
      ],
    },
  ];

  const handleSelect = (id: string) => {
    onSelectTab(id);
    onCloseMobile();
    hideTooltip();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen z-50 flex flex-col transition-all duration-300 ease-in-out border-r border-[#1a253a] bg-[#070a12] select-none ${
          mobileOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-[80px]' : 'md:w-[280px]'}`}
      >
        {/* Brand Header */}
        {collapsed && !mobileOpen ? (
          /* COLLAPSED HEADER: Centered Logo + Centered Toggle */
          <div className="h-20 flex flex-col items-center justify-center border-b border-[#182338] px-2 py-2 gap-1.5 shrink-0 bg-[#06080e]">
            <div
              onClick={() => handleSelect('dashboard')}
              onMouseEnter={(e) => showTooltip(e, 'ELYS — Control Center')}
              onMouseLeave={hideTooltip}
              className="w-10 h-10 rounded-xl bg-[#0e1626] border border-[#1e2d48] hover:border-[var(--cyber-primary)] flex items-center justify-center transition-all duration-200 cursor-pointer shadow-md group"
            >
              <Zap className="w-5 h-5 text-[var(--cyber-primary)] transition-transform duration-300 group-hover:scale-110" />
            </div>

            <button
              onClick={onToggleCollapse}
              onMouseEnter={(e) => showTooltip(e, t('nav.expand'))}
              onMouseLeave={hideTooltip}
              className="w-8 h-4.5 rounded-md bg-[#0b101c] border border-[#1e2b45] hover:border-[var(--cyber-primary)] hover:bg-[#121c2e] text-[#64748b] hover:text-[var(--cyber-primary)] flex items-center justify-center transition-all cursor-pointer"
              aria-label={t('nav.expand')}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        ) : (
          /* EXPANDED HEADER: Logo + Brand + Title + Collapse Toggle */
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#182338] shrink-0 bg-[#06080e]">
            <div
              onClick={() => handleSelect('dashboard')}
              className="flex items-center gap-3 cursor-pointer group min-w-0"
            >
              <div className="w-9 h-9 rounded-lg bg-[#0e1626] border border-[#1e2d48] group-hover:border-[var(--cyber-primary)] flex items-center justify-center relative transition-all duration-200 shrink-0 shadow-sm">
                <Zap className="w-5 h-5 text-[var(--cyber-primary)] transition-transform duration-300 group-hover:scale-110" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-base font-black tracking-wider text-white flex items-center gap-1.5 leading-none">
                  ELYS
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--cyber-primary)] animate-pulse" />
                </span>
                <span className="text-[9px] tracking-widest text-[#64748b] uppercase font-mono mt-0.5 truncate">
                  Control Center
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Desktop collapse toggle */}
              <button
                onClick={onToggleCollapse}
                className="hidden md:flex p-1.5 rounded-md text-[#64748b] hover:text-white hover:bg-[#121c2e] border border-transparent hover:border-[#1e2b45] transition-colors cursor-pointer"
                title={t('nav.collapse')}
              >
                <ChevronLeft size={16} />
              </button>

              {/* Mobile close button */}
              <button
                onClick={onCloseMobile}
                className="flex md:hidden p-1.5 rounded-md text-[#64748b] hover:text-white hover:bg-[#121c2e] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Navigation Links Area - Independently scrollable */}
        <nav className="flex-1 min-h-0 py-3 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {/* Group Header in Expanded Mode */}
              {!collapsed || mobileOpen ? (
                group.header && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-mono tracking-widest text-[#475569] font-bold uppercase select-none">
                    {group.header}
                  </div>
                )
              ) : (
                /* Subtle Divider in Collapsed Mode */
                group.header && <div className="border-t border-[#141e30] my-2 mx-2" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                if (collapsed && !mobileOpen) {
                  /* COLLAPSED NAV ITEM: Strictly Centered Icon Button */
                  return (
                    <div key={item.id} className="w-full flex justify-center py-0.5">
                      <button
                        onClick={() => handleSelect(item.id)}
                        onMouseEnter={(e) => showTooltip(e, item.label)}
                        onMouseLeave={hideTooltip}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-150 relative cursor-pointer ${
                          isActive
                            ? 'bg-[#10192a] text-[var(--cyber-primary)] border border-[var(--cyber-primary)] shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                            : 'text-[#8493a8] hover:text-white hover:bg-[#0c121e] border border-transparent hover:border-[#1e2b45]'
                        }`}
                        aria-label={item.label}
                      >
                        <Icon
                          size={20}
                          className={isActive ? 'text-[var(--cyber-primary)]' : 'transition-colors'}
                        />
                        {isActive && (
                          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r bg-[var(--cyber-primary)]" />
                        )}
                      </button>
                    </div>
                  );
                }

                /* EXPANDED NAV ITEM: Icon + Label + Active Indicator */
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group relative cursor-pointer ${
                      isActive
                        ? 'bg-[#10192a] text-white border-l-4 border-[var(--cyber-primary)] shadow-sm'
                        : 'text-[#8493a8] hover:text-white hover:bg-[#0c121e] border-l-4 border-transparent'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={`transition-colors shrink-0 ${
                        isActive ? 'text-[var(--cyber-primary)]' : 'text-[#64748b] group-hover:text-white'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--cyber-primary)] shadow-[0_0_6px_var(--cyber-primary)]" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom User & Language Area */}
        {collapsed && !mobileOpen ? (
          /* COLLAPSED FOOTER: Uniform Centered Stack */
          <div className="p-2.5 border-t border-[#182338] bg-[#05070c] flex flex-col items-center gap-2 shrink-0">
            {/* Language Toggle Button */}
            <button
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              onMouseEnter={(e) =>
                showTooltip(
                  e,
                  language === 'es' ? 'Idioma: Español (Clic para inglés)' : 'Language: English (Click for Spanish)'
                )
              }
              onMouseLeave={hideTooltip}
              className="w-10 h-10 rounded-xl bg-[#0c121e] border border-[#1e2b45] hover:border-[var(--cyber-primary)] text-[var(--cyber-primary)] font-mono text-xs font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow-[0_0_8px_rgba(0,240,255,0.2)]"
              aria-label="Cambiar idioma"
            >
              {language.toUpperCase()}
            </button>

            {/* User Avatar */}
            <div
              onMouseEnter={(e) =>
                showTooltip(
                  e,
                  `@${user?.username || 'usuario'} • ${t(`roles.${user?.role || 'user'}`)}`
                )
              }
              onMouseLeave={hideTooltip}
              className="w-10 h-10 rounded-xl bg-[#0e1626] border border-[#1e2d48] text-[var(--cyber-primary)] font-mono text-xs font-bold flex items-center justify-center cursor-default shadow-sm"
            >
              {user?.username?.charAt(0).toUpperCase()}
            </div>

            {/* Logout Action */}
            <button
              onClick={logout}
              onMouseEnter={(e) => showTooltip(e, t('nav.logout'))}
              onMouseLeave={hideTooltip}
              className="w-10 h-10 rounded-xl bg-[#0c121e] border border-[#1e2b45] hover:border-[#ff0055] hover:bg-[#ff0055]/10 text-[#8493a8] hover:text-[#ff0055] flex items-center justify-center transition-all cursor-pointer"
              aria-label={t('nav.logout')}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          /* EXPANDED FOOTER: Language Bar + Full User Card */
          <div className="p-3 border-t border-[#182338] space-y-2.5 bg-[#05070c] shrink-0">
            {/* Language Selector */}
            <div className="flex items-center justify-between px-2 py-1 text-xs text-[#64748b]">
              <div className="flex items-center gap-1.5">
                <Globe size={13} />
                <span className="text-[11px] font-mono">Idioma</span>
              </div>
              <div className="flex items-center gap-1 bg-[#0c121e] p-0.5 rounded-lg border border-[#1e2b45]">
                <button
                  onClick={() => setLanguage('es')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    language === 'es'
                      ? 'bg-[var(--cyber-primary)] text-black font-bold shadow-xs'
                      : 'text-[#8493a8] hover:text-white'
                  }`}
                >
                  ES
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    language === 'en'
                      ? 'bg-[var(--cyber-primary)] text-black font-bold shadow-xs'
                      : 'text-[#8493a8] hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            {/* User Profile Card */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0b101c] border border-[#182338]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#141e30] border border-[var(--cyber-primary)]/40 flex items-center justify-center font-mono text-xs font-bold text-[var(--cyber-primary)] shrink-0 shadow-inner">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate leading-tight font-mono">
                    @{user?.username}
                  </span>
                  <span className="text-[9px] text-[var(--cyber-primary)] uppercase tracking-wider font-mono mt-0.5 truncate">
                    {t(`roles.${user?.role || 'user'}`)}
                  </span>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-[#64748b] hover:text-[#ff0055] hover:bg-[#ff0055]/10 border border-transparent hover:border-[#ff0055]/30 transition-all shrink-0 cursor-pointer"
                title={t('nav.logout')}
                aria-label={t('nav.logout')}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Floating Tooltip for Collapsed Sidebar (Section 94) */}
        {collapsed && !mobileOpen && tooltip && (
          <div
            style={{ top: `${tooltip.top}px` }}
            className="fixed left-[88px] -translate-y-1/2 z-50 pointer-events-none px-3 py-1.5 rounded-lg bg-[#0d1524] border border-[var(--cyber-primary)]/60 shadow-[0_4px_20px_rgba(0,0,0,0.85)] font-mono text-xs font-semibold text-white whitespace-nowrap flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--cyber-primary)] shadow-[0_0_6px_var(--cyber-primary)]" />
            <span>{tooltip.text}</span>
            {/* Tooltip triangle arrow pointing left */}
            <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-6 border-r-[var(--cyber-primary)]/60" />
          </div>
        )}
      </aside>
    </>
  );
};
