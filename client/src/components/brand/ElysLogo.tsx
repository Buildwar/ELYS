import React from 'react';

interface OrbitalSymbolProps {
  size?: number | string;
  className?: string;
  glow?: boolean;
}

export const OrbitalSymbol: React.FC<OrbitalSymbolProps> = ({
  size = 40,
  className = '',
  glow = true,
}) => {
  return (
    <svg
      viewBox="0 0 500 500"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <radialGradient id="symAmbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00f0ff" stop-opacity={glow ? '0.22' : '0.1'} />
          <stop offset="60%" stop-color="#0066ff" stop-opacity={glow ? '0.06' : '0'} />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </radialGradient>

        <radialGradient id="symSphereCore" cx="42%" cy="40%" r="58%">
          <stop offset="0%" stop-color="#0e223d" />
          <stop offset="35%" stop-color="#071326" />
          <stop offset="70%" stop-color="#040914" />
          <stop offset="100%" stop-color="#010308" />
        </radialGradient>

        <radialGradient id="symSphereSpecular" cx="68%" cy="32%" r="40%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
          <stop offset="25%" stop-color="#7dd3fc" stop-opacity="0.6" />
          <stop offset="60%" stop-color="#0284c7" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </radialGradient>

        <radialGradient id="symSphereRimGlow" cx="30%" cy="75%" r="45%">
          <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.55" />
          <stop offset="50%" stop-color="#0284c7" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </radialGradient>

        <linearGradient id="symChromeRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="18%" stop-color="#e2e8f0" />
          <stop offset="35%" stop-color="#94a3b8" />
          <stop offset="52%" stop-color="#334155" />
          <stop offset="68%" stop-color="#64748b" />
          <stop offset="82%" stop-color="#cbd5e1" />
          <stop offset="92%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#93c5fd" />
        </linearGradient>

        <linearGradient id="symRingBevel" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
          <stop offset="40%" stop-color="#38bdf8" stop-opacity="0.6" />
          <stop offset="70%" stop-color="#0f172a" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.8" />
        </linearGradient>

        <linearGradient id="symEnergyBeam" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.95" />
          <stop offset="30%" stop-color="#00d4ff" stop-opacity="0.75" />
          <stop offset="70%" stop-color="#0066ff" stop-opacity="0.4" />
          <stop offset="100%" stop-color="#00f0ff" stop-opacity="0.95" />
        </linearGradient>

        <radialGradient id="symFlareGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="25%" stop-color="#67e8f9" stop-opacity="0.9" />
          <stop offset="55%" stop-color="#00f0ff" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#00f0ff" stop-opacity="0" />
        </radialGradient>

        <filter id="symNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur1" />
          <feGaussianBlur stdDeviation="13" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="symSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {glow && <circle cx="250" cy="250" r="230" fill="url(#symAmbGlow)" />}

      {/* Back Layer of Energy Orbit */}
      <g transform="rotate(-38 250 250)">
        <path
          d="M 50 250 A 200 125 0 0 1 450 250"
          fill="none"
          stroke="url(#symEnergyBeam)"
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#symNeonGlow)"
          opacity="0.75"
        />
        <path
          d="M 65 250 A 185 110 0 0 1 435 250"
          fill="none"
          stroke="#00f0ff"
          strokeWidth="1.8"
          opacity="0.9"
        />
      </g>

      {/* Back Layer of Metallic Chrome Ring */}
      <g transform="rotate(-38 250 250)">
        <path
          d="M 40 250 A 210 135 0 0 1 460 250 L 418 250 A 168 95 0 0 0 82 250 Z"
          fill="url(#symChromeRing)"
          opacity="0.85"
        />
        <path
          d="M 42 250 A 210 135 0 0 1 458 250"
          fill="none"
          stroke="url(#symRingBevel)"
          strokeWidth="2.5"
          opacity="0.6"
        />
      </g>

      {/* Central Obsidian Sphere */}
      <g>
        <circle cx="250" cy="250" r="105" fill="url(#symSphereCore)" />
        <circle cx="250" cy="250" r="105" fill="none" stroke="#0f172a" strokeWidth="1.5" opacity="0.6" />
        <circle cx="250" cy="250" r="105" fill="url(#symSphereRimGlow)" />
        <circle cx="250" cy="250" r="105" fill="url(#symSphereSpecular)" />
        <path
          d="M 235 152 C 285 158, 335 195, 350 248 C 344 220, 320 180, 270 160 Z"
          fill="#ffffff"
          opacity="0.8"
          filter="url(#symSoftGlow)"
        />
      </g>

      {/* Front Sculpted Chrome Ring */}
      <g transform="rotate(-38 250 250)">
        <path
          d="M 40 250 A 210 135 0 0 0 460 250 L 418 250 A 168 95 0 0 1 82 250 Z"
          fill="url(#symChromeRing)"
        />
        <path
          d="M 82 250 A 168 95 0 0 0 418 250"
          fill="none"
          stroke="url(#symRingBevel)"
          strokeWidth="3"
        />
        <path
          d="M 40 250 A 210 135 0 0 0 460 250"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          opacity="0.9"
        />
        <path
          d="M 70 270 A 210 135 0 0 0 440 260"
          fill="none"
          stroke="#00f0ff"
          strokeWidth="3.5"
          filter="url(#symSoftGlow)"
          opacity="0.85"
        />
      </g>

      {/* Front Glowing Energy Orbit */}
      <g transform="rotate(-38 250 250)">
        <path
          d="M 45 250 A 205 130 0 0 0 455 250"
          fill="none"
          stroke="url(#symEnergyBeam)"
          strokeWidth="6.5"
          strokeLinecap="round"
          filter="url(#symNeonGlow)"
        />
        <path
          d="M 45 250 A 205 130 0 0 0 455 250"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          opacity="0.9"
        />
      </g>

      {/* Starburst Apex Flares */}
      <g transform="translate(378, 148)">
        <circle cx="0" cy="0" r="26" fill="url(#symFlareGlow)" />
        <ellipse cx="0" cy="0" rx="22" ry="2.5" fill="#ffffff" filter="url(#symSoftGlow)" />
        <ellipse cx="0" cy="0" rx="2.5" ry="22" fill="#ffffff" filter="url(#symSoftGlow)" />
        <circle cx="0" cy="0" r="4" fill="#ffffff" />
      </g>

      <g transform="translate(122, 352)">
        <circle cx="0" cy="0" r="20" fill="url(#symFlareGlow)" />
        <ellipse cx="0" cy="0" rx="16" ry="2" fill="#ffffff" transform="rotate(-35)" filter="url(#symSoftGlow)" />
        <circle cx="0" cy="0" r="3" fill="#ffffff" />
      </g>
    </svg>
  );
};

interface ElysLogoProps {
  layout?: 'vertical' | 'horizontal' | 'compact' | 'symbol';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
}

export const ElysLogo: React.FC<ElysLogoProps> = ({
  layout = 'horizontal',
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  if (layout === 'symbol') {
    const symbolSizes = { sm: 28, md: 38, lg: 54, xl: 76 };
    return <OrbitalSymbol size={symbolSizes[size]} className={className} />;
  }

  if (layout === 'horizontal') {
    const symbolSizes = { sm: 30, md: 40, lg: 52, xl: 68 };
    const fontSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl' };
    const subSizes = { sm: 'text-[8px]', md: 'text-[9.5px]', lg: 'text-[11px]', xl: 'text-xs' };

    return (
      <div className={`flex items-center gap-3 select-none ${className}`}>
        <OrbitalSymbol size={symbolSizes[size]} />
        <div className="flex flex-col min-w-0">
          <div className={`font-mono font-black tracking-widest leading-none flex items-center text-white ${fontSizes[size]}`}>
            <span className="text-white">ELY</span>
            <span className="text-[var(--cyber-primary)] text-glow-primary ml-0.5">S</span>
          </div>
          {showSubtitle && (
            <span className={`font-mono font-bold tracking-[0.22em] text-[#8493a8] uppercase mt-1 truncate ${subSizes[size]}`}>
              Advanced Task Scheduler
            </span>
          )}
        </div>
      </div>
    );
  }

  if (layout === 'compact') {
    const symbolSizes = { sm: 32, md: 48, lg: 64, xl: 84 };
    const fontSizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl', xl: 'text-4xl' };

    return (
      <div className={`flex flex-col items-center select-none ${className}`}>
        <OrbitalSymbol size={symbolSizes[size]} />
        <div className={`font-mono font-black tracking-widest mt-2 flex items-center ${fontSizes[size]}`}>
          <span className="text-white">ELY</span>
          <span className="text-[var(--cyber-primary)] text-glow-primary ml-0.5">S</span>
        </div>
      </div>
    );
  }

  // Primary Vertical Layout (Login, About, Hero)
  const symbolSizes = { sm: 48, md: 68, lg: 96, xl: 120 };
  const fontSizes = { sm: 'text-xl', md: 'text-3xl', lg: 'text-4xl', xl: 'text-5xl' };
  const subSizes = { sm: 'text-[9px]', md: 'text-xs', lg: 'text-sm', xl: 'text-base' };

  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`}>
      <OrbitalSymbol size={symbolSizes[size]} />
      <div className={`font-mono font-black tracking-widest mt-4 flex items-center leading-none ${fontSizes[size]}`}>
        <span className="text-white">ELY</span>
        <span className="text-[var(--cyber-primary)] text-glow-primary ml-1">S</span>
      </div>
      {showSubtitle && (
        <p className={`font-mono font-bold tracking-[0.28em] text-[#8493a8] uppercase mt-2 ${subSizes[size]}`}>
          Advanced Task Scheduler
        </p>
      )}
    </div>
  );
};
