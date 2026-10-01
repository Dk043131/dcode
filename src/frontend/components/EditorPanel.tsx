import React from 'react';
import Editor from '@monaco-editor/react';
import { X, Save, FileCode } from 'lucide-react';

interface Tab {
  path: string;
  name: string;
  content: string;
  isDirty?: boolean;
}

interface EditorPanelProps {
  openTabs: Tab[];
  activeTabPath?: string;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onChangeContent: (path: string, newContent: string) => void;
  onSaveFile: (path: string) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  openTabs,
  activeTabPath,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onSaveFile,
}) => {
  const activeTab = openTabs.find(t => t.path === activeTabPath);

  const getLanguage = (fileName?: string) => {
    if (!fileName) return 'typescript';
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'typescript';
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.html')) return 'html';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.py')) return 'python';
    if (fileName.endsWith('.rs')) return 'rust';
    if (fileName.endsWith('.go')) return 'go';
    if (fileName.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] overflow-hidden">
      {/* Editor Tabs Bar */}
      <div className="h-9 bg-dcode-bg border-b border-dcode-border flex items-center overflow-x-auto select-none">
        {openTabs.map(tab => {
          const isActive = tab.path === activeTabPath;
          return (
            <div
              key={tab.path}
              onClick={() => onSelectTab(tab.path)}
              className={`h-full flex items-center space-x-2 px-3 text-xs border-r border-dcode-border cursor-pointer transition-colors ${
                isActive
                  ? 'bg-dcode-surface text-dcode-text border-t-2 border-t-blue-500'
                  : 'bg-dcode-bg text-dcode-textMuted hover:bg-dcode-surface hover:text-dcode-textSecondary'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-mono">{tab.name}</span>
              {tab.isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Unsaved changes" />
              )}
              <button
                onClick={e => {
                  e.stopPropagation();
                  onCloseTab(tab.path);
                }}
                className="hover:bg-dcode-surface2 p-0.5 rounded text-zinc-500 hover:text-zinc-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {openTabs.length === 0 && (
          <div className="text-zinc-600 text-xs px-4 italic">No open editors</div>
        )}
      </div>

      {/* Monaco Code Editor Canvas */}
      <div className="flex-1 relative">
        {activeTab ? (
          <Editor
            height="100%"
            language={getLanguage(activeTab.name)}
            theme="vs-dark"
            value={activeTab.content}
            onChange={val => onChangeContent(activeTab.path, val || '')}
            options={{
              fontSize: 13,
              fontFamily: "'Fira Code', 'JetBrains Mono', Menlo, monospace",
              fontLigatures: true,
              minimap: { enabled: true, maxColumn: 80 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              renderLineHighlight: 'all',
              bracketPairColorization: { enabled: true },
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2 select-none">
            <div className="w-10 h-10 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 font-mono text-lg">
              D
            </div>
            <div className="text-sm font-medium text-zinc-400">Dcode AI-Native IDE</div>
            <div className="text-xs text-zinc-600">Select a file from the explorer or ask the agent to write code.</div>
          </div>
        )}
      </div>
    </div>
  );
};
