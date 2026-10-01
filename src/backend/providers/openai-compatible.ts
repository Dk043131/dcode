import { AIProvider, ChatMessage, ChatResponse, StreamCallbacks } from './base.js';
import { ModelInfo, ProviderConfig } from '../../shared/types.js';

export class OpenAICompatibleProvider extends AIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
    });
  }

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    if (!this.config.apiKey && this.config.type !== 'custom_openai') {
      return { ok: false, message: 'API key is required.' };
    }
    try {
      const res = await fetch(`${this.config.baseUrl}/models`, {
        headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
      });
      if (res.ok) {
        return { ok: true, message: `Connected to ${this.config.name}` };
      }
      return { ok: false, message: `Status ${res.status}: ${res.statusText}` };
    } catch (e: any) {
      return { ok: false, message: `Cannot connect to ${this.config.baseUrl}: ${e.message}` };
    }
  }

  public async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.config.baseUrl}/models`, {
        headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = (await res.json()) as any;
      const list = data.data || [];

      return list.map((m: any) => ({
        id: m.id,
        name: m.id,
        providerId: this.config.id,
        contextWindow: 128000,
        isFree: false,
        capabilities: {
          toolCalling: true,
          streaming: true,
          vision: true,
          structuredOutput: true,
          largeContext: true,
          reasoning: m.id.includes('o1') || m.id.includes('o3'),
          embeddings: true,
        },
        tags: ['paid', 'coding', 'tool_calling'],
        description: `Model: ${m.id}`,
      }));
    } catch {
      // Fallback predefined
      if (this.config.type === 'openai') {
        return [
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            providerId: this.config.id,
            contextWindow: 128000,
            capabilities: {
              toolCalling: true,
              streaming: true,
              vision: true,
              structuredOutput: true,
              largeContext: true,
              reasoning: false,
              embeddings: false,
            },
            tags: ['paid', 'coding', 'fast', 'tool_calling'],
          },
          {
            id: 'gpt-4o-mini',
            name: 'GPT-4o Mini',
            providerId: this.config.id,
            contextWindow: 128000,
            capabilities: {
              toolCalling: true,
              streaming: true,
              vision: true,
              structuredOutput: true,
              largeContext: true,
              reasoning: false,
              embeddings: false,
            },
            tags: ['paid', 'coding', 'fast', 'tool_calling'],
          },
          {
            id: 'o3-mini',
            name: 'o3-mini',
            providerId: this.config.id,
            contextWindow: 200000,
            capabilities: {
              toolCalling: true,
              streaming: true,
              vision: false,
              structuredOutput: true,
              largeContext: true,
              reasoning: true,
              embeddings: false,
            },
            tags: ['paid', 'reasoning', 'coding', 'tool_calling'],
          },
        ];
      }
      return [
        {
          id: this.config.selectedModelId || 'custom-model',
          name: this.config.selectedModelId || 'Custom Model',
          providerId: this.config.id,
          contextWindow: 65536,
          capabilities: {
            toolCalling: true,
            streaming: true,
            vision: false,
            structuredOutput: true,
            largeContext: true,
            reasoning: false,
            embeddings: false,
          },
          tags: ['coding', 'tool_calling'],
        },
      ];
    }
  }

  public async chat(
    messages: ChatMessage[],
    options?: { modelId?: string; tools?: any[]; temperature?: number; maxTokens?: number }
  ): Promise<ChatResponse> {
    const model = options?.modelId || this.config.selectedModelId || 'gpt-4o';
    const body: any = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096,
    };
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`${this.config.name} error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    const msg = data.choices?.[0]?.message || {};
    const toolCalls = msg.tool_calls?.map((tc: any) => {
      let args = {};
      try {
        args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      } catch {
        args = { raw: tc.function.arguments };
      }
      return {
        id: tc.id || Math.random().toString(36).substring(2, 9),
        name: tc.function.name,
        arguments: args,
      };
    });

    return {
      content: msg.content || '',
      toolCalls,
      model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      } : undefined,
    };
  }

  public async stream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: { modelId?: string; tools?: any[]; temperature?: number }
  ): Promise<void> {
    const model = options?.modelId || this.config.selectedModelId || 'gpt-4o';
    const body: any = {
      model,
      stream: true,
      messages,
      temperature: options?.temperature ?? 0.2,
    };
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`${this.config.name} stream error: ${await res.text()}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream body');

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
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              callbacks.onChunk(delta.content);
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
