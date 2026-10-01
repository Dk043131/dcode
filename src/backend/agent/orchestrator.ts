import { ProviderManager } from '../providers/index.js';
import { ToolRegistry } from '../tools/index.js';
import { SecurityManager } from '../security.js';
import { ContextEngine } from './context.js';
import {
  AgentMessage,
  AgentMode,
  AgentPlan,
  AgentSession,
  PermissionRequest,
  ToolExecutionResult,
} from '../../shared/types.js';

export interface AgentCallbacks {
  onMessageUpdate: (session: AgentSession, msg: AgentMessage) => void;
  onPlanUpdate: (session: AgentSession, plan: AgentPlan) => void;
  onPermissionRequired: (req: PermissionRequest) => void;
  onStatusChange: (status: AgentSession['status'], message?: string) => void;
  onActionExplanation: (explanation: string) => void;
}

export class AgentOrchestrator {
  private providerManager: ProviderManager;
  private toolRegistry: ToolRegistry;
  private security: SecurityManager;
  private contextEngine: ContextEngine;
  private sessions: Map<string, AgentSession> = new Map();
  private pendingPermissions: Map<string, {
    resolve: (approved: boolean) => void;
    request: PermissionRequest;
  }> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(
    providerManager: ProviderManager,
    toolRegistry: ToolRegistry,
    security: SecurityManager,
    contextEngine: ContextEngine
  ) {
    this.providerManager = providerManager;
    this.toolRegistry = toolRegistry;
    this.security = security;
    this.contextEngine = contextEngine;
  }

  public createSession(mode: AgentMode = 'CODE', autonomyLimit: number = 8): AgentSession {
    const id = Math.random().toString(36).substring(2, 9);
    const session: AgentSession = {
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

  public getSession(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  public getSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public resolvePermission(requestId: string, approved: boolean): boolean {
    const pending = this.pendingPermissions.get(requestId);
    if (!pending) return false;
    pending.request.status = approved ? 'approved' : 'rejected';
    pending.resolve(approved);
    this.pendingPermissions.delete(requestId);
    return true;
  }

  public stopSession(sessionId: string): void {
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
  public async runTask(
    sessionId: string,
    userPrompt: string,
    callbacks: AgentCallbacks
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const abortController = new AbortController();
    this.abortControllers.set(sessionId, abortController);

    // 1. Append User Message
    const userMsg: AgentMessage = {
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
    callbacks.onActionExplanation('Loading codebase...');
    await this.contextEngine.indexCodebase();
    const contextSnippet = this.contextEngine.getContextOverview(userPrompt);

    // Filter tools based on Agent Mode
    const allTools = this.toolRegistry.getToolDefinitions();
    let permittedTools = allTools;

    if (session.mode === 'ASK' || session.mode === 'REVIEW') {
      // Strictly read-only tools
      permittedTools = allTools.filter(t => t.category === 'read' || t.category === 'search');
    } else if (session.mode === 'PLAN') {
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
      { role: 'system' as const, content: systemPrompt },
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
      const assistantMsg: AgentMessage = {
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
      } catch (chatErr: any) {
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
      } as any);

      for (const tc of response.toolCalls) {
        if (abortController.signal.aborted) break;

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
        const permCheck = this.security.checkPermission(toolActionType as any, targetArg);

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
          } as any);
          continue;
        }

        if (permCheck.decision === 'ASK') {
          session.status = 'waiting_permission';
          callbacks.onStatusChange('waiting_permission', `Approval required: ${tc.name} (${targetArg})`);

          const reqId = Math.random().toString(36).substring(2, 9);
          const permReq: PermissionRequest = {
            id: reqId,
            timestamp: Date.now(),
            type: toolActionType as any,
            title: `Approve ${tc.name}`,
            detail: `${targetArg} — ${permCheck.reason}`,
            securityCategory: permCheck.category,
            params: tc.arguments,
            status: 'pending',
          };

          const approved = await new Promise<boolean>(resolve => {
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
            } as any);
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
        } as any);
      }

      callbacks.onMessageUpdate(session, assistantMsg);
      session.updatedAt = Date.now();
    }

    if (session.status === 'running') {
      session.status = 'idle';
      callbacks.onStatusChange('idle', 'Agent loop concluded.');
    }
  }

  private getActionExplanation(toolName: string, args: any): string {
    switch (toolName) {
      case 'read_file':
        return `Loading ${args.path ? args.path.split('/').pop() : 'file'}...`;
      case 'write_file':
        return `Saving ${args.path ? args.path.split('/').pop() : 'file'}...`;
      case 'edit_file':
        return `Updating ${args.path ? args.path.split('/').pop() : 'file'}...`;
      case 'delete_file':
        return `Deleting ${args.path ? args.path.split('/').pop() : 'file'}...`;
      case 'list_directory':
        return 'Scanning files...';
      case 'search_code':
        return `Searching code...`;
      case 'find_symbol':
        return `Locating symbol...`;
      case 'run_command':
        return `Running command...`;
      case 'run_tests':
        return 'Running tests...';
      case 'run_linter':
        return 'Checking linter...';
      case 'run_typecheck':
        return 'Checking types...';
      case 'run_build':
        return 'Building...';
      default:
        return 'Loading...';
    }
  }
}
