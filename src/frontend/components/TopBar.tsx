import React, { useState } from 'react';
import {
  Code2,
  FolderGit2,
  Play,
  Square,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AgentMode, ModelInfo, ProviderConfig } from '../shared/types';

interface TopBarProps {
  workspaceName: string;
  currentBranch: string;
  agentMode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  isRunning: boolean;
  onToggleRun: () => void;
  selectedModel: string;
  onOpenModelSelector: () => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  activeStatusText: string;
  providerStatus: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  workspaceName,
  currentBranch,
  agentMode,
  onModeChange,
  isRunning,
  onToggleRun,
  selectedModel,
  onOpenModelSelector,
  onOpenCommandPalette,
  onOpenSettings,
  activeStatusText,
  providerStatus,
}) => {
  const modes: AgentMode[] = ['ASK', 'PLAN', 'CODE', 'AUTONOMOUS', 'REVIEW'];

  return (
    <header className="h-11 bg-dcode-bg border-b border-dcode-border flex items-center justify-between px-3 select-none text-xs">
      {/* Left: Brand & Workspace */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 font-bold tracking-wider text-sm text-white">
          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-white shadow-sm font-mono text-xs">
            D
          </div>
          <span className="tracking-widest font-mono">DCODE</span>
        </div>

        <div className="h-4 w-px bg-dcode-border" />

        <div className="flex items-center space-x-1.5 text-dcode-textSecondary hover:text-dcode-text cursor-pointer">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-medium text-dcode-text">{workspaceName}</span>
        </div>

        <div className="flex items-center space-x-1 text-dcode-textMuted bg-dcode-surface px-2 py-0.5 rounded border border-dcode-border">
          <FolderGit2 className="w-3 h-3 text-zinc-400" />
          <span>{currentBranch || 'main'}</span>
        </div>
      </div>

      {/* Center: Search & Command Palette Bar */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center justify-between w-80 px-2.5 py-1 bg-dcode-surface hover:bg-dcode-surface2 border border-dcode-border rounded text-dcode-textMuted hover:text-dcode-textSecondary transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search files, commands, symbols...</span>
          </div>
          <kbd className="text-[10px] bg-dcode-surface2 px-1.5 py-0.5 rounded border border-dcode-border text-dcode-textMuted">
            ⌘K
          </kbd>
        </button>

        {activeStatusText && (
          <div className="hidden lg:flex items-center space-x-1.5 px-2 py-0.5 bg-blue-950/40 border border-blue-900/50 rounded text-blue-300 text-[11px] animate-pulse">
            <Sparkles className="w-3 h-3" />
            <span className="truncate max-w-[200px]">{activeStatusText}</span>
          </div>
        )}
      </div>

      {/* Right: Mode Selector, Model Selector, Run/Stop, Settings */}
      <div className="flex items-center space-x-2">
        {/* Mode Selector */}
        <div className="flex bg-dcode-surface p-0.5 rounded border border-dcode-border">
          {modes.map(mode => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                agentMode === mode
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-dcode-textMuted hover:text-dcode-text'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Model Picker trigger */}
        <button
          onClick={onOpenModelSelector}
          className="flex items-center space-x-1.5 bg-dcode-surface hover:bg-dcode-surface2 border border-dcode-border px-2 py-1 rounded text-dcode-textSecondary hover:text-dcode-text"
        >
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-mono truncate max-w-[130px]">{selectedModel}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Provider status: Ready" />
        </button>

        {/* Run / Stop Button */}
        <button
          onClick={onToggleRun}
          className={`flex items-center space-x-1 px-3 py-1 rounded font-medium transition-colors ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isRunning ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>Run Agent</span>
            </>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="p-1.5 text-dcode-textSecondary hover:text-dcode-text hover:bg-dcode-surface rounded border border-transparent hover:border-dcode-border"
          title="Dcode Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
