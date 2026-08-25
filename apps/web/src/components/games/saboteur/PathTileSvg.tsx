'use client';

import {
  SaboteurActionKind,
  SaboteurCardDef,
  SaboteurGoalContent,
  SaboteurTool,
  saboteurGetCardDef,
  saboteurRotatedPaths,
} from '@repo/types';

// Portrait card geometry: 70 x 100 (matches hand-card aspect ratio 7:10).
const W = 70;
const H = 100;
const CX = W / 2;
const CY = H / 2;

const EDGE_MIDPOINTS: Array<[number, number]> = [
  [CX, 0], // N
  [W, CY], // E
  [CX, H], // S
  [0, CY], // W
];

// Dirt palette
const DIRT_TOP = '#b0722c';
const DIRT_BOTTOM = '#7a4318';
const DIRT_SPECK_DARK = '#5f3413';
const DIRT_SPECK_LIGHT = '#c98a44';
const TUNNEL_WALL = '#4a2c12';
const TUNNEL_HOLE = '#1b0e05';
const TUNNEL_GLOW = '#33200f';
const WOOD = '#9c6b3d';
const WOOD_DARK = '#6b4423';
const WOOD_LIGHT = '#c99a5f';

/** Deterministic dirt speckles so every tile feels hand-drawn but stable. */
const SPECKLES: Array<{ x: number; y: number; r: number; dark: boolean }> = [
  { x: 10, y: 18, r: 2.6, dark: true },
  { x: 59, y: 12, r: 2.0, dark: false },
  { x: 15, y: 78, r: 2.3, dark: true },
  { x: 53, y: 86, r: 2.7, dark: false },
  { x: 35, y: 8, r: 1.8, dark: true },
  { x: 63, y: 62, r: 2.1, dark: true },
  { x: 6, y: 52, r: 1.8, dark: false },
  { x: 43, y: 92, r: 1.6, dark: true },
  { x: 24, y: 6, r: 1.4, dark: false },
  { x: 66, y: 34, r: 1.4, dark: false },
];

function DirtBackground({ rounded = 8 }: { rounded?: number }) {
  return (
    <>
      <defs>
        <linearGradient id="sb-dirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={DIRT_TOP} />
          <stop offset="100%" stopColor={DIRT_BOTTOM} />
        </linearGradient>
        <radialGradient id="sb-dirt-light" cx="30%" cy="20%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} rx={rounded} fill="url(#sb-dirt)" />
      <rect width={W} height={H} rx={rounded} fill="url(#sb-dirt-light)" />
      {/* strata bands */}
      <path
        d="M0 26 Q18 22 35 26 T70 25 L70 31 Q53 34 35 31 T0 32 Z"
        fill={DIRT_SPECK_DARK}
        opacity="0.18"
      />
      <path
        d="M0 68 Q21 64 39 69 T70 66 L70 72 Q49 76 32 72 T0 74 Z"
        fill={DIRT_SPECK_DARK}
        opacity="0.14"
      />
      {SPECKLES.map((s, i) => (
        <ellipse
          key={i}
          cx={s.x}
          cy={s.y}
          rx={s.r}
          ry={s.r * 0.75}
          fill={s.dark ? DIRT_SPECK_DARK : DIRT_SPECK_LIGHT}
          opacity={s.dark ? 0.55 : 0.5}
        />
      ))}
    </>
  );
}

/** Wooden support frame drawn across an edge opening. */
function WoodSupport({ edge }: { edge: number }) {
  const [mx, my] = EDGE_MIDPOINTS[edge];
  const horizontal = edge === 0 || edge === 2; // opening faces vertically
  const inset = 5;
  const w = horizontal ? 30 : 8;
  const h = horizontal ? 8 : 30;
  const x = horizontal ? mx - w / 2 : edge === 1 ? mx - inset - w : mx + inset;
  const y = horizontal ? (edge === 0 ? my + inset : my - inset - h) : my - h / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="2.5"
        fill={WOOD}
        stroke={WOOD_DARK}
        strokeWidth="2"
      />
      <line
        x1={horizontal ? x + 5 : x + w / 2}
        y1={horizontal ? y + h / 2 : y + 5}
        x2={horizontal ? x + w - 5 : x + w / 2}
        y2={horizontal ? y + h / 2 : y + h - 5}
        stroke={WOOD_LIGHT}
        strokeWidth="1.6"
        opacity="0.85"
      />
    </g>
  );
}

