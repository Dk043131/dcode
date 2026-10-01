"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const dotenv_1 = __importDefault(require("dotenv"));
const security_js_1 = require("./security.js");
const index_js_1 = require("./providers/index.js");
const index_js_2 = require("./tools/index.js");
const context_js_1 = require("./agent/context.js");
const orchestrator_js_1 = require("./agent/orchestrator.js");
const index_js_3 = require("./plugins/index.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
const PORT = process.env.PORT || 3002;
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();
// Core Systems
const security = new security_js_1.SecurityManager(WORKSPACE_ROOT);
const providerManager = new index_js_1.ProviderManager();
const toolRegistry = new index_js_2.ToolRegistry(WORKSPACE_ROOT, security);
const contextEngine = new context_js_1.ContextEngine(WORKSPACE_ROOT);
const orchestrator = new orchestrator_js_1.AgentOrchestrator(providerManager, toolRegistry, security, contextEngine);
const pluginManager = new index_js_3.PluginManager();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// Broadcast helper for WebSockets
function broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    wss.clients.forEach(client => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(message);
        }
    });
}
// ---------------- REST APIs ----------------
// Workspace Info & Health
app.get('/api/workspace', async (req, res) => {
    try {
        const health = await toolRegistry.detectProjectHealth();
        res.json({
            root: WORKSPACE_ROOT,
            name: path_1.default.basename(WORKSPACE_ROOT),
            health,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// File Tree
app.get('/api/files', async (req, res) => {
    try {
        const subpath = req.query.path || '.';
        const result = await toolRegistry.executeTool('list_directory', { path: subpath, recursive: true, depth: 4 });
        res.json(result.output?.entries || []);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// File Content
app.get('/api/file', async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath)
            return res.status(400).json({ error: 'path is required' });
        const result = await toolRegistry.executeTool('read_file', { path: filePath });
        if (!result.success)
            return res.status(400).json({ error: result.error });
        res.json(result.output);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// File Save
app.post('/api/file', async (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        if (!filePath || content === undefined) {
            return res.status(400).json({ error: 'path and content are required' });
        }
        const result = await toolRegistry.executeTool('write_file', { path: filePath, content });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Providers API
app.get('/api/providers', async (req, res) => {
    try {
        const providers = providerManager.getProviders().map(p => p.getConfig());
        res.json({
            providers,
            router: providerManager.getRouterConfig(),
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update Provider or Add Custom Provider
app.post('/api/providers', async (req, res) => {
    try {
        const providerConfig = req.body;
        const provider = providerManager.addOrUpdateProvider(providerConfig);
        const health = await provider.healthCheck();
        provider.updateConfig({
            status: health.ok ? 'connected' : 'error',
            errorMessage: health.ok ? undefined : health.message,
        });
        res.json(provider.getConfig());
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get Models across all providers
app.get('/api/models', async (req, res) => {
    try {
        const models = await providerManager.getAllModels();
        res.json(models);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update Router Config
app.post('/api/router', (req, res) => {
    try {
        providerManager.updateRouterConfig(req.body);
        res.json(providerManager.getRouterConfig());
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Permissions & Rules
app.get('/api/security/rules', (req, res) => {
    res.json(security.getRules());
});
app.post('/api/security/rules', (req, res) => {
    const newRule = security.addRule(req.body);
    res.json(newRule);
});
app.delete('/api/security/rules/:id', (req, res) => {
    const ok = security.deleteRule(req.params.id);
    res.json({ success: ok });
});
// Checkpoints
app.get('/api/checkpoints', (req, res) => {
    res.json(toolRegistry.getCheckpoints());
});
app.post('/api/checkpoints/:id/rollback', async (req, res) => {
    const ok = await toolRegistry.rollbackCheckpoint(req.params.id);
    res.json({ success: ok });
});
// Plugins & Marketplace API
app.get('/api/plugins', (req, res) => {
    res.json(pluginManager.getPlugins());
});
app.post('/api/plugins/:id/toggle', (req, res) => {
    const updated = pluginManager.togglePlugin(req.params.id);
    res.json({ success: !!updated, plugin: updated });
});
// Sessions API
app.get('/api/sessions', (req, res) => {
    res.json(orchestrator.getSessions());
});
app.post('/api/sessions', (req, res) => {
    const { mode, autonomyLimit } = req.body;
    const session = orchestrator.createSession(mode, autonomyLimit);
    res.json(session);
});
// Start Agent Task
app.post('/api/sessions/:id/prompt', async (req, res) => {
    const { prompt } = req.body;
    const sessionId = req.params.id;
    const session = orchestrator.getSession(sessionId);
    if (!session)
        return res.status(404).json({ error: 'Session not found' });
    res.json({ status: 'started', sessionId });
    // Run async loop
    orchestrator.runTask(sessionId, prompt, {
        onMessageUpdate: (s, msg) => {
            broadcast('message_update', { sessionId: s.id, message: msg });
        },
        onPlanUpdate: (s, plan) => {
            broadcast('plan_update', { sessionId: s.id, plan });
        },
        onPermissionRequired: req => {
            broadcast('permission_request', req);
        },
        onStatusChange: (status, message) => {
            broadcast('status_change', { sessionId, status, message });
        },
        onActionExplanation: explanation => {
            broadcast('action_explanation', { sessionId, explanation });
        },
    }).catch(err => {
        console.error('Agent error:', err);
        broadcast('agent_error', { sessionId, error: err.message });
    });
});
// Permission response
app.post('/api/permissions/:id/resolve', (req, res) => {
    const { approved } = req.body;
    const ok = orchestrator.resolvePermission(req.params.id, !!approved);
    res.json({ success: ok });
});
// Stop session
app.post('/api/sessions/:id/stop', (req, res) => {
    orchestrator.stopSession(req.params.id);
    res.json({ success: true });
});
// ---------------- WebSockets: Terminal PTY & Agent Events ----------------
const activeTerminals = new Map();
wss.on('connection', ws => {
    ws.on('message', messageRaw => {
        try {
            const data = JSON.parse(messageRaw.toString());
            if (data.type === 'terminal_init') {
                const termId = data.termId || 'default';
                const shell = process.env.SHELL || '/bin/zsh';
                const ptyProc = (0, child_process_1.spawn)(shell, [], {
                    cwd: WORKSPACE_ROOT,
                    env: { ...process.env, TERM: 'xterm-256color' },
                });
                ptyProc.stdout.on('data', chunk => {
                    ws.send(JSON.stringify({ type: 'terminal_output', termId, data: chunk.toString() }));
                });
                ptyProc.stderr.on('data', chunk => {
                    ws.send(JSON.stringify({ type: 'terminal_output', termId, data: chunk.toString() }));
                });
                ptyProc.on('exit', code => {
                    ws.send(JSON.stringify({ type: 'terminal_exit', termId, code }));
                    activeTerminals.delete(termId);
                });
                activeTerminals.set(termId, ptyProc);
            }
            else if (data.type === 'terminal_input') {
                const proc = activeTerminals.get(data.termId || 'default');
                if (proc && proc.stdin.writable) {
                    proc.stdin.write(data.input);
                }
            }
        }
        catch (e) {
            console.error('WS Error:', e);
        }
    });
    ws.on('close', () => {
        // clean up
    });
});
server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  DCODE BACKEND SERVER RUNNING`);
    console.log(`  Port: http://localhost:${PORT}`);
    console.log(`  Workspace: ${WORKSPACE_ROOT}`);
    console.log(`========================================\n`);
});
