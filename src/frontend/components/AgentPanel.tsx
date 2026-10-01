import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Check,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
} from 'lucide-react';
import {
  AgentMessage,
  AgentMode,
  AgentSession,
  PermissionRequest,
} from '../shared/types';
import { DcodeLoader } from './DcodeLoader';

interface AgentPanelProps {
  session?: AgentSession;
  messages: AgentMessage[];
  pendingPermissions: PermissionRequest[];
  onResolvePermission: (requestId: string, approved: boolean) => void;
  onSendPrompt: (prompt: string) => void;
  isRunning: boolean;
  onStop: () => void;
  activeExplanation?: string;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  session,
  messages,
  pendingPermissions,
  onResolvePermission,
  onSendPrompt,
  isRunning,
  onStop,
  activeExplanation,
  isOpen,
  onToggleOpen,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingPermissions, activeExplanation]);

  const toggleToolExpand = (id: string) => {
    setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputPrompt.trim() && !isRunning) {
        onSendPrompt(inputPrompt.trim());
        setInputPrompt('');
      }
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-dcode-surface border-l border-dcode-border select-none transition-all duration-200 overflow-hidden ${
        isOpen ? 'w-96 opacity-100' : 'w-0 opacity-0 border-l-0'
      }`}
    >
      {/* Header */}
      <div className="h-9 px-3 border-b border-dcode-border flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-zinc-200">AI Agent</span>
          <span className="text-[10px] bg-blue-950/80 text-blue-400 px-1.5 py-0.2 rounded font-mono">
            {session?.mode || 'CODE'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-[11px] text-zinc-500 font-mono">
            Iter: {session?.currentIteration || 0}/{session?.autonomyLimit || 8}
          </div>
          <button
            onClick={onToggleOpen}
            className="p-1 hover:bg-dcode-surface2 rounded text-zinc-400 hover:text-zinc-100"
            title="Hide Agent Panel"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">
        {messages.length === 0 && (
          <div className="text-center py-12 px-4 space-y-2">
            <div className="w-8 h-8 rounded-full bg-blue-950/60 border border-blue-800 flex items-center justify-center mx-auto text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="font-medium text-zinc-300">Dcode Autonomous Agent</div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Describe what you want to build, refactor, debug, or test. Dcode inspects files, plans work, runs tests, and applies verified edits.
            </p>
          </div>
        )}

        {messages.map(msg => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className="space-y-1.5">
              {/* Message Header */}
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span className="font-semibold uppercase tracking-wider text-zinc-400">
                  {isUser ? 'You' : `Agent (${msg.providerUsed || 'AI'})`}
                </span>
                {msg.tokens && (
                  <span>{msg.tokens.completionTokens} tokens</span>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`p-2.5 rounded border leading-relaxed select-text ${
                  isUser
                    ? 'bg-blue-950/20 border-blue-900/40 text-blue-100 font-sans'
                    : 'bg-dcode-bg border-dcode-border text-zinc-200 font-sans whitespace-pre-wrap'
                }`}
              >
                {msg.content}
              </div>

              {/* Tool Calls Accordion */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {msg.toolCalls.map((tc, idx) => {
                    const toolKey = `${msg.id}-${idx}`;
                    const isExpanded = !!expandedTools[toolKey];
                    const isSuccess = tc.status === 'success';
                    const isDenied = tc.status === 'denied';

                    return (
                      <div
                        key={idx}
                        className="bg-[#0e0e11] border border-dcode-border rounded overflow-hidden text-[11px]"
                      >
                        <div
                          onClick={() => toggleToolExpand(toolKey)}
                          className="flex items-center justify-between p-2 cursor-pointer hover:bg-dcode-surface2"
                        >
                          <div className="flex items-center space-x-1.5 font-mono truncate">
                            {isDenied ? (
                              <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                            ) : isSuccess ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            )}
                            <span className="text-zinc-200 font-medium">{tc.tool}</span>
                            <span className="text-zinc-500 truncate">
                              ({JSON.stringify(tc.params).slice(0, 30)}...)
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-zinc-500" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-zinc-500" />
                          )}
                        </div>

                        {/* Collapsed Tool Output / Diff */}
                        {isExpanded && (
                          <div className="p-2 border-t border-dcode-border bg-[#08080a] space-y-1 font-mono text-[10px]">
                            <div className="text-zinc-500 font-semibold">Parameters:</div>
                            <pre className="text-zinc-300 overflow-x-auto p-1 bg-black rounded max-h-28">
                              {JSON.stringify(tc.params, null, 2)}
                            </pre>
                            {tc.result && (
                              <>
                                <div className="text-zinc-500 font-semibold mt-1">Output:</div>
                                <pre className="text-zinc-400 overflow-x-auto p-1 bg-black rounded max-h-36">
                                  {JSON.stringify(tc.result.output || tc.result.error, null, 2)}
                                </pre>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Pending Permissions Modal / Card in chat */}
        {pendingPermissions.map(req => (
          <div
            key={req.id}
            className="p-3 bg-amber-950/30 border border-amber-800/80 rounded-lg space-y-2 text-xs animate-in fade-in"
          >
            <div className="flex items-center space-x-1.5 text-amber-400 font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>Permission Request</span>
            </div>
            <div className="text-zinc-200 font-medium">{req.title}</div>
            <div className="font-mono text-[11px] bg-black/60 p-1.5 rounded border border-amber-900/50 text-amber-200 break-all">
              {req.detail}
            </div>
            <div className="flex justify-end space-x-2 pt-1">
              <button
                onClick={() => onResolvePermission(req.id, false)}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-medium text-xs"
              >
                Deny
              </button>
              <button
                onClick={() => onResolvePermission(req.id, true)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-xs shadow-sm"
              >
                Approve Once
              </button>
            </div>
          </div>
        ))}

        {/* Live Action Explanation with Unique DcodeLoader Animation */}
        {isRunning && (
          <div className="p-2.5 bg-blue-950/20 border border-blue-900/40 rounded-lg">
            <DcodeLoader size="sm" text={activeExplanation || 'Loading...'} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-dcode-border bg-dcode-bg">
        <div className="relative border border-dcode-border rounded-lg bg-dcode-surface focus-within:border-blue-500 transition-colors">
          <textarea
            rows={3}
            placeholder="Instruct the agent (e.g. 'Refactor Auth middleware and run unit tests')..."
            value={inputPrompt}
            onChange={e => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none resize-none font-sans"
          />
          <div className="flex items-center justify-between px-2.5 pb-2 text-[10px] text-zinc-500">
            <span>Press Enter to run, Shift+Enter for newline</span>
            <button
              onClick={() => {
                if (inputPrompt.trim() && !isRunning) {
                  onSendPrompt(inputPrompt.trim());
                  setInputPrompt('');
                }
              }}
              disabled={isRunning || !inputPrompt.trim()}
              className="p-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
