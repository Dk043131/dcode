"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterProvider = void 0;
const base_js_1 = require("./base.js");
class OpenRouterProvider extends base_js_1.AIProvider {
    defaultBaseUrl = 'https://openrouter.ai/api/v1';
    constructor(config) {
        super({
            id: 'openrouter',
            name: 'OpenRouter',
            type: 'openrouter',
            baseUrl: config?.baseUrl || 'https://openrouter.ai/api/v1',
            apiKey: config?.apiKey || process.env.OPENROUTER_API_KEY || '',
            enabled: config?.enabled ?? true,
            status: 'disconnected',
            models: [],
            selectedModelId: config?.selectedModelId || 'meta-llama/llama-3.3-70b-instruct:free',
        });
    }
    async healthCheck() {
        if (!this.config.apiKey) {
            return { ok: false, message: 'OpenRouter API key is not configured.' };
        }
        try {
            const res = await fetch(`${this.config.baseUrl || this.defaultBaseUrl}/auth/key`, {
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                },
            });
            if (res.ok) {
                const data = (await res.json());
                return { ok: true, message: `Connected to OpenRouter (${data.data?.label || 'Active key'})` };
            }
            return { ok: false, message: `OpenRouter returned status ${res.status}` };
        }
        catch (e) {
            return { ok: false, message: `Connection failed: ${e.message}` };
        }
    }
    async listModels() {
        try {
            const headers = {};
            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }
            const res = await fetch(`${this.config.baseUrl || this.defaultBaseUrl}/models`, { headers });
            if (!res.ok) {
                throw new Error(`Failed to fetch models: ${res.statusText}`);
            }
            const data = (await res.json());
            const rawModels = data.data || [];
            return rawModels.map((m) => {
                const promptPrice = parseFloat(m.pricing?.prompt || '0');
                const isFree = promptPrice === 0 || m.id.endsWith(':free');
                const tags = [];
                if (isFree)
                    tags.push('free');
                else
                    tags.push('paid');
                if (m.id.toLowerCase().includes('coder') || m.id.toLowerCase().includes('code') || m.id.toLowerCase().includes('deepseek-coder') || m.id.toLowerCase().includes('qwen')) {
                    tags.push('coding');
                }
                if (m.id.toLowerCase().includes('r1') || m.id.toLowerCase().includes('o1') || m.id.toLowerCase().includes('reasoning') || m.id.toLowerCase().includes('thinking')) {
                    tags.push('reasoning');
                }
                if (m.context_length >= 64000) {
                    tags.push('large_context');
                }
                tags.push('tool_calling'); // OpenRouter handles tool calls via standard chat completions format
                return {
                    id: m.id,
                    name: m.name || m.id,
                    providerId: 'openrouter',
                    contextWindow: m.context_length || 32768,
                    isFree,
                    pricing: {
                        promptPer1k: promptPrice * 1000,
                        completionPer1k: parseFloat(m.pricing?.completion || '0') * 1000,
                    },
                    capabilities: {
                        toolCalling: true,
                        streaming: true,
                        vision: !!m.architecture?.modality?.includes('image'),
                        structuredOutput: true,
                        largeContext: (m.context_length || 0) >= 64000,
                        reasoning: tags.includes('reasoning'),
                        embeddings: false,
                    },
                    description: m.description || '',
                    tags,
                };
            });
        }
        catch (err) {
            console.warn('OpenRouter listModels error, returning popular defaults:', err.message);
            return this.getDefaultModels();
        }
    }
    getDefaultModels() {
        return [
            {
                id: 'meta-llama/llama-3.3-70b-instruct:free',
                name: 'Llama 3.3 70B Instruct (Free)',
                providerId: 'openrouter',
                contextWindow: 131072,
                isFree: true,
                capabilities: {
                    toolCalling: true,
                    streaming: true,
                    vision: false,
                    structuredOutput: true,
                    largeContext: true,
                    reasoning: false,
                    embeddings: false,
                },
                tags: ['free', 'coding', 'large_context', 'tool_calling'],
                description: 'Flagship open Meta Llama 3.3 70B model with full tool calling capability.',
            },
            {
                id: 'deepseek/deepseek-r1:free',
                name: 'DeepSeek R1 (Free)',
                providerId: 'openrouter',
                contextWindow: 65536,
                isFree: true,
                capabilities: {
                    toolCalling: true,
                    streaming: true,
                    vision: false,
                    structuredOutput: true,
                    largeContext: true,
                    reasoning: true,
                    embeddings: false,
                },
                tags: ['free', 'reasoning', 'coding', 'tool_calling'],
                description: 'High-performance reasoning and coding model from DeepSeek.',
            },
            {
                id: 'qwen/qwen-2.5-coder-32b-instruct:free',
                name: 'Qwen 2.5 Coder 32B Instruct (Free)',
                providerId: 'openrouter',
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
                description: 'Specialized code generation and software engineering assistant.',
            },
            {
                id: 'anthropic/claude-3.7-sonnet',
                name: 'Claude 3.7 Sonnet',
                providerId: 'openrouter',
                contextWindow: 200000,
                isFree: false,
                pricing: { promptPer1k: 0.003, completionPer1k: 0.015 },
                capabilities: {
                    toolCalling: true,
                    streaming: true,
                    vision: true,
                    structuredOutput: true,
                    largeContext: true,
                    reasoning: true,
                    embeddings: false,
                },
                tags: ['paid', 'coding', 'reasoning', 'large_context', 'tool_calling'],
                description: 'State-of-the-art hybrid reasoning & coding intelligence from Anthropic.',
            },
        ];
    }
    async chat(messages, options) {
        const model = options?.modelId || this.config.selectedModelId || 'meta-llama/llama-3.3-70b-instruct:free';
        const body = {
            model,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
                tool_calls: m.tool_calls,
                tool_call_id: m.tool_call_id,
            })),
            temperature: options?.temperature ?? 0.2,
            max_tokens: options?.maxTokens ?? 4096,
        };
        if (options?.tools && options.tools.length > 0) {
            body.tools = options.tools;
            body.tool_choice = 'auto';
        }
        const res = await fetch(`${this.config.baseUrl || this.defaultBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`,
                'HTTP-Referer': 'https://dcode.dev',
                'X-Title': 'Dcode AI Coding Environment',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenRouter error (${res.status}): ${errText}`);
        }
        const data = (await res.json());
        const choice = data.choices?.[0];
        const message = choice?.message || {};
        const toolCalls = message.tool_calls?.map((tc) => {
            let args = {};
            try {
                args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
            }
            catch {
                args = { raw: tc.function.arguments };
            }
            return {
                id: tc.id || Math.random().toString(36).substring(2, 9),
                name: tc.function.name,
                arguments: args,
            };
        });
        return {
            content: message.content || '',
            toolCalls,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalCost: data.usage.total_cost,
            } : undefined,
            model,
        };
    }
    async stream(messages, callbacks, options) {
        const model = options?.modelId || this.config.selectedModelId || 'meta-llama/llama-3.3-70b-instruct:free';
        const body = {
            model,
            stream: true,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
                tool_calls: m.tool_calls,
                tool_call_id: m.tool_call_id,
            })),
            temperature: options?.temperature ?? 0.2,
            max_tokens: options?.maxTokens ?? 4096,
        };
        if (options?.tools && options.tools.length > 0) {
            body.tools = options.tools;
            body.tool_choice = 'auto';
        }
        try {
            const res = await fetch(`${this.config.baseUrl || this.defaultBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.config.apiKey}`,
                    'HTTP-Referer': 'https://dcode.dev',
                    'X-Title': 'Dcode AI Coding Environment',
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`OpenRouter stream failed (${res.status}): ${errText}`);
            }
            const reader = res.body?.getReader();
            if (!reader)
                throw new Error('No readable stream available in response');
            const decoder = new TextDecoder();
            let fullContent = '';
            let accumulatedToolCalls = [];
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:'))
                        continue;
                    const dataStr = trimmed.replace(/^data:\s*/, '');
                    if (dataStr === '[DONE]')
                        break;
                    try {
                        const parsed = JSON.parse(dataStr);
                        const delta = parsed.choices?.[0]?.delta;
                        if (delta?.content) {
                            fullContent += delta.content;
                            callbacks.onChunk(delta.content);
                        }
                        if (delta?.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                const index = tc.index ?? 0;
                                if (!accumulatedToolCalls[index]) {
                                    accumulatedToolCalls[index] = {
                                        id: tc.id || '',
                                        name: tc.function?.name || '',
                                        argumentsStr: '',
                                    };
                                }
                                if (tc.id)
                                    accumulatedToolCalls[index].id = tc.id;
                                if (tc.function?.name)
                                    accumulatedToolCalls[index].name = tc.function.name;
                                if (tc.function?.arguments)
                                    accumulatedToolCalls[index].argumentsStr += tc.function.arguments;
                            }
                        }
                    }
                    catch {
                        // Ignore malformed chunks
                    }
                }
            }
            const finalToolCalls = accumulatedToolCalls.map(tc => {
                let args = {};
                try {
                    args = JSON.parse(tc.argumentsStr);
                }
                catch {
                    args = { raw: tc.argumentsStr };
                }
                return {
                    id: tc.id || Math.random().toString(36).substring(2, 9),
                    name: tc.name,
                    arguments: args,
                };
            });
            callbacks.onComplete({
                content: fullContent,
                toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
                model,
            });
        }
        catch (err) {
            callbacks.onError(err);
        }
    }
}
exports.OpenRouterProvider = OpenRouterProvider;
