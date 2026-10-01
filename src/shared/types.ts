// Types for Dcode: AI-Native Agentic Coding Environment

export type AgentMode = 'ASK' | 'PLAN' | 'CODE' | 'AUTONOMOUS' | 'REVIEW';

export type CommandSecurityCategory = 'SAFE' | 'CAUTION' | 'DANGEROUS' | 'BLOCKED';

export type PermissionDecision = 'ALWAYS_ALLOW' | 'ASK' | 'ALLOW_ONCE' | 'NEVER';

export type NetworkPermissionMode = 'OFF' | 'ASK' | 'ALLOWED';

export interface ProviderCapability {
  toolCalling: boolean;
  streaming: boolean;
  vision: boolean;
  structuredOutput: boolean;
  largeContext: boolean;
  reasoning: boolean;
  embeddings: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  contextWindow: number;
  isFree?: boolean;
  pricing?: {
    promptPer1k: number;
    completionPer1k: number;
  };
  capabilities: ProviderCapability;
  description?: string;
  tags?: ('free' | 'paid' | 'coding' | 'reasoning' | 'fast' | 'large_context' | 'tool_calling')[];
}

export type ProviderType = 'openrouter' | 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'custom_openai';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  errorMessage?: string;
  models: ModelInfo[];
  selectedModelId?: string;
}

export type RoutingStrategy = 'MANUAL' | 'FASTEST' | 'CHEAPEST' | 'BEST_AVAILABLE' | 'AUTOMATIC';

export interface ModelRouterConfig {
  strategy: RoutingStrategy;
  primaryModel: { providerId: string; modelId: string };
  fallbackModel?: { providerId: string; modelId: string };
  fastModel?: { providerId: string; modelId: string };
  reasoningModel?: { providerId: string; modelId: string };
  localFallback?: { providerId: string; modelId: string };
  allowAutoPaidSwitch: boolean;
}

export interface PermissionRule {
  id: string;
  targetType: 'tool' | 'command' | 'pattern' | 'directory' | 'network';
  pattern: string; // e.g., "npm test", "rm *", "tools:read_file"
  decision: PermissionDecision;
  createdAt: number;
  description?: string;
}

export interface PermissionRequest {
  id: string;
  timestamp: number;
  type: 'command' | 'tool' | 'file_write' | 'file_delete' | 'network';
  title: string;
  detail: string;
  securityCategory?: CommandSecurityCategory;
  params?: any;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  category: 'read' | 'write' | 'execute' | 'search' | 'git' | 'diagnostics';
  securityLevel: 'safe' | 'caution' | 'dangerous';
}

export interface ToolCallPayload {
  tool: string;
  params: Record<string, any>;
  callId?: string;
}

export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  output?: any;
  error?: string;
  executionTimeMs: number;
  diffSummary?: {
    path: string;
    additions: number;
    deletions: number;
    patch: string;
  };
}

export interface AgentPlanStep {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  tool?: string;
  summary?: string;
}

export interface AgentPlan {
  id: string;
  goal: string;
  steps: AgentPlanStep[];
  currentStepIndex: number;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  mode?: AgentMode;
  modelUsed?: string;
  providerUsed?: string;
  actionExplanation?: string; // "Inspecting authentication middleware"
  plan?: AgentPlan;
  toolCalls?: {
    tool: string;
    params: any;
    result?: ToolExecutionResult;
    status: 'calling' | 'success' | 'failed' | 'denied';
  }[];
  tokens?: {
    promptTokens: number;
    completionTokens: number;
    totalCost?: number;
  };
}

export interface AgentSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  mode: AgentMode;
  messages: AgentMessage[];
  plan?: AgentPlan;
  currentTask?: string;
  autonomyLimit: number;
  currentIteration: number;
  status: 'idle' | 'running' | 'paused' | 'waiting_permission' | 'error';
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  children?: FileTreeNode[];
  isSensitive?: boolean;
}

export interface CodeCheckpoint {
  id: string;
  timestamp: number;
  description: string;
  files: {
    path: string;
    beforeContent: string;
    afterContent: string;
  }[];
}

export interface ProjectHealthStatus {
  hasGit: boolean;
  packageManager?: string;
  testFramework?: string;
  linter?: string;
  typeChecker?: string;
  buildTool?: string;
  vulnerabilitiesDetected?: number;
  dirtyFilesCount?: number;
}
