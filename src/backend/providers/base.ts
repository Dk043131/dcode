import { ModelInfo, ProviderCapability, ProviderConfig } from '../../shared/types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface ChatResponse {
  content: string;
  toolCalls?: {
    id: string;
    name: string;
    arguments: Record<string, any>;
  }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalCost?: number;
  };
  model: string;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onToolCall?: (toolCall: { id: string; name: string; arguments: any }) => void;
  onComplete: (fullResponse: ChatResponse) => void;
  onError: (err: Error) => void;
}

export abstract class AIProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  public getId(): string {
    return this.config.id;
  }

  public getName(): string {
    return this.config.name;
  }

  public getType(): string {
    return this.config.type;
  }

  public getConfig(): ProviderConfig {
    return this.config;
  }

  public updateConfig(newConfig: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public abstract healthCheck(): Promise<{ ok: boolean; message: string }>;

  public abstract listModels(): Promise<ModelInfo[]>;

  public abstract chat(
    messages: ChatMessage[],
    options?: {
      modelId?: string;
      tools?: any[];
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<ChatResponse>;

  public abstract stream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: {
      modelId?: string;
      tools?: any[];
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<void>;
}
