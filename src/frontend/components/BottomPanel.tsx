import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import {
  Terminal as TermIcon,
  AlertCircle,
  FileDiff,
  CheckCircle,
  Activity,
  Trash2,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-react';
import { CodeCheckpoint } from '../shared/types';

interface BottomPanelProps {
  checkpoints: CodeCheckpoint[];
  onRollbackCheckpoint: (id: string) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  checkpoints,
  onRollbackCheckpoint,
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'problems' | 'diff' | 'checkpoints' | 'output'>('terminal');
  const [isExpanded, setIsExpanded] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (activeTab === 'terminal' && terminalRef.current && !xtermInstance.current) {
      const term = new XTerm({
        theme: {
          background: '#050505',
          foreground: '#F5F5F5',
          cursor: '#3B82F6',
          selectionBackground: 'rgba(59, 130, 246, 0.3)',
          black: '#000000',
          red: '#EF4444',
          green: '#10B981',
          yellow: '#F59E0B',
          blue: '#3B82F6',
          magenta: '#8B5CF6',
          cyan: '#06B6D4',
          white: '#F5F5F5',
        },
        fontFamily: "'Fira Code', 'JetBrains Mono', Menlo, monospace",
        fontSize: 12,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      xtermInstance.current = term;

      // Connect to backend WebSocket for real shell execution
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'terminal_init', termId: 'term-main' }));
      };

      ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'terminal_output') {
            term.write(msg.data);
          }
        } catch {}
      };

      term.onData(data => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'terminal_input', termId: 'term-main', input: data }));
        }
      });

      const handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        ws.close();
        term.dispose();
        xtermInstance.current = null;
      };
    }
  }, [activeTab]);

  return (
    <div
      className={`border-t border-dcode-border bg-[#050505] flex flex-col transition-all ${
        isExpanded ? 'h-96' : 'h-60'
      }`}
    >
      {/* Panel Tab Header */}
      <div className="h-8 bg-dcode-bg border-b border-dcode-border flex items-center justify-between px-3 select-none text-xs">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition-colors ${
              activeTab === 'terminal'
                ? 'text-white bg-dcode-surface font-medium'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <TermIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab('checkpoints')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition-colors ${
              activeTab === 'checkpoints'
                ? 'text-white bg-dcode-surface font-medium'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
            <span>Checkpoints & Rollbacks</span>
            {checkpoints.length > 0 && (
              <span className="text-[10px] bg-blue-950 text-blue-400 px-1 rounded">
                {checkpoints.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('problems')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition-colors ${
              activeTab === 'problems'
                ? 'text-white bg-dcode-surface font-medium'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Problems (0)</span>
          </button>

          <button
            onClick={() => setActiveTab('output')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition-colors ${
              activeTab === 'output'
                ? 'text-white bg-dcode-surface font-medium'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Output & Logs</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 text-zinc-500">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:text-zinc-200 hover:bg-dcode-surface rounded"
            title={isExpanded ? 'Collapse' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'terminal' && (
          <div ref={terminalRef} className="w-full h-full p-2" />
        )}

        {activeTab === 'checkpoints' && (
          <div className="p-3 overflow-y-auto h-full space-y-2 text-xs">
            <div className="text-zinc-400 font-medium">Reversible Edit Snapshots</div>
            {checkpoints.length === 0 ? (
              <div className="text-zinc-600 italic">No checkpoints recorded yet. Changes by tools will generate restorable checkpoints here.</div>
            ) : (
              checkpoints.map(cp => (
                <div
                  key={cp.id}
                  className="flex items-center justify-between p-2 bg-dcode-surface border border-dcode-border rounded font-mono"
                >
                  <div className="space-y-0.5">
                    <div className="text-zinc-200 font-semibold">{cp.description}</div>
                    <div className="text-[10px] text-zinc-500">
                      ID: {cp.id} • {new Date(cp.timestamp).toLocaleTimeString()} • {cp.files.length} file(s)
                    </div>
                  </div>
                  <button
                    onClick={() => onRollbackCheckpoint(cp.id)}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-zinc-800 hover:bg-red-950 hover:text-red-400 hover:border-red-800 border border-zinc-700 text-zinc-300 rounded transition-colors text-xs font-sans"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Rollback</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="p-4 text-xs text-zinc-500 flex items-center justify-center h-full">
            No diagnostic problems detected in workspace.
          </div>
        )}

        {activeTab === 'output' && (
          <div className="p-3 font-mono text-xs text-zinc-400 space-y-1 h-full overflow-y-auto">
            <div>[Dcode System] Initialized agent runtime.</div>
            <div>[Dcode Security] Filesystem boundary locked to workspace.</div>
            <div>[Dcode Providers] OpenRouter connected. Local Ollama detector active.</div>
          </div>
        )}
      </div>
    </div>
  );
};
