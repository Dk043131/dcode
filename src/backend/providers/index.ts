import { AIProvider } from './base.js';
import { OpenRouterProvider } from './openrouter.js';
import { OllamaProvider } from './ollama.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { ModelInfo, ModelRouterConfig, ProviderConfig } from '../../shared/types.js';

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private routerConfig: ModelRouterConfig;

  constructor() {
    // 1. Initialize OpenRouter (First-class)
    const openRouter = new OpenRouterProvider({
      apiKey: process.env.OPENROUTER_API_KEY || '',
      selectedModelId: 'meta-llama/llama-3.3-70b-instruct:free',
    });
    this.providers.set(openRouter.getId(), openRouter);

    // 2. Initialize Ollama (Local)
    const ollama = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      selectedModelId: 'qwen2.5-coder:latest',
    });
    this.providers.set(ollama.getId(), ollama);

    // 3. Initialize OpenAI Standard Provider
    const openai = new OpenAICompatibleProvider({
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
      enabled: false,
      status: 'disconnected',
      models: [],
      selectedModelId: 'gpt-4o',
    });
    this.providers.set(openai.getId(), openai);

    // Default Router Configuration
    this.routerConfig = {
      strategy: 'BEST_AVAILABLE',
      primaryModel: { providerId: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct:free' },
      fallbackModel: { providerId: 'openrouter', modelId: 'deepseek/deepseek-r1:free' },
      fastModel: { providerId: 'openrouter', modelId: 'qwen/qwen-2.5-coder-32b-instruct:free' },
      reasoningModel: { providerId: 'openrouter', modelId: 'deepseek/deepseek-r1:free' },
      localFallback: { providerId: 'ollama', modelId: 'qwen2.5-coder:latest' },
      allowAutoPaidSwitch: false, // Never switch to paid without permission!
    };
  }

  public getProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  public getProvider(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  public addOrUpdateProvider(config: ProviderConfig): AIProvider {
    let provider: AIProvider;
    if (config.type === 'openrouter') {
      provider = new OpenRouterProvider(config);
    } else if (config.type === 'ollama') {
      provider = new OllamaProvider(config);
    } else {
      provider = new OpenAICompatibleProvider(config);
    }

    this.providers.set(provider.getId(), provider);
    return provider;
  }

  public removeProvider(id: string): boolean {
    if (id === 'openrouter') {
      // Don't remove core default, but can disable
      const p = this.providers.get(id);
      if (p) p.updateConfig({ enabled: false });
      return true;
    }
    return this.providers.delete(id);
  }

  public getRouterConfig(): ModelRouterConfig {
    return this.routerConfig;
  }

  public updateRouterConfig(partial: Partial<ModelRouterConfig>): void {
    this.routerConfig = { ...this.routerConfig, ...partial };
  }

  /**
   * Automatic routing and failover engine
   */
  public async resolveProviderAndModel(purpose: 'general' | 'fast' | 'reasoning' = 'general'): Promise<{
    provider: AIProvider;
    modelId: string;
    isFallback: boolean;
    failoverReason?: string;
  }> {
    let target = this.routerConfig.primaryModel;
    if (purpose === 'fast' && this.routerConfig.fastModel) {
      target = this.routerConfig.fastModel;
    } else if (purpose === 'reasoning' && this.routerConfig.reasoningModel) {
      target = this.routerConfig.reasoningModel;
    }

    // Try primary
    const primaryProvider = this.providers.get(target.providerId);
    if (primaryProvider && primaryProvider.getConfig().enabled) {
      const health = await primaryProvider.healthCheck();
      if (health.ok) {
        return { provider: primaryProvider, modelId: target.modelId, isFallback: false };
      }
    }

    // Failover: Try Fallback Model
    if (this.routerConfig.fallbackModel) {
      const fb = this.providers.get(this.routerConfig.fallbackModel.providerId);
      if (fb && fb.getConfig().enabled) {
        const health = await fb.healthCheck();
        if (health.ok) {
          return {
            provider: fb,
            modelId: this.routerConfig.fallbackModel.modelId,
            isFallback: true,
            failoverReason: `Primary provider ${target.providerId} unavailable. Falling back to ${fb.getName()}`,
          };
        }
      }
    }

    // Failover: Try Local Fallback (Ollama)
    if (this.routerConfig.localFallback) {
      const local = this.providers.get(this.routerConfig.localFallback.providerId);
      if (local) {
        const health = await local.healthCheck();
        if (health.ok) {
          return {
            provider: local,
            modelId: this.routerConfig.localFallback.modelId,
            isFallback: true,
            failoverReason: 'Cloud providers unavailable. Switching to local Ollama fallback.',
          };
        }
      }
    }

    // Default to openrouter anyway if available
    const openrouter = this.providers.get('openrouter');
    if (openrouter) {
      return {
        provider: openrouter,
        modelId: target.modelId,
        isFallback: false,
      };
    }

    throw new Error('No functional AI providers configured or available.');
  }

  public async getAllModels(): Promise<ModelInfo[]> {
    const all: ModelInfo[] = [];
    for (const p of this.providers.values()) {
      if (p.getConfig().enabled) {
        try {
          const models = await p.listModels();
          all.push(...models);
        } catch (e) {
          console.warn(`Could not list models for ${p.getName()}:`, e);
        }
      }
    }
    return all;
  }
}
