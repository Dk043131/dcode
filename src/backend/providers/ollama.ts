import { AIProvider, ChatMessage, ChatResponse, StreamCallbacks } from './base.js';
import { ModelInfo, ProviderConfig } from '../../shared/types.js';

export class OllamaProvider extends AIProvider {
  private defaultBaseUrl = 'http://localhost:11434';

  constructor(config?: Partial<ProviderConfig>) {
    super({
      id: 'ollama',
      name: 'Ollama (Local)',
      type: 'ollama',
      baseUrl: config?.baseUrl || 'http://localhost:11434',
      apiKey: '',
      enabled: config?.enabled ?? true,
      status: 'disconnected',
      models: [],
      selectedModelId: config?.selectedModelId || 'qwen2.5-coder:latest',
    });
  }

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(`${this.config.baseUrl || this.defaultBaseUrl}/api/version`, {
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return { ok: true, message: `Ollama is running (v${data.version || 'unknown'})` };
      }
      return { ok: false, message: `Ollama replied with status ${res.status}` };
    } catch {
      return { ok: false, message: 'Ollama not detected on localhost:11434 (offline)' };
    }
  }

  public async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.config.baseUrl || this.defaultBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error('Ollama offline');
      const data = (await res.json()) as any;
      const models = data.models || [];

      return models.map((m: any) => ({
        id: m.name,
        name: `${m.name} (${Math.round((m.size || 0) / (1024 * 1024 * 1024))}GB)`,
        providerId: 'ollama',
        contextWindow: 32768,
        isFree: true,
        pricing: { promptPer1k: 0, completionPer1k: 0 },
        capabilities: {
          toolCalling: true,
          streaming: true,
          vision: false,
          structuredOutput: true,
          largeContext: false,
          reasoning: m.name.includes('deepseek-r1') || m.name.includes('r1'),
          embeddings: true,
        },
        tags: ['free', 'coding', 'fast', 'tool_calling'],
        description: `Local Ollama model: ${m.name}`,
      }));
    } catch {
      return [
        {
          id: 'qwen2.5-coder:latest',
          name: 'Qwen 2.5 Coder (Local)',
          providerId: 'ollama',
          contextWindow: 32768,
          isFree: true,
          capabilities: {
            toolCalling: true,
            streaming: true,
            vision: false,
            structuredOutput: true,
            largeContext: false,
            reasoning: false,
            embeddings: false,
          },
          tags: ['free', 'coding', 'tool_calling'],
          description: 'High performance local coding model via Ollama.',
        },
        {
          id: 'deepseek-r1:latest',
          name: 'DeepSeek R1 (Local)',
          providerId: 'ollama',
          contextWindow: 32768,
          isFree: true,
          capabilities: {
            toolCalling: true,
            streaming: true,
            vision: false,
            structuredOutput: true,
            largeContext: false,
            reasoning: true,
            embeddings: false,
          },
          tags: ['free', 'reasoning', 'coding'],
          description: 'Local reasoning intelligence via Ollama.',
        },
      ];
    }
  }

  public async chat(
    messages: ChatMessage[],
    options?: { modelId?: string; tools?: any[]; temperature?: number; maxTokens?: number }
  ): Promise<ChatResponse> {
    const model = options?.modelId || this.config.selectedModelId || 'qwen2.5-coder:latest';
    const body: any = {
      model,
      stream: false,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      options: {
        temperature: options?.temperature ?? 0.2,
      },
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const res = await fetch(`${this.config.baseUrl || this.defaultBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama chat error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    const msg = data.message || {};

    const toolCalls = msg.tool_calls?.map((tc: any) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: tc.function?.name,
      arguments: tc.function?.arguments || {},
    }));

    return {
      content: msg.content || '',
      toolCalls,
      model,
    };
  }

  public async stream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: { modelId?: string; tools?: any[]; temperature?: number }
  ): Promise<void> {
    const model = options?.modelId || this.config.selectedModelId || 'qwen2.5-coder:latest';
    const body: any = {
      model,
      stream: true,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      options: {
        temperature: options?.temperature ?? 0.2,
      },
    };

    try {
      const res = await fetch(`${this.config.baseUrl || this.defaultBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Ollama streaming error: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No body in Ollama response');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              fullContent += parsed.message.content;
              callbacks.onChunk(parsed.message.content);
            }
          } catch {}
        }
      }

      callbacks.onComplete({
        content: fullContent,
        model,
      });
    } catch (err: any) {
      callbacks.onError(err);
    }
  }
}
