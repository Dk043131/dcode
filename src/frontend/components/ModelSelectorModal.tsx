import React, { useState } from 'react';
import {
  X,
  Search,
  Check,
  Zap,
  DollarSign,
  Cpu,
  Layers,
  Sparkles,
  Server,
  Code,
  ShieldAlert,
} from 'lucide-react';
import { ModelInfo, ProviderConfig } from '../shared/types';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelInfo[];
  selectedModelId: string;
  onSelectModel: (modelId: string, providerId: string) => void;
  providers: ProviderConfig[];
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  models,
  selectedModelId,
  onSelectModel,
  providers,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'FREE' | 'PAID' | 'CODING' | 'REASONING'>('ALL');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredModels = models.filter(m => {
    if (filter === 'FREE' && !m.isFree) return false;
    if (filter === 'PAID' && m.isFree) return false;
    if (filter === 'CODING' && !m.tags?.includes('coding')) return false;
    if (filter === 'REASONING' && !m.tags?.includes('reasoning')) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.id.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-[680px] bg-dcode-surface border border-dcode-border rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-12 px-4 border-b border-dcode-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm text-zinc-100">Select AI Model</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-dcode-surface2 rounded text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar & Search */}
        <div className="p-3 border-b border-dcode-border bg-dcode-bg space-y-2">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search models across OpenRouter, Ollama, and Custom providers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-dcode-surface border border-dcode-border rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="flex space-x-1.5 text-xs">
            {(['ALL', 'FREE', 'PAID', 'CODING', 'REASONING'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  filter === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-dcode-surface text-zinc-400 hover:text-zinc-200 border border-dcode-border'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Models list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredModels.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500 italic">
              No models found matching your query or filter.
            </div>
          ) : (
            filteredModels.map(m => {
              const isSelected = m.id === selectedModelId;
              return (
                <div
                  key={`${m.providerId}-${m.id}`}
                  onClick={() => {
                    onSelectModel(m.id, m.providerId);
                    onClose();
                  }}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-950/30 border-blue-600 text-white shadow-sm'
                      : 'bg-dcode-bg border-dcode-border hover:bg-dcode-surface hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-xs text-zinc-100">{m.name}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                        {m.providerId}
                      </span>
                      {m.isFree ? (
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                          FREE
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-800 px-1.5 py-0.2 rounded font-semibold">
                          PAID
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                  </div>

                  <div className="text-[11px] text-zinc-400 line-clamp-1 mb-2 font-sans">
                    {m.description || `ID: ${m.id}`}
                  </div>

                  <div className="flex items-center space-x-3 text-[10px] text-zinc-500 font-mono">
                    <span>Context: {Math.round((m.contextWindow || 32768) / 1024)}K</span>
                    {m.capabilities.toolCalling && (
                      <span className="text-blue-400 flex items-center space-x-0.5">
                        <Zap className="w-2.5 h-2.5" />
                        <span>Tool Calling</span>
                      </span>
                    )}
                    {m.capabilities.reasoning && (
                      <span className="text-purple-400 flex items-center space-x-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Reasoning</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