function tunnelSegment(edge: number, deadEnd: boolean) {
  const [mx, my] = EDGE_MIDPOINTS[edge];
  const ex = mx + (CX - mx) * (deadEnd ? 0.6 : 1);
  const ey = my + (CY - my) * (deadEnd ? 0.6 : 1);
  return (
    <line
      key={`seg-${edge}`}
      x1={mx}
      y1={my}
      x2={ex}
      y2={ey}
      stroke={TUNNEL_WALL}
      strokeWidth={30}
      strokeLinecap="round"
    />
  );
}

function tunnelCore(edge: number, deadEnd: boolean) {
  const [mx, my] = EDGE_MIDPOINTS[edge];
  const ex = mx + (CX - mx) * (deadEnd ? 0.52 : 1);
  const ey = my + (CY - my) * (deadEnd ? 0.52 : 1);
  return (
    <g key={`core-${edge}`}>
      <line
        x1={mx}
        y1={my}
        x2={ex}
        y2={ey}
        stroke={TUNNEL_HOLE}
        strokeWidth={20}
        strokeLinecap="round"
      />
      {!deadEnd && (
        <line
          x1={mx * 0.85 + ex * 0.15}
          y1={my * 0.85 + ey * 0.15}
          x2={ex * 0.9 + mx * 0.1}
          y2={ey * 0.9 + my * 0.1}
          stroke={TUNNEL_GLOW}
          strokeWidth={6}
          strokeLinecap="round"
          opacity="0.6"
        />
      )}
    </g>
  );
}

/** Three stones lined up ACROSS the tunnel mouth — never overlapping. */
function DeadEndRubble({ edge }: { edge: number }) {
  const [mx, my] = EDGE_MIDPOINTS[edge];
  const cx = mx + (CX - mx) * 0.48;
  const cy = my + (CY - my) * 0.48;
  const vertical = edge === 0 || edge === 2; // tunnel runs vertically
  const stones = [
    { o: -9.5, r: 4.4, fill: '#8d8a84' },
    { o: 0, r: 5.4, fill: '#a8a29e' },
    { o: 9.5, r: 4.1, fill: '#78716c' },
  ];
  return (
    <g>
      {stones.map((s, i) => (
        <circle
          key={i}
          cx={vertical ? cx + s.o : cx}
          cy={vertical ? cy : cy + s.o}
          r={s.r}
          fill={s.fill}
          stroke="#57534e"
          strokeWidth="1.4"
        />
      ))}
    </g>
  );
}

interface PathTileSvgProps {
  cardId: string;
  rotation?: 0 | 180;
  className?: string;
}

export function PathTileSvg({ cardId, rotation = 0, className }: PathTileSvgProps) {
  const def = saboteurGetCardDef(cardId);

  if (cardId === 'goal') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none">
        <defs>
          <linearGradient id="sb-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b8781" />
            <stop offset="100%" stopColor="#5c5751" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#sb-rock)" />
        <path d={`M0 ${H} L0 58 Q${CX} 8 ${W} 58 L${W} ${H} Z`} fill="#6e6963" />
        <path
          d={`M0 ${H} L0 74 Q${CX} 34 ${W} 74 L${W} ${H} Z`}
          fill="url(#sb-rock)"
          opacity="0.85"
        />
        <circle cx="17" cy="46" r="2" fill="#d6d3d1" opacity="0.7" />
        <circle cx="53" cy="38" r="1.6" fill="#d6d3d1" opacity="0.6" />
        <circle cx="45" cy="58" r="2.2" fill="#fbbf24" opacity="0.5" />
        <text x={CX} y="84" textAnchor="middle" fontSize="28">
          ❓
        </text>
      </svg>
    );
  }

  const rotated = def?.paths ? saboteurRotatedPaths(def.paths, rotation) : [];
  const isStart = cardId === 'start';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none">
      <DirtBackground />
      {/* tunnel walls */}
      {rotated.map((group, gi) => (
        <g key={`w${gi}`}>{group.map((edge) => tunnelSegment(edge, group.length === 1))}</g>
      ))}
      {/* junction chamber */}
      {rotated.some((g) => g.length > 1) && <circle cx={CX} cy={CY} r="16" fill={TUNNEL_WALL} />}
      {/* tunnel interiors */}
      {rotated.map((group, gi) => (
        <g key={`c${gi}`}>{group.map((edge) => tunnelCore(edge, group.length === 1))}</g>
      ))}
      {rotated.some((g) => g.length > 1) && (
        <>
          <circle cx={CX} cy={CY} r="11" fill={TUNNEL_HOLE} />
          <circle
            cx={CX}
            cy={CY}
            r="11"
            fill="none"
            stroke={WOOD_DARK}
            strokeWidth="2.2"
            opacity="0.65"
          />
        </>
      )}
      {/* dead-end rubble */}
      {rotated.map((group, gi) =>
        group.length === 1 ? <DeadEndRubble key={`r${gi}`} edge={group[0]} /> : null,
      )}
      {/* wooden supports at every opening */}
      {rotated.flatMap((group, gi) =>
        group.map((edge) => <WoodSupport key={`s${gi}-${edge}`} edge={edge} />),
      )}
      {isStart && (
        <>
          <rect
            x="20"
            y="28"
            width="30"
            height="44"
            rx="6"
            fill={WOOD}
            stroke={WOOD_DARK}
            strokeWidth="3"
          />
          <rect
            x="24"
            y="32"
            width="22"
            height="36"
            rx="4"
            fill="none"
            stroke={WOOD_LIGHT}
            strokeWidth="1.5"
            opacity="0.7"
          />
          <rect x="26" y="32" width="4" height="36" rx="2" fill={WOOD_DARK} />
          <rect x="40" y="32" width="4" height="36" rx="2" fill={WOOD_DARK} />
          {[38, 45, 52, 59].map((y) => (
            <rect key={y} x="27" y={y} width="16" height="3" rx="1.5" fill={WOOD_LIGHT} />
          ))}
        </>
      )}
    </svg>
  );
}

