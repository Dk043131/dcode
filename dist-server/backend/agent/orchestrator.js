"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
class AgentOrchestrator {
    providerManager;
    toolRegistry;
    security;
    contextEngine;
    sessions = new Map();
    pendingPermissions = new Map();
    abortControllers = new Map();
    constructor(providerManager, toolRegistry, security, contextEngine) {
        this.providerManager = providerManager;
        this.toolRegistry = toolRegistry;
        this.security = security;
        this.contextEngine = contextEngine;
    }
    createSession(mode = 'CODE', autonomyLimit = 8) {
        const id = Math.random().toString(36).substring(2, 9);
        const session = {
            id,
            title: `Task #${id.slice(0, 4)}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            mode,
            messages: [],
            autonomyLimit,
            currentIteration: 0,
            status: 'idle',
        };
        this.sessions.set(id, session);
        return session;
    }
    getSession(id) {
        return this.sessions.get(id);
    }
    getSessions() {
        return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }
    resolvePermission(requestId, approved) {
        const pending = this.pendingPermissions.get(requestId);
        if (!pending)
            return false;
        pending.request.status = approved ? 'approved' : 'rejected';
        pending.resolve(approved);
        this.pendingPermissions.delete(requestId);
        return true;
    }
    stopSession(sessionId) {
        const controller = this.abortControllers.get(sessionId);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(sessionId);
        }
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = 'idle';
        }
    }
    /**
     * Main Autonomous Multi-Step Agent Loop
     */
    async runTask(sessionId, userPrompt, callbacks) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error(`Session ${sessionId} not found`);
        const abortController = new AbortController();
        this.abortControllers.set(sessionId, abortController);
        // 1. Append User Message
        const userMsg = {
            id: Math.random().toString(36).substring(2, 9),
            role: 'user',
            content: userPrompt,
            timestamp: Date.now(),
            mode: session.mode,
        };
        session.messages.push(userMsg);
        session.status = 'running';
        session.currentTask = userPrompt;
        session.updatedAt = Date.now();
        callbacks.onMessageUpdate(session, userMsg);
        callbacks.onStatusChange('running', 'Analyzing workspace and planning task...');
        // 2. Gather Context
        callbacks.onActionExplanation('Gathering codebase context and rules...');
        await this.contextEngine.indexCodebase();
        const contextSnippet = this.contextEngine.getContextOverview(userPrompt);
        // Filter tools based on Agent Mode
        const allTools = this.toolRegistry.getToolDefinitions();
        let permittedTools = allTools;
        if (session.mode === 'ASK' || session.mode === 'REVIEW') {
            // Strictly read-only tools
            permittedTools = allTools.filter(t => t.category === 'read' || t.category === 'search');
        }
        else if (session.mode === 'PLAN') {
            // Inspection tools only, no file edits unless approved
            permittedTools = allTools.filter(t => t.category === 'read' || t.category === 'search');
        }
        const toolSchemas = permittedTools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));
        // Formulate System Prompt
        const systemPrompt = `You are Dcode Agent, an autonomous software architect and developer operating directly in the workspace.
Mode: ${session.mode}
Security Boundaries: Do not attempt to access or modify files outside the workspace.
Context & Rules:
${contextSnippet}

Workflow Instructions:
1. Always analyze before modifying. Check file structure, contents, or run tests to understand current state.
2. Provide concise action explanations of what you are doing (e.g. "Inspecting authentication middleware", "Running unit tests"). Never display hidden chain of thought.
3. Call the relevant tools to make changes or run tests. Verify edits with tests/linting.
4. When finished, summarize your changes and state that the task is complete.`;
        let loopCount = 0;
        const maxIterations = session.mode === 'AUTONOMOUS' ? session.autonomyLimit : 4;
        const chatHistory = [
            { role: 'system', content: systemPrompt },
            ...session.messages.slice(-8).map(m => ({
                role: m.role,
                content: m.content || '',
            })),
        ];
        while (loopCount < maxIterations) {
            if (abortController.signal.aborted) {
                callbacks.onStatusChange('idle', 'Task cancelled by user.');
                break;
            }
            loopCount++;
            session.currentIteration = loopCount;
            // 3. Resolve Provider & Model via Model Router
            const { provider, modelId, isFallback, failoverReason } = await this.providerManager.resolveProviderAndModel();
            if (isFallback && failoverReason) {
                callbacks.onActionExplanation(`Notice: ${failoverReason}`);
            }
            // Assistant Response placeholder
            const assistantMsg = {
                id: Math.random().toString(36).substring(2, 9),
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                mode: session.mode,
                modelUsed: modelId,
                providerUsed: provider.getName(),
                toolCalls: [],
            };
            session.messages.push(assistantMsg);
            let response;
            try {
                callbacks.onStatusChange('running', `Reasoning with ${modelId} (${provider.getName()})...`);
                response = await provider.chat(chatHistory, {
                    modelId,
                    tools: toolSchemas,
                });
            }
            catch (chatErr) {
                // Handle provider error and check for failover
                assistantMsg.content = `Error communicating with ${provider.getName()}: ${chatErr.message}`;
                callbacks.onMessageUpdate(session, assistantMsg);
                callbacks.onStatusChange('error', chatErr.message);
                break;
            }
            assistantMsg.content = response.content;
            if (response.usage) {
                assistantMsg.tokens = response.usage;
            }
            // If no tool calls, assistant has finished its reasoning or response
            if (!response.toolCalls || response.toolCalls.length === 0) {
                callbacks.onMessageUpdate(session, assistantMsg);
                callbacks.onStatusChange('idle', 'Task completed.');
                break;
            }
            // 4. Process Tool Calls
            chatHistory.push({
                role: 'assistant',
                content: response.content || '',
                tool_calls: response.toolCalls.map(tc => ({
                    id: tc.id,
                    type: 'function',
                    function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
                })),
            });
            for (const tc of response.toolCalls) {
                if (abortController.signal.aborted)
                    break;
                const actionDescription = this.getActionExplanation(tc.name, tc.arguments);
                assistantMsg.actionExplanation = actionDescription;
                callbacks.onActionExplanation(actionDescription);
                // Permission verification
                const toolActionType = tc.name === 'run_command'
                    ? 'command'
                    : tc.name === 'write_file' || tc.name === 'edit_file'
                        ? 'file_write'
                        : tc.name === 'delete_file'
                            ? 'file_delete'
                            : 'tool';
                const targetArg = tc.arguments.command || tc.arguments.path || tc.name;
                const permCheck = this.security.checkPermission(toolActionType, targetArg);
                if (permCheck.decision === 'NEVER') {
                    assistantMsg.toolCalls?.push({
                        tool: tc.name,
                        params: tc.arguments,
                        status: 'denied',
                        result: {
                            tool: tc.name,
                            success: false,
                            error: `Security violation: Operation blocked by policy (${permCheck.reason})`,
                            executionTimeMs: 0,
                        },
                    });
                    chatHistory.push({
                        role: 'tool',
                        name: tc.name,
                        tool_call_id: tc.id,
                        content: JSON.stringify({ error: `Permission denied: ${permCheck.reason}` }),
                    });
                    continue;
                }
                if (permCheck.decision === 'ASK') {
                    session.status = 'waiting_permission';
                    callbacks.onStatusChange('waiting_permission', `Approval required: ${tc.name} (${targetArg})`);
                    const reqId = Math.random().toString(36).substring(2, 9);
                    const permReq = {
                        id: reqId,
                        timestamp: Date.now(),
                        type: toolActionType,
                        title: `Approve ${tc.name}`,
                        detail: `${targetArg} — ${permCheck.reason}`,
                        securityCategory: permCheck.category,
                        params: tc.arguments,
                        status: 'pending',
                    };
                    const approved = await new Promise(resolve => {
                        this.pendingPermissions.set(reqId, { resolve, request: permReq });
                        callbacks.onPermissionRequired(permReq);
                    });
                    if (!approved) {
                        assistantMsg.toolCalls?.push({
                            tool: tc.name,
                            params: tc.arguments,
                            status: 'denied',
                            result: {
                                tool: tc.name,
                                success: false,
                                error: 'Operation rejected by user.',
                                executionTimeMs: 0,
                            },
                        });
                        chatHistory.push({
                            role: 'tool',
                            name: tc.name,
                            tool_call_id: tc.id,
                            content: JSON.stringify({ error: 'User rejected permission for this action.' }),
                        });
                        continue;
                    }
                    session.status = 'running';
                    callbacks.onStatusChange('running', `Executing approved action: ${tc.name}`);
                }
                // Execute Tool
                callbacks.onStatusChange('running', `Executing: ${tc.name}...`);
                const executionResult = await this.toolRegistry.executeTool(tc.name, tc.arguments);
                assistantMsg.toolCalls?.push({
                    tool: tc.name,
                    params: tc.arguments,
                    status: executionResult.success ? 'success' : 'failed',
                    result: executionResult,
                });
                chatHistory.push({
                    role: 'tool',
                    name: tc.name,
                    tool_call_id: tc.id,
                    content: JSON.stringify(executionResult.output || { error: executionResult.error }),
                });
            }
            callbacks.onMessageUpdate(session, assistantMsg);
            session.updatedAt = Date.now();
        }
        if (session.status === 'running') {
            session.status = 'idle';
            callbacks.onStatusChange('idle', 'Agent loop concluded.');
        }
    }
    getActionExplanation(toolName, args) {
        switch (toolName) {
            case 'read_file':
                return `Reading ${args.path || 'file'}`;
            case 'write_file':
                return `Writing file ${args.path || ''}`;
            case 'edit_file':
                return `Applying modifications to ${args.path || ''}`;
            case 'delete_file':
                return `Deleting ${args.path || ''}`;
            case 'list_directory':
                return `Listing files in ${args.path || 'project root'}`;
            case 'search_code':
                return `Searching codebase for pattern "${args.query}"`;
            case 'find_symbol':
                return `Locating symbol "${args.symbol}"`;
            case 'run_command':
                return `Executing: ${args.command}`;
            case 'run_tests':
                return 'Running test suite';
            case 'run_linter':
                return 'Running codebase linter';
            case 'run_typecheck':
                return 'Running type diagnostics';
            case 'run_build':
                return 'Executing build verification';
            default:
                return `Running ${toolName}`;
        }
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
