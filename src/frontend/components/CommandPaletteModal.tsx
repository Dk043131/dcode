import React, { useState } from 'react';
import { Search, Command, Play, FileCode, Shield, RefreshCw } from 'lucide-react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (actionId: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const commands = [
    { id: 'run_tests', title: 'Dcode: Run Test Suite', category: 'Diagnostics', icon: Play },
    { id: 'run_linter', title: 'Dcode: Run Linter', category: 'Diagnostics', icon: Play },
    { id: 'run_typecheck', title: 'Dcode: Check TypeScript Types', category: 'Diagnostics', icon: Play },
    { id: 'mode_autonomous', title: 'Switch Agent Mode: Autonomous', category: 'Agent', icon: Command },
    { id: 'mode_code', title: 'Switch Agent Mode: Code', category: 'Agent', icon: Command },
    { id: 'mode_plan', title: 'Switch Agent Mode: Plan', category: 'Agent', icon: Command },
    { id: 'mode_review', title: 'Switch Agent Mode: Review', category: 'Agent', icon: Command },
    { id: 'refresh_files', title: 'Explorer: Refresh Workspace Files', category: 'Files', icon: RefreshCw },
    { id: 'security_status', title: 'Security: Inspect Active Boundaries', category: 'Security', icon: Shield },
  ];

  const filtered = commands.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-xs select-none">
      <div className="w-[580px] bg-dcode-surface border border-dcode-border rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input */}
        <div className="p-3 border-b border-dcode-border flex items-center space-x-2 bg-dcode-bg">
          <Search className="w-4 h-4 text-zinc-500" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none font-mono"
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
          {filtered.map(cmd => {
            const Icon = cmd.icon;
            return (
              <div
                key={cmd.id}
                onClick={() => {
                  onSelectAction(cmd.id);
                  onClose();
                }}
                className="flex items-center justify-between p-2 rounded hover:bg-dcode-surface2 cursor-pointer text-zinc-200 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className="w-3.5 h-3.5 text-blue-400" />
                  <span>{cmd.title}</span>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase font-mono">{cmd.category}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
