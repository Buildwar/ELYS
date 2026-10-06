import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Activity, Menu, Search, X, Server, ListTodo, Terminal, FolderKanban } from 'lucide-react';
import { api } from '../../services/api.js';

interface HeaderProps {
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onOpenMobile: () => void;
  onNavigate: (tab: string, filter?: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  collapsed,
  onOpenMobile,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [time, setTime] = useState<string>('');

  // Global search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    tasks: any[];
    destinations: any[];
    categories: any[];
    executions: any[];
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle global search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await api.searchGlobal(searchQuery.trim());
        setSearchResults(res);
        setShowResults(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasAnyResults =
    searchResults &&
    (searchResults.destinations.length > 0 ||
      searchResults.tasks.length > 0 ||
      searchResults.categories.length > 0 ||
      searchResults.executions.length > 0);

  return (
    <header
      className={`fixed top-0 right-0 h-16 z-30 flex items-center justify-between px-4 sm:px-6 border-b border-[#182338] bg-[#07090e]/90 backdrop-blur-md transition-all duration-300 ${
        collapsed ? 'md:left-[80px]' : 'md:left-[280px]'
      } left-0`}
    >
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobile}
          className="p-1.5 rounded-lg text-[#8493a8] hover:text-white hover:bg-[#121c2e] md:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="flex flex-col">
          <h1 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden sm:block text-[11px] text-[#8493a8] truncate max-w-md">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Global Search Bar */}
        <div ref={searchRef} className="relative hidden sm:block w-48 lg:w-72">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim() && searchResults) setShowResults(true);
              }}
              placeholder="Buscar host, tarea, IP..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#0c121e] border border-[#1e2b45] text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[var(--cyber-primary)] transition-all font-mono"
            />
            <Search size={14} className="absolute left-2.5 top-2 text-[#64748b]" />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults(null);
                  setShowResults(false);
                }}
                className="absolute right-2 top-2 text-[#64748b] hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Floating Search Results Dropdown */}
          {showResults && (
            <div className="absolute top-10 right-0 w-80 max-h-96 overflow-y-auto rounded-xl bg-[#0c1220] border border-[#202e48] shadow-2xl p-3 z-50 animate-fade-in text-xs space-y-3">
              {isSearching ? (
                <div className="p-4 text-center text-[#8493a8] font-mono">Buscando...</div>
              ) : !hasAnyResults ? (
                <div className="p-4 text-center text-[#64748b]">No se encontraron coincidencias</div>
              ) : (
                <>
                  {/* Destinations Results */}
                  {searchResults.destinations.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[var(--cyber-primary)] tracking-wider px-2 block mb-1">
                        Destinos ({searchResults.destinations.length})
                      </span>
                      <div className="space-y-1">
                        {searchResults.destinations.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => {
                              onNavigate('destinations');
                              setShowResults(false);
                              setSearchQuery('');
                            }}
                            className="p-2 rounded-lg bg-[#070a12] hover:bg-[#121c2e] cursor-pointer flex items-center justify-between border border-[#182338]"
                          >
                            <div className="flex items-center gap-2">
                              <Server size={13} className="text-[var(--cyber-primary)]" />
                              <span className="font-bold text-white">{d.name}</span>
                            </div>
                            <span className="text-[10px] text-[#8493a8] font-mono">{d.ip_address || d.hostname}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks Results */}
                  {searchResults.tasks.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[var(--cyber-success)] tracking-wider px-2 block mb-1">
                        Tareas ({searchResults.tasks.length})
                      </span>
                      <div className="space-y-1">
                        {searchResults.tasks.map((tk) => (
                          <div
                            key={tk.id}
                            onClick={() => {
                              onNavigate('tasks');
                              setShowResults(false);
                              setSearchQuery('');
                            }}
                            className="p-2 rounded-lg bg-[#070a12] hover:bg-[#121c2e] cursor-pointer flex items-center justify-between border border-[#182338]"
                          >
                            <div className="flex items-center gap-2">
                              <ListTodo size={13} className="text-[var(--cyber-success)]" />
                              <span className="font-bold text-white truncate max-w-[140px]">{tk.name}</span>
                            </div>
                            <span className="text-[10px] text-[#64748b]">{tk.category_name || 'General'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Executions Results */}
                  {searchResults.executions.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#a855f7] tracking-wider px-2 block mb-1">
                        Ejecuciones ({searchResults.executions.length})
                      </span>
                      <div className="space-y-1">
                        {searchResults.executions.map((e) => (
                          <div
                            key={e.id}
                            onClick={() => {
                              onNavigate('executions');
                              setShowResults(false);
                              setSearchQuery('');
                            }}
                            className="p-2 rounded-lg bg-[#070a12] hover:bg-[#121c2e] cursor-pointer flex items-center justify-between border border-[#182338]"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Terminal size={13} className="text-[#a855f7] shrink-0" />
                              <span className="font-semibold text-white truncate">{e.task_name}</span>
                            </div>
                            <span className="text-[10px] text-[#8493a8] font-mono shrink-0">{e.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Engine Status Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0c1422] border border-[#182338] text-[11px] font-mono">
          <Activity size={12} className="text-[var(--cyber-success)] animate-pulse" />
          <span className="text-[#64748b]">MOTOR:</span>
          <span className="text-[var(--cyber-success)] font-semibold">ACTIVO</span>
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0c121e] border border-[#182338] text-xs font-mono text-[var(--cyber-primary)]">
          <Clock size={13} />
          <span>{time}</span>
        </div>
      </div>
    </header>
  );
};
