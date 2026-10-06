import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { Destination } from '../types/index.js';
import {
  Server,
  Monitor,
  Terminal,
  Cpu,
  HardDrive,
  ArrowRight,
  RefreshCw,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface CategoriesViewProps {
  onSelectSystemCategory?: (systemId: string) => void;
}

interface OSCategoryDef {
  id: string;
  name: string;
  description: string;
  icon: React.FC<any>;
  color: string;
  accentBg: string;
  accentBorder: string;
  supportedOS: string[];
}

const OS_CATEGORIES: OSCategoryDef[] = [
  {
    id: 'windows_server',
    name: 'Windows Server',
    description: 'Servidores empresariales de Microsoft, controladores de dominio Active Directory, bases de datos SQL y almacenamiento corporativo.',
    icon: Server,
    color: '#00f0ff',
    accentBg: 'bg-[#00f0ff]/10',
    accentBorder: 'border-[#00f0ff]/30',
    supportedOS: ['Windows Server 2025', 'Windows Server 2022', 'Windows Server 2019', 'Windows Server 2016'],
  },
  {
    id: 'windows_desktop',
    name: 'Windows Desktop',
    description: 'Estaciones de trabajo de operadores, clientes técnicos, puestos locales y equipos cliente con conectividad PowerShell / WinRM.',
    icon: Monitor,
    color: '#38bdf8',
    accentBg: 'bg-[#38bdf8]/10',
    accentBorder: 'border-[#38bdf8]/30',
    supportedOS: ['Windows 11 Enterprise', 'Windows 11 Pro', 'Windows 10 Pro'],
  },
  {
    id: 'linux',
    name: 'Linux',
    description: 'Servidores de producción, nodos backend, microservicios, bases de datos y appliances basados en distribuciones Linux conectadas por SSH.',
    icon: Terminal,
    color: '#ff9900',
    accentBg: 'bg-[#ff9900]/10',
    accentBorder: 'border-[#ff9900]/30',
    supportedOS: ['Ubuntu', 'Debian', 'Rocky Linux', 'RHEL', 'AlmaLinux', 'CentOS', 'Fedora', 'openSUSE'],
  },
  {
    id: 'bsd',
    name: 'BSD',
    description: 'Sistemas operativos de la familia BSD orientados a seguridad perimetral, firewalls, almacenamiento ZFS y servicios de red dedicados.',
    icon: Cpu,
    color: '#a855f7',
    accentBg: 'bg-[#a855f7]/10',
    accentBorder: 'border-[#a855f7]/30',
    supportedOS: ['FreeBSD', 'OpenBSD', 'NetBSD', 'TrueNAS Core'],
  },
  {
    id: 'other',
    name: 'Otros',
    description: 'Dispositivos de almacenamiento NAS, appliances de red, routers, hipervisores y servidores con interfaces remotas personalizadas.',
    icon: HardDrive,
    color: '#94a3b8',
    accentBg: 'bg-[#94a3b8]/10',
    accentBorder: 'border-[#94a3b8]/30',
    supportedOS: ['Synology DSM', 'QNAP QTS', 'VMware ESXi', 'Proxmox VE', 'Network Appliance'],
  },
];

export const CategoriesView: React.FC<CategoriesViewProps> = ({ onSelectSystemCategory }) => {
  const { t } = useTranslation();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDestinations = async () => {
      try {
        setLoading(true);
        const data = await api.getDestinations();
        setDestinations(data);
      } catch (err) {
        console.error('Failed to load destinations for categories view:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDestinations();
  }, []);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#141d2e] border border-[#223352] flex items-center justify-center text-[var(--cyber-primary)]">
            <Layers size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono tracking-wide text-white">
              Sistemas y Categorías de Destino
            </h1>
            <p className="text-xs text-[#8493a8] mt-0.5">
              Organización y clasificación de equipos y servidores sobre los que ELYS ejecuta tareas automatizadas
            </p>
          </div>
        </div>
      </div>

      {/* Categories Cards */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-[#8493a8]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--cyber-primary)]" />
          <span className="ml-3 font-mono text-xs">{t('common.loading')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {OS_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const hostsInCat = destinations.filter((d) => d.system_type === cat.id);
            const activeHosts = hostsInCat.filter((d) => d.is_active === 1);

            // Group by distribution
            const distributions: Record<string, number> = {};
            for (const h of hostsInCat) {
              const name = h.os_name || 'Desconocido';
              distributions[name] = (distributions[name] || 0) + 1;
            }

            return (
              <div
                key={cat.id}
                className="p-6 rounded-2xl bg-[#0c1220] border border-[#1e2d4a] hover:border-[var(--cyber-primary)]/40 transition-all flex flex-col justify-between group shadow-xl"
              >
                <div>
                  {/* Category Top Row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{ backgroundColor: `${cat.color}15`, borderColor: `${cat.color}40`, color: cat.color }}
                      >
                        <Icon size={24} />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white font-mono tracking-wide">
                          {cat.name}
                        </h2>
                        <span className="text-[11px] font-mono text-[#8493a8]">
                          {hostsInCat.length === 1 ? '1 equipo registrado' : `${hostsInCat.length} equipos registrados`}
                        </span>
                      </div>
                    </div>

                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-mono font-bold"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      {activeHosts.length} activos
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#94a3b8] mb-4 leading-relaxed">
                    {cat.description}
                  </p>

                  {/* Registered Distributions in this system */}
                  {Object.keys(distributions).length > 0 && (
                    <div className="mb-4">
                      <span className="text-[10px] font-mono text-[#64748b] uppercase tracking-wider block mb-2 font-semibold">
                        Distribuciones en catálogo
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(distributions).map(([dist, count]) => (
                          <span
                            key={dist}
                            className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#141d2e] text-[#cbd5e1] border border-[#202e48]"
                          >
                            {dist} <strong className="text-[var(--cyber-primary)]">({count})</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Supported OS reference */}
                  <div className="mb-5">
                    <span className="text-[10px] font-mono text-[#64748b] uppercase tracking-wider block mb-1.5 font-semibold">
                      Sistemas soportados
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {cat.supportedOS.map((os) => (
                        <span
                          key={os}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#070a12] text-[#8493a8] border border-[#162033]"
                        >
                          {os}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Navigate to Destinos */}
                <div className="pt-4 border-t border-[#182338] flex items-center justify-between">
                  <span className="text-xs text-[#8493a8] font-mono">
                    ID: <code className="text-white">{cat.id}</code>
                  </span>

                  {onSelectSystemCategory && (
                    <button
                      onClick={() => onSelectSystemCategory(cat.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#141d2e] hover:bg-[var(--cyber-primary)] text-[var(--cyber-primary)] hover:text-black font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Ver Equipos</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
