'use client';

import {
  SaboteurActionKind,
  SaboteurCardDef,
  SaboteurGoalContent,
  SaboteurTool,
  saboteurGetCardDef,
  saboteurRotatedPaths,
} from '@repo/types';

const EDGE_MIDPOINTS: Array<[number, number]> = [
  [50, 0], // N
  [100, 50], // E
  [50, 100], // S
  [0, 50], // W
];

const DIRT = '#b45309';
const DIRT_EDGE = '#78350f';
const TUNNEL = '#451a03';

/** Renders one tunnel segment from an edge midpoint toward the card centre. */
function tunnelSegment(edge: number, deadEnd: boolean) {
  const [mx, my] = EDGE_MIDPOINTS[edge];
  const ex = mx + (50 - mx) * (deadEnd ? 0.62 : 1);
  const ey = my + (50 - my) * (deadEnd ? 0.62 : 1);
  return (
    <line
      key={`${edge}-${deadEnd}`}
      x1={mx}
      y1={my}
      x2={ex}
      y2={ey}
      stroke={TUNNEL}
      strokeWidth={34}
      strokeLinecap="round"
    />
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
      <svg viewBox="0 0 100 100" className={className}>
        <rect width="100" height="100" rx="8" fill="#57534e" />
        <rect x="6" y="6" width="88" height="88" rx="6" fill="#78716c" />
        <text x="50" y="66" textAnchor="middle" fontSize="48">
          ❓
        </text>
      </svg>
    );
  }

  const rotated = def?.paths ? saboteurRotatedPaths(def.paths, rotation) : [];

  return (
    <svg viewBox="0 0 100 100" className={className}>
      <rect width="100" height="100" rx="8" fill={DIRT} />
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="6"
        fill={DIRT}
        stroke={DIRT_EDGE}
        strokeWidth="4"
      />
      {rotated.map((group, gi) => {
        const deadEnd = group.length === 1;
        return (
          <g key={gi}>
            {group.map((edge) => tunnelSegment(edge, deadEnd))}
            {!deadEnd && <circle cx="50" cy="50" r="17" fill={TUNNEL} />}
          </g>
        );
      })}
      {cardId === 'start' && (
        <>
          <rect
            x="32"
            y="32"
            width="36"
            height="36"
            rx="6"
            fill="#fbbf24"
            stroke={TUNNEL}
            strokeWidth="3"
          />
          <text x="50" y="60" textAnchor="middle" fontSize="26">
            🪜
          </text>
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

interface ActionCardFaceProps {
  cardId: string;
  className?: string;
}

export function ActionCardFace({ cardId, className }: ActionCardFaceProps) {
  const def = saboteurGetCardDef(cardId);
  const action = def?.action;

  let emoji = '❔';
  let label = '';
  let bg = 'bg-stone-300';
  if (action?.kind === SaboteurActionKind.BREAK) {
    emoji = '🔨';
    label = TOOL_ICONS[action.tools![0]];
    bg = 'bg-red-300';
  } else if (action?.kind === SaboteurActionKind.REPAIR) {
    emoji = '🔧';
    label = action.tools!.map((t) => TOOL_ICONS[t]).join('');
    bg = 'bg-emerald-300';
  } else if (action?.kind === SaboteurActionKind.MAP) {
    emoji = '🗺️';
    bg = 'bg-sky-300';
  } else if (action?.kind === SaboteurActionKind.ROCKFALL) {
    emoji = '🪨';
    bg = 'bg-orange-300';
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${bg}`}>
      <span className="text-lg sm:text-xl leading-none">{emoji}</span>
      {label && <span className="text-sm sm:text-base leading-none">{label}</span>}
    </div>
  );
}

export function GoalRevealFace({ content }: { content: Exclude<SaboteurGoalContent, null> }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="text-xl">{content === 'GOLD' ? '💰' : '🪨'}</span>
    </div>
  );
}

export function GoldNuggetValue({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-yellow-300 border-4 border-black shadow-[3px_3px_0_0_#000] ${className ?? ''}`}
    >
      <span className="text-lg leading-none">🪙</span>
      <span className="text-xs font-black leading-none">×{value}</span>
    </div>
  );
}
