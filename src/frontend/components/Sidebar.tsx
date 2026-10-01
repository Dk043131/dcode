import React, { useState } from 'react';
import {
  Files,
  Search,
  GitBranch,
  PlayCircle,
  ListTodo,
  History,
  BrainCircuit,
  Puzzle,
  Activity,
  Settings,
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  FolderOpen,
  RefreshCw,
  Plus,
  Shield,
} from 'lucide-react';
import { FileTreeNode, ProjectHealthStatus } from '../shared/types';

export type SidebarTab =
  | 'explorer'
  | 'search'
  | 'git'
  | 'debug'
  | 'tasks'
  | 'sessions'
  | 'memory'
  | 'health'
  | 'permissions';

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  files: FileTreeNode[];
  onFileSelect: (path: string) => void;
  selectedFilePath?: string;
  onRefreshFiles: () => void;
  health?: ProjectHealthStatus;
  memoryNotes?: string[];
  onAddMemoryNote?: (note: string) => void;
  rules?: any[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  files,
  onFileSelect,
  selectedFilePath,
  onRefreshFiles,
  health,
  memoryNotes = [],
  onAddMemoryNote,
  rules = [],
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'src': true,
    'src/backend': true,
    'src/frontend': true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [newNoteText, setNewNoteText] = useState('');

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderTree = (nodes: FileTreeNode[]) => {
    return (
      <div className="space-y-0.5 text-xs font-mono">
        {nodes.map(node => {
          const isExpanded = !!expandedFolders[node.path];
          const isSelected = selectedFilePath === node.path;

          if (node.isDirectory) {
            return (
              <div key={node.path}>
                <div
                  onClick={() => toggleFolder(node.path)}
                  className="flex items-center space-x-1.5 px-2 py-1 hover:bg-dcode-surface2 cursor-pointer text-dcode-textSecondary hover:text-dcode-text rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span className="truncate">{node.name}</span>
                </div>
                {isExpanded && node.children && (
                  <div className="pl-3.5 border-l border-dcode-border/40 ml-2.5">
                    {renderTree(node.children)}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={node.path}
              onClick={() => onFileSelect(node.path)}
              className={`flex items-center space-x-1.5 px-2 py-1 cursor-pointer rounded transition-colors ${
                isSelected
                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-dcode-surface2'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-zinc-500" />
              <span className="truncate">{node.name}</span>
              {node.isSensitive && (
                <span className="ml-auto text-[9px] px-1 bg-red-950/80 border border-red-800 text-red-300 rounded font-sans">
                  SECURE
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-dcode-surface border-r border-dcode-border select-none">
      {/* Activity Bar (Icon Strip) */}
      <div className="w-12 bg-dcode-bg border-r border-dcode-border flex flex-col items-center py-2 space-y-3">
        <button
          onClick={() => onTabChange('explorer')}
          className={`p-2 rounded hover:text-white transition-colors relative ${
            activeTab === 'explorer' ? 'text-white bg-dcode-surface' : 'text-zinc-500'
          }`}
          title="Explorer"
        >
          <Files className="w-5 h-5" />
          {activeTab === 'explorer' && (
            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-r" />
          )}
        </button>

        <button
          onClick={() => onTabChange('search')}
          className={`p-2 rounded hover:text-white transition-colors relative ${
            activeTab === 'search' ? 'text-white bg-dcode-surface' : 'text-zinc-500'
          }`}
          title="Search Codebase"
        >
          <Search className="w-5 h-5" />
          {activeTab === 'search' && (
            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-r" />
          )}
        </button>

        <button
          onClick={() => onTabChange('git')}
          className={`p-2 rounded hover:text-white transition-colors relative ${
            activeTab === 'git' ? 'text-white bg-dcode-surface' : 'text-zinc-500'
          }`}
          title="Source Control"
        >
          <GitBranch className="w-5 h-5" />
          {activeTab === 'git' && (
            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-r" />
          )}
        </button>

        <button
          onClick={() => onTabChange('tasks')}
          className={`p-2 rounded hover:text-white transition-colors relative ${
            activeTab === 'tasks' ? 'text-white bg-dcode-surface' : 'text-zinc-500'
          }`}
          title="Agent Tasks & Plans"
        >
          <ListTodo className="w-5 h-5" />
          {activeTab === 'tasks' && (
            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-r" />
          )}
        </button>

        <button
          onClick={() => onTabChange('memory')}
          className={`p-2 rounded hover:text-white transition-colors relative ${
            activeTab === 'memory' ? 'text-white bg-dcode-surface' : 'text-zinc-500'
          }`}
          title="Project Memory & Rules"
        >
          <BrainCircuit className="w-5 h-5" />
          {activeTab === 'memory' && (
            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-r" />
          )}
        </button>

        <button
          onClick={() => onTabChange('permissions')}
          className={`p-2 rounded hover:text-white transition-colors relative ${
            activeTab === 'permissions' ? 'text-white bg-dcode-surface' : 'text-zinc-500'
          }`}
          title="Security & Permissions"
        >
          <Shield className="w-5 h-5" />
          {activeTab === 'permissions' && (
            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-r" />
          )}
        </button>

        <button
          onClick={() => onTabChange('health')}
          className={`p-2 rounded hover:text-white transition-colors relative ${
            activeTab === 'health' ? 'text-white bg-dcode-surface' : 'text-zinc-500'
          }`}
          title="Project Health Diagnostics"
        >
          <Activity className="w-5 h-5" />
          {activeTab === 'health' && (
            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-r" />
          )}
        </button>
      </div>

      {/* Primary Sidebar Content View */}
      <div className="w-64 flex flex-col bg-dcode-surface select-none">
        {/* Header */}
        <div className="h-9 px-3 border-b border-dcode-border flex items-center justify-between text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <span>{activeTab}</span>
          {activeTab === 'explorer' && (
            <button
              onClick={onRefreshFiles}
              className="p-1 hover:bg-dcode-surface2 rounded text-zinc-400 hover:text-zinc-100"
              title="Refresh Files"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Body based on Tab */}
        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === 'explorer' && (
            <div>
              <div className="text-[11px] font-bold text-zinc-500 uppercase px-2 mb-2">Workspace Files</div>
              {files.length === 0 ? (
                <div className="text-zinc-600 text-xs px-2 italic">Scanning codebase...</div>
              ) : (
                renderTree(files)
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Search in codebase..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-dcode-bg border border-dcode-border rounded px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div className="text-zinc-500 text-xs italic">
                Type query to perform fast ripgrep/grep search through symbols and files.
              </div>
            </div>
          )}

          {activeTab === 'git' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-zinc-400 font-medium">
                <span>Changes</span>
                <span className="bg-blue-950 text-blue-400 px-1.5 rounded text-[10px]">
                  {health?.dirtyFilesCount || 0} modified
                </span>
              </div>
              <div className="text-zinc-500 italic">Working tree clean or files tracked by Git.</div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="space-y-4 text-xs">
              <div>
                <div className="font-semibold text-zinc-300 mb-1">Persistent Project Memory</div>
                <p className="text-zinc-500 text-[11px] mb-2">
                  Key patterns and architecture notes preserved for the agent across sessions.
                </p>
                <div className="space-y-1.5">
                  {memoryNotes.map((note, idx) => (
                    <div key={idx} className="bg-dcode-bg border border-dcode-border p-2 rounded text-zinc-300">
                      {note}
                    </div>
                  ))}
                  {memoryNotes.length === 0 && (
                    <div className="text-zinc-600 italic">No custom memories yet.</div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-dcode-border">
                <input
                  type="text"
                  placeholder="Add memory note..."
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newNoteText.trim() && onAddMemoryNote) {
                      onAddMemoryNote(newNoteText.trim());
                      setNewNoteText('');
                    }
                  }}
                  className="w-full bg-dcode-bg border border-dcode-border rounded px-2 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-zinc-300">Active Security Rules</div>
              <p className="text-zinc-500 text-[11px]">
                Deterministic policy filters enforcing execution boundaries.
              </p>
              <div className="space-y-1.5">
                {rules.map(r => (
                  <div key={r.id} className="bg-dcode-bg border border-dcode-border p-2 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-blue-400 font-medium">{r.pattern}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                          r.decision === 'ALWAYS_ALLOW'
                            ? 'bg-emerald-950 text-emerald-400'
                            : r.decision === 'NEVER'
                            ? 'bg-red-950 text-red-400'
                            : 'bg-amber-950 text-amber-400'
                        }`}
                      >
                        {r.decision}
                      </span>
                    </div>
                    <div className="text-zinc-500 text-[11px]">{r.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-zinc-300">Project Diagnostics</div>
              <div className="bg-dcode-bg border border-dcode-border p-2.5 rounded space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Package Manager:</span>
                  <span className="font-mono text-zinc-200">{health?.packageManager || 'Not detected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Test Framework:</span>
                  <span className="font-mono text-zinc-200">{health?.testFramework || 'Auto-detect'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Linter:</span>
                  <span className="font-mono text-zinc-200">{health?.linter || 'Auto-detect'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Type Checker:</span>
                  <span className="font-mono text-zinc-200">{health?.typeChecker || 'Auto-detect'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Build Tool:</span>
                  <span className="font-mono text-zinc-200">{health?.buildTool || 'Auto-detect'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