const TOOL_ICONS: Record<SaboteurTool, string> = {
  [SaboteurTool.LANTERN]: '🔦',
  [SaboteurTool.CART]: '🛒',
  [SaboteurTool.PICKAXE]: '⛏️',
};

/** 3D icon art from thiings.co (free AI-generated icon library). */
export const SABOTEUR_IMG = {
  goldIngot: '/images/saboteur/gold-ingot.png',
  lantern: '/images/saboteur/lantern.png',
  pickaxe: '/images/saboteur/pickaxe.png',
  cart: '/images/saboteur/wheelbarrow.png',
  hammer: '/images/saboteur/hammer.png',
  wrench: '/images/saboteur/wrench.png',
  map: '/images/saboteur/treasure-map.png',
  rock: '/images/saboteur/rock.png',
  chest: '/images/saboteur/treasure-chest.png',
  dynamite: '/images/saboteur/dynamite.png',
} as const;

export function saboteurToolImg(tool: SaboteurTool): string {
  switch (tool) {
    case SaboteurTool.LANTERN:
      return SABOTEUR_IMG.lantern;
    case SaboteurTool.CART:
      return SABOTEUR_IMG.cart;
    default:
      return SABOTEUR_IMG.pickaxe;
  }
}

/** Inline tool image (replaces the old emoji icons). */
export function ToolImg({ tool, className }: { tool: SaboteurTool; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={saboteurToolImg(tool)}
      alt={tool}
      draggable={false}
      className={`inline-block object-contain ${className ?? 'w-4 h-4'}`}
    />
  );
}

const KIND_THEME = {
  [SaboteurActionKind.BREAK]: { band: '#ef4444', bandDark: '#991b1b', badge: '#fee2e2' },
  [SaboteurActionKind.REPAIR]: { band: '#22c55e', bandDark: '#15803d', badge: '#dcfce7' },
  [SaboteurActionKind.MAP]: { band: '#0ea5e9', bandDark: '#0369a1', badge: '#e0f2fe' },
  [SaboteurActionKind.ROCKFALL]: { band: '#f97316', bandDark: '#c2410c', badge: '#ffedd5' },
} as const;

interface ActionCardFaceProps {
  cardId: string;
  className?: string;
}

