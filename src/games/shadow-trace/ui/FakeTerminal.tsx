import { useMemo, useRef, useState } from 'react';
import type { TerminalCommand } from '../domain/types';

interface FakeTerminalProps {
  commands: TerminalCommand[];
}

interface Line {
  prompt: boolean;
  text: string;
}

/**
 * A sandboxed prop terminal. It ONLY echoes scripted output from the case data —
 * there is no eval, no network, no filesystem. It cannot be turned into a real
 * tool; that is a deliberate safety boundary for the detective game.
 */
export function FakeTerminal({ commands }: FakeTerminalProps) {
  const [lines, setLines] = useState<Line[]>([
    { prompt: false, text: 'helios-case // защищённый просмотрщик материалов' },
    { prompt: false, text: "наберите 'help' для списка команд" },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of commands) map.set(c.cmd.trim().toLowerCase(), c.output);
    return map;
  }, [commands]);

  const run = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;
    const out = table.get(cmd);
    const next: Line[] = [{ prompt: true, text: raw }];
    if (out) {
      out.forEach((t) => next.push({ prompt: false, text: t }));
    } else {
      next.push({ prompt: false, text: `неизвестная команда: ${cmd}. наберите 'help'.` });
    }
    setLines((ls) => [...ls, ...next]);
    setInput('');
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  };

  return (
    <div className="panel-inset overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-edge/50 bg-bg-2/60 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-bad/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-good/70" />
        <span className="ml-2 font-mono text-[0.65rem] text-muted">helios-terminal · read-only</span>
      </div>
      <div ref={scrollRef} className="h-64 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className={l.prompt ? 'text-accent' : 'text-muted'}>
            {l.prompt ? '> ' : ''}
            {l.text}
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-edge/50 px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
      >
        <span className="font-mono text-accent">{'>'}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="help"
          spellCheck={false}
          className="w-full bg-transparent font-mono text-xs text-ink outline-none placeholder:text-muted/50"
        />
      </form>
    </div>
  );
}
