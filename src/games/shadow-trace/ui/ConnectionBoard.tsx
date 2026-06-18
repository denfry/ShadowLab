import { useState } from 'react';
import type { PlayerConnection } from '../domain/types';
import { cx } from '@/core/utils';

interface BoardNode {
  id: string;
  label: string;
}

interface ConnectionBoardProps {
  evidence: BoardNode[];
  suspects: BoardNode[];
  connections: PlayerConnection[];
  onToggle: (evidenceId: string, suspectId: string) => void;
}

const W = 720;
const NODE_W = 200;
const NODE_H = 46;
const GAP = 16;
const PAD = 24;

type Selection = { col: 'ev' | 'su'; id: string } | null;

/** Click an evidence node, then a suspect node, to link/unlink them. SVG lines
 *  visualise the deductions the player has drawn. Pure interaction — scoring is
 *  decided later by the DeductionSystem. */
export function ConnectionBoard({ evidence, suspects, connections, onToggle }: ConnectionBoardProps) {
  const [sel, setSel] = useState<Selection>(null);

  const rows = Math.max(evidence.length, suspects.length);
  const H = PAD * 2 + rows * NODE_H + (rows - 1) * GAP;

  const yOf = (i: number) => PAD + i * (NODE_H + GAP);
  const evX = PAD;
  const suX = W - PAD - NODE_W;
  const evCenter = (i: number) => ({ x: evX + NODE_W, y: yOf(i) + NODE_H / 2 });
  const suCenter = (i: number) => ({ x: suX, y: yOf(i) + NODE_H / 2 });

  const evIndex = new Map(evidence.map((n, i) => [n.id, i]));
  const suIndex = new Map(suspects.map((n, i) => [n.id, i]));

  const click = (col: 'ev' | 'su', id: string) => {
    if (!sel) return setSel({ col, id });
    if (sel.col === col) return setSel({ col, id });
    const evidenceId = col === 'ev' ? id : sel.id;
    const suspectId = col === 'su' ? id : sel.id;
    onToggle(evidenceId, suspectId);
    setSel(null);
  };

  return (
    <div className="panel-inset overflow-x-auto p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[680px]">
        {/* links */}
        {connections.map((c, i) => {
          const ev = evIndex.has(c.fromId) ? c.fromId : c.toId;
          const su = suIndex.has(c.fromId) ? c.fromId : c.toId;
          const ei = evIndex.get(ev);
          const si = suIndex.get(su);
          if (ei === undefined || si === undefined) return null;
          const a = evCenter(ei);
          const b = suCenter(si);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgb(var(--accent))"
              strokeWidth={2}
              strokeOpacity={0.7}
              strokeDasharray="2 6"
            />
          );
        })}

        {evidence.map((n, i) => (
          <Node
            key={n.id}
            x={evX}
            y={yOf(i)}
            label={n.label}
            tone="ev"
            selected={sel?.col === 'ev' && sel.id === n.id}
            active={connections.some((c) => c.fromId === n.id || c.toId === n.id)}
            onClick={() => click('ev', n.id)}
          />
        ))}
        {suspects.map((n, i) => (
          <Node
            key={n.id}
            x={suX}
            y={yOf(i)}
            label={n.label}
            tone="su"
            selected={sel?.col === 'su' && sel.id === n.id}
            active={connections.some((c) => c.fromId === n.id || c.toId === n.id)}
            onClick={() => click('su', n.id)}
          />
        ))}
      </svg>
      <p className="mt-2 px-1 font-mono text-[0.65rem] text-muted">
        {sel ? 'выбери узел в другой колонке, чтобы связать' : 'клик по улике, затем по подозреваемому'}
      </p>
    </div>
  );
}

function Node({
  x,
  y,
  label,
  tone,
  selected,
  active,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  tone: 'ev' | 'su';
  selected: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <g className="cursor-pointer" onClick={onClick}>
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={10}
        fill={selected ? 'rgb(var(--accent) / 0.18)' : 'rgb(var(--panel))'}
        stroke={selected ? 'rgb(var(--accent))' : active ? 'rgb(var(--accent) / 0.5)' : 'rgb(var(--edge))'}
        strokeWidth={selected ? 2 : 1.2}
      />
      <text
        x={x + 14}
        y={y + NODE_H / 2 + 4}
        fill="rgb(var(--ink))"
        fontSize={13}
        fontFamily="'IBM Plex Sans', sans-serif"
      >
        {label.length > 24 ? `${label.slice(0, 23)}…` : label}
      </text>
      <circle
        cx={tone === 'ev' ? x + NODE_W : x}
        cy={y + NODE_H / 2}
        r={4}
        fill={active ? 'rgb(var(--accent))' : 'rgb(var(--edge))'}
      />
    </g>
  );
}
