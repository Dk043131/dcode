import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { EditorPanel } from './components/EditorPanel';
import { AgentPanel } from './components/AgentPanel';
import { BottomPanel } from './components/BottomPanel';
import { ModelSelectorModal } from './components/ModelSelectorModal';
import { SettingsModal } from './components/SettingsModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';

import {
  AgentMessage,
  AgentMode,
  AgentSession,
  CodeCheckpoint,
  FileTreeNode,
  ModelInfo,
  PermissionRequest,
  ProjectHealthStatus,
  ProviderConfig,
} from '../shared/types';

export default function App() {
  // App State
  const [workspaceName, setWorkspaceName] = useState('Dcode');
  const [currentBranch, setCurrentBranch] = useState('main');
  const [agentMode, setAgentMode] = useState<AgentMode>('CODE');
  const [isRunning, setIsRunning] = useState(false);
  const [activeStatusText, setActiveStatusText] = useState('');
  const [activeExplanation, setActiveExplanation] = useState('');

  // Sidebar & Files
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('explorer');
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [health, setHealth] = useState<ProjectHealthStatus | undefined>();
  const [memoryNotes, setMemoryNotes] = useState<string[]>([]);
  const [securityRules, setSecurityRules] = useState<any[]>([]);

  // Editor Tabs
  const [openTabs, setOpenTabs] = useState<
    { path: string; name: string; content: string; isDirty?: boolean }[]
  >([]);
  const [activeTabPath, setActiveTabPath] = useState<string | undefined>();

  // Checkpoints
  const [checkpoints, setCheckpoints] = useState<CodeCheckpoint[]>([]);

  // Slide Hiding & UX States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(true);
  const [plugins, setPlugins] = useState<any[]>([]);

  // Modals
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Providers & Models
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('meta-llama/llama-3.3-70b-instruct:free');

  // Agent Session
  const [currentSession, setCurrentSession] = useState<AgentSession | undefined>();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRequest[]>([]);

  // Initialize Data
  useEffect(() => {
    fetchWorkspace();
    fetchFiles();
    fetchProviders();
    fetchModels();
    fetchCheckpoints();
    fetchSecurityRules();
    fetchPlugins();
    createOrFetchSession();

    // Setup global Cmd+K shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Setup WebSocket for agent broadcasts
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = window.location.port === '5173' ? `${window.location.hostname}:3002` : window.location.host;
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${protocol}//${backendHost}/ws`);
    } catch {
      return;
    }

    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'message_update') {
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === msg.data.message.id);
            if (idx !== -1) {
              const copy = [...prev];
              copy[idx] = msg.data.message;
              return copy;
            }
            return [...prev, msg.data.message];
          });
          fetchFiles();
          fetchCheckpoints();
        } else if (msg.type === 'permission_request') {
          setPendingPermissions(prev => [...prev, msg.data]);
        } else if (msg.type === 'status_change') {
          setActiveStatusText(msg.data.message || '');
          if (msg.data.status === 'idle') setIsRunning(false);
          else if (msg.data.status === 'running') setIsRunning(true);
        } else if (msg.type === 'action_explanation') {
          setActiveExplanation(msg.data.explanation);
        }
      } catch {}
    };

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (ws) ws.close();
    };
  }, []);

  const fetchWorkspace = async () => {
    try {
      const res = await fetch('/api/workspace');
      const data = await res.json();
      setWorkspaceName(data.name || 'Dcode');
      setHealth(data.health);
    } catch {}
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      setFiles(data);
      // Auto open README.md if no tab is open yet
      if (data && data.length > 0) {
        const readme = data.find((f: any) => f.name.toLowerCase() === 'readme.md');
        if (readme && openTabs.length === 0) {
          handleFileSelect(readme.path);
        }
      }
    } catch {}
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      setProviders(data.providers || []);
    } catch {}
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      setModels(data);
    } catch {}
  };

  const fetchCheckpoints = async () => {
    try {
      const res = await fetch('/api/checkpoints');
      const data = await res.json();
      setCheckpoints(data);
    } catch {}
  };

  const fetchSecurityRules = async () => {
    try {
      const res = await fetch('/api/security/rules');
      const data = await res.json();
      setSecurityRules(data);
    } catch {}
  };

  const fetchPlugins = async () => {
    try {
      const res = await fetch('/api/plugins');
      const data = await res.json();
      setPlugins(data);
    } catch {}
  };

  const handleTogglePlugin = async (pluginId: string) => {
    try {
      const res = await fetch(`/api/plugins/${pluginId}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPlugins(prev =>
          prev.map(p => (p.id === pluginId ? { ...p, enabled: !p.enabled } : p))
        );
      }
    } catch {}
  };

  const createOrFetchSession = async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: agentMode, autonomyLimit: 8 }),
      });
      const data = await res.json();
      setCurrentSession(data);
    } catch {}
  };

  // File open & save handlers
  const handleFileSelect = async (filePath: string) => {
    const existing = openTabs.find(t => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }

    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      const newTab = {
        path: filePath,
        name: filePath.split('/').pop() || filePath,
        content: data.content || '',
      };
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabPath(filePath);
    } catch {}
  };

  const handleCloseTab = (filePath: string) => {
    setOpenTabs(prev => prev.filter(t => t.path !== filePath));
    if (activeTabPath === filePath) {
      const remaining = openTabs.filter(t => t.path !== filePath);
      setActiveTabPath(remaining.length > 0 ? remaining[0].path : undefined);
    }
  };

  const handleChangeContent = (filePath: string, content: string) => {
    setOpenTabs(prev =>
      prev.map(t => (t.path === filePath ? { ...t, content, isDirty: true } : t))
    );
  };

  const handleSaveFile = async (filePath: string) => {
    const tab = openTabs.find(t => t.path === filePath);
    if (!tab) return;
    try {
      await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: tab.content }),
      });
      setOpenTabs(prev =>
        prev.map(t => (t.path === filePath ? { ...t, isDirty: false } : t))
      );
      fetchCheckpoints();
    } catch {}
  };

  // Agent Prompts & Controls
  const handleSendPrompt = async (prompt: string) => {
    if (!currentSession) return;
    setIsRunning(true);
    setActiveStatusText('Agent analyzing task...');
    try {
      await fetch(`/api/sessions/${currentSession.id}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
    } catch (e: any) {
      setIsRunning(false);
      setActiveStatusText(`Failed: ${e.message}`);
    }
  };

  const handleResolvePermission = async (requestId: string, approved: boolean) => {
    try {
      await fetch(`/api/permissions/${requestId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
      setPendingPermissions(prev => prev.filter(r => r.id !== requestId));
    } catch {}
  };

  const handleToggleRun = async () => {
    if (isRunning && currentSession) {
      await fetch(`/api/sessions/${currentSession.id}/stop`, { method: 'POST' });
      setIsRunning(false);
      setActiveStatusText('Stopped by user');
    }
  };

  const handleRollbackCheckpoint = async (id: string) => {
    try {
      const res = await fetch(`/api/checkpoints/${id}/rollback`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchFiles();
        fetchCheckpoints();
        // Reload currently active open tab
        if (activeTabPath) handleFileSelect(activeTabPath);
      }
    } catch {}
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050505] text-[#F5F5F5] overflow-hidden select-none font-sans">
      {/* Top IDE Bar */}
      <TopBar
        workspaceName={workspaceName}
        currentBranch={currentBranch}
        agentMode={agentMode}
        onModeChange={mode => {
          setAgentMode(mode);
          if (currentSession) currentSession.mode = mode;
        }}
        isRunning={isRunning}
        onToggleRun={handleToggleRun}
        selectedModel={selectedModelId.split('/').pop() || selectedModelId}
        onOpenModelSelector={() => setIsModelSelectorOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeStatusText={activeStatusText}
        providerStatus="ready"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        isAgentPanelOpen={isAgentPanelOpen}
        onToggleAgentPanel={() => setIsAgentPanelOpen(prev => !prev)}
      />

      {/* Main Center Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          files={files}
          onFileSelect={handleFileSelect}
          selectedFilePath={activeTabPath}
          onRefreshFiles={fetchFiles}
          health={health}
          memoryNotes={memoryNotes}
          onAddMemoryNote={note => setMemoryNotes(prev => [...prev, note])}
          rules={securityRules}
          plugins={plugins}
          onTogglePlugin={handleTogglePlugin}
          isOpen={isSidebarOpen}
          onToggleOpen={() => setIsSidebarOpen(prev => !prev)}
        />

        {/* Center Editor & Bottom Panels */}
        <div className="flex-1 flex flex-col min-w-0">
          <EditorPanel
            openTabs={openTabs}
            activeTabPath={activeTabPath}
            onSelectTab={setActiveTabPath}
            onCloseTab={handleCloseTab}
            onChangeContent={handleChangeContent}
            onSaveFile={handleSaveFile}
          />
          <BottomPanel
            checkpoints={checkpoints}
            onRollbackCheckpoint={handleRollbackCheckpoint}
          />
        </div>

        {/* Right Autonomous Agent Panel */}
        <AgentPanel
          session={currentSession}
          messages={messages}
          pendingPermissions={pendingPermissions}
          onResolvePermission={handleResolvePermission}
          onSendPrompt={handleSendPrompt}
          isRunning={isRunning}
          onStop={handleToggleRun}
          activeExplanation={activeExplanation}
          isOpen={isAgentPanelOpen}
          onToggleOpen={() => setIsAgentPanelOpen(prev => !prev)}
        />
      </div>

      {/* Modals */}
      <ModelSelectorModal
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        models={models}
        selectedModelId={selectedModelId}
        onSelectModel={(modelId, providerId) => {
          setSelectedModelId(modelId);
          fetch('/api/router', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ primaryModel: { providerId, modelId } }),
          });
        }}
        providers={providers}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        providers={providers}
        onUpdateProvider={async p => {
          await fetch('/api/providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          });
          fetchProviders();
          fetchModels();
        }}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectAction={actionId => {
          if (actionId.startsWith('mode_')) {
            const m = actionId.replace('mode_', '').toUpperCase() as AgentMode;
            setAgentMode(m);
          } else if (actionId === 'refresh_files') {
            fetchFiles();
          } else if (actionId === 'run_tests') {
            handleSendPrompt('Run project test suite and verify diagnostics');
          }
        }}
      />
    </div>
  );
}