export function ActionCardFace({ cardId, className }: ActionCardFaceProps) {
  const def = saboteurGetCardDef(cardId);
  const action = def?.action;
  const kind = action?.kind;
  const theme = kind ? KIND_THEME[kind] : null;

  if (!action || !kind || !theme) {
    return <div className={`w-full h-full bg-stone-200 ${className ?? ''}`}>?</div>;
  }

  const tools = action.tools ?? [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none">
      {/* parchment body */}
      <defs>
        <radialGradient id="sb-parch" cx="50%" cy="35%" r="90%">
          <stop offset="0%" stopColor="#fff8e7" />
          <stop offset="100%" stopColor="#e2c890" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#f3e5c3" />
      <rect width={W} height={H} fill="url(#sb-parch)" opacity="0.5" />
      {/* top colour band */}
      <rect x="0" y="0" width={W} height="18" fill={theme.band} />
      <rect x="0" y="16" width={W} height="4" fill={theme.bandDark} />
      {/* kind glyph on the band */}
      <image
        href={
          kind === SaboteurActionKind.BREAK
            ? SABOTEUR_IMG.hammer
            : kind === SaboteurActionKind.REPAIR
              ? SABOTEUR_IMG.wrench
              : kind === SaboteurActionKind.MAP
                ? SABOTEUR_IMG.map
                : SABOTEUR_IMG.rock
        }
        x={CX - 6}
        y="3"
        width="12"
        height="12"
      />
      {/* corner rivets */}
      {[
        [6, 26],
        [64, 26],
        [6, 92],
        [64, 92],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.8" fill={theme.bandDark} opacity="0.65" />
      ))}
      {/* main badge */}
      <circle cx={CX} cy="50" r="16" fill={theme.badge} stroke={theme.bandDark} strokeWidth="2.5" />
      {kind === SaboteurActionKind.BREAK || kind === SaboteurActionKind.REPAIR ? (
        <>
          <image
            href={
              tools.length === 1
                ? saboteurToolImg(tools[0])
                : kind === SaboteurActionKind.BREAK
                  ? SABOTEUR_IMG.hammer
                  : SABOTEUR_IMG.wrench
            }
            x={CX - 10}
            y="40"
            width="20"
            height="20"
          />
          {/* secondary tools row */}
          {tools.length > 1 &&
            tools.map((t, ti) => (
              <image
                key={t}
                href={saboteurToolImg(t)}
                x={CX - tools.length * 7 + ti * 14 + 1}
                y="68"
                width="12"
                height="12"
              />
            ))}
          {kind === SaboteurActionKind.BREAK && (
            <g stroke="#dc2626" strokeWidth="2.4" strokeLinecap="round">
              <line x1="22" y1="38" x2="48" y2="62" />
              <line x1="29" y1="35" x2="44" y2="52" opacity="0.55" />
            </g>
          )}
          {kind === SaboteurActionKind.REPAIR && (
            <text x={CX} y="41" textAnchor="middle" fontSize="9">
              ✨
            </text>
          )}
        </>
      ) : kind === SaboteurActionKind.MAP ? (
        <>
          <image href={SABOTEUR_IMG.map} x={CX - 11} y="38" width="22" height="22" />
          <path
            d="M14 82 Q24 74 30 80 T52 78"
            fill="none"
            stroke={theme.bandDark}
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
          <circle cx="52" cy="78" r="2.6" fill="#ef4444" />
        </>
      ) : (
        <>
          <image href={SABOTEUR_IMG.rock} x={CX - 11} y="40" width="22" height="22" />
          <g stroke={theme.bandDark} strokeWidth="1.8" strokeLinecap="round" opacity="0.7">
            <line x1="24" y1="70" x2="24" y2="78" />
            <line x1={CX} y1="72" x2={CX} y2="82" />
            <line x1="46" y1="70" x2="46" y2="78" />
          </g>
        </>
      )}
    </svg>
  );
}

export function GoalRevealFace({ content }: { content: Exclude<SaboteurGoalContent, null> }) {
  const gold = content === 'GOLD';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sb-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {gold ? (
        <>
          <rect width={W} height={H} fill="url(#sb-gold)" />
          <image href={SABOTEUR_IMG.chest} x={CX - 21} y="26" width="42" height="42" />
          <text x="13" y="30" fontSize="12" opacity="0.9">
            ✨
          </text>
          <text x="52" y="34" fontSize="10" opacity="0.9">
            ✨
          </text>
        </>
      ) : (
        <>
          <rect width={W} height={H} fill="#6b7280" />
          <image href={SABOTEUR_IMG.rock} x={CX - 20} y="28" width="40" height="40" />
        </>
      )}
    </svg>
  );
}

export function GoldNuggetValue({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center border-4 border-black shadow-[3px_3px_0_0_#000] overflow-hidden ${className ?? ''}`}
      style={{ background: 'linear-gradient(160deg,#fde68a 0%,#f59e0b 55%,#b45309 100%)' }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.55),transparent_55%)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SABOTEUR_IMG.goldIngot}
        alt="gold"
        draggable={false}
        className="relative w-7 h-7 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
      />
      <span className="relative text-xs font-black leading-none text-amber-950">×{value}</span>
    </div>
  );
}
