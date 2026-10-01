import React, { useState } from 'react';
import { X, Server, Key, Plus, CheckCircle, XCircle } from 'lucide-react';
import { ProviderConfig } from '../shared/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: ProviderConfig[];
  onUpdateProvider: (provider: ProviderConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  providers,
  onUpdateProvider,
}) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'security'>('providers');
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-[720px] bg-dcode-surface border border-dcode-border rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-12 px-4 border-b border-dcode-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm text-zinc-100">Dcode Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-dcode-surface2 rounded text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-dcode-border bg-dcode-bg px-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('providers')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'providers'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            AI Providers & Keys
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Security & Workspace Boundaries
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {activeTab === 'providers' && (
            <div className="space-y-4">
              <div className="text-zinc-400">
                Configure your OpenRouter API key, connect local Ollama, or add custom OpenAI-compatible backends.
              </div>

              <div className="space-y-3">
                {providers.map(p => (
                  <div
                    key={p.id}
                    className="p-3 bg-dcode-bg border border-dcode-border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-100">{p.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                          {p.type}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[11px] text-zinc-400">Enabled:</span>
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={e => onUpdateProvider({ ...p, enabled: e.target.checked })}
                          className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                        />
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-2 pt-1">
                      {p.type !== 'ollama' && (
                        <div>
                          <label className="text-zinc-500 block mb-1">API Key</label>
                          <input
                            type="password"
                            placeholder="Enter API key..."
                            value={p.apiKey || ''}
                            onChange={e => onUpdateProvider({ ...p, apiKey: e.target.value })}
                            className="w-full bg-dcode-surface border border-dcode-border rounded px-2.5 py-1 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-zinc-500 block mb-1">Base URL</label>
                        <input
                          type="text"
                          value={p.baseUrl || ''}
                          onChange={e => onUpdateProvider({ ...p, baseUrl: e.target.value })}
                          className="w-full bg-dcode-surface border border-dcode-border rounded px-2.5 py-1 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-3">
              <div className="text-zinc-300 font-semibold">Workspace Boundary Isolation</div>
              <p className="text-zinc-500 leading-relaxed">
                By default, Dcode prevents tool operations outside the current workspace directory.
                Sensitive files (.env, SSH keys, cloud tokens) are automatically redacted before sending prompt payloads to external providers.
              </p>
              <div className="p-3 bg-dcode-bg border border-dcode-border rounded text-zinc-400 space-y-1">
                <div className="font-semibold text-zinc-200">Protected Sensitive Patterns:</div>
                <div className="font-mono text-[11px] text-zinc-500">
                  .env*, id_rsa, id_ed25519, *.pem, *.key, credentials.json, .aws/credentials
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
