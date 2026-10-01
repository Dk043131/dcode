"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityManager = void 0;
const path_1 = __importDefault(require("path"));
// Sensitive patterns that must be protected
const SENSITIVE_PATTERNS = [
    /^\.env(\..+)?$/i,
    /id_rsa/i,
    /id_ed25519/i,
    /\.pem$/i,
    /\.key$/i,
    /\.pfx$/i,
    /\.p12$/i,
    /credentials\.json$/i,
    /\.aws\/credentials/i,
    /\.kube\/config/i,
    /service-account.*\.json$/i,
    /\.netrc$/i,
    /shadow$/i
];
class SecurityManager {
    workspaceRoot;
    rules = [];
    sessionDecisions = new Map(); // e.g. "ALLOW_ONCE" cache or session rule
    constructor(workspaceRoot) {
        this.workspaceRoot = path_1.default.resolve(workspaceRoot);
        this.initDefaultRules();
    }
    getWorkspaceRoot() {
        return this.workspaceRoot;
    }
    setWorkspaceRoot(newRoot) {
        this.workspaceRoot = path_1.default.resolve(newRoot);
    }
    initDefaultRules() {
        this.rules = [
            { id: '1', targetType: 'command', pattern: 'npm test', decision: 'ALWAYS_ALLOW', createdAt: Date.now(), description: 'Safe test runner' },
            { id: '2', targetType: 'command', pattern: 'npm run *', decision: 'ASK', createdAt: Date.now(), description: 'NPM scripts' },
            { id: '3', targetType: 'command', pattern: 'git status', decision: 'ALWAYS_ALLOW', createdAt: Date.now(), description: 'Git read-only' },
            { id: '4', targetType: 'command', pattern: 'git diff', decision: 'ALWAYS_ALLOW', createdAt: Date.now(), description: 'Git diff' },
            { id: '5', targetType: 'command', pattern: 'git log', decision: 'ALWAYS_ALLOW', createdAt: Date.now(), description: 'Git log' },
            { id: '6', targetType: 'pattern', pattern: 'rm -rf *', decision: 'NEVER', createdAt: Date.now(), description: 'Dangerous recursive delete' },
            { id: '7', targetType: 'pattern', pattern: 'rm -r *', decision: 'NEVER', createdAt: Date.now(), description: 'Dangerous recursive delete' },
            { id: '8', targetType: 'command', pattern: 'git reset --hard', decision: 'NEVER', createdAt: Date.now(), description: 'Discard all changes' },
            { id: '9', targetType: 'command', pattern: 'git clean -fd', decision: 'NEVER', createdAt: Date.now(), description: 'Untracked files purge' },
            { id: '10', targetType: 'command', pattern: 'git push', decision: 'ASK', createdAt: Date.now(), description: 'Remote repository mutation' },
            { id: '11', targetType: 'command', pattern: 'npm install', decision: 'ASK', createdAt: Date.now(), description: 'Package installation' },
            { id: '12', targetType: 'command', pattern: 'pip install *', decision: 'ASK', createdAt: Date.now(), description: 'Python package install' }
        ];
    }
    getRules() {
        return [...this.rules];
    }
    addRule(rule) {
        const newRule = {
            ...rule,
            id: Math.random().toString(36).substring(2, 9),
            createdAt: Date.now()
        };
        this.rules.unshift(newRule);
        return newRule;
    }
    deleteRule(id) {
        const idx = this.rules.findIndex(r => r.id === id);
        if (idx !== -1) {
            this.rules.splice(idx, 1);
            return true;
        }
        return false;
    }
    /**
     * Classify terminal commands into SAFE, CAUTION, DANGEROUS, or BLOCKED
     */
    classifyCommand(cmd) {
        const trimmed = cmd.trim();
        // Check BLOCKED: boundary escapes, sudo, shell injection escapes
        if (trimmed.includes('sudo ') ||
            trimmed.startsWith('sudo') ||
            trimmed.includes('/etc/') ||
            trimmed.includes('/var/run') ||
            trimmed.includes('mkfs') ||
            trimmed.includes('dd if=') ||
            trimmed.includes(':(){ :|:& };:') || // fork bomb
            trimmed.includes('> /dev/sd')) {
            return { category: 'BLOCKED', reason: 'Attempt to execute privileged system command or destructive operation' };
        }
        // Check DANGEROUS: file purges, hard resets
        if (/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f*|-rf|-fr)\b/.test(trimmed) ||
            /\bgit\s+reset\s+--hard\b/.test(trimmed) ||
            /\bgit\s+clean\s+-[a-zA-Z]*f\b/.test(trimmed) ||
            /\bdropdb\b/.test(trimmed) ||
            /\bmkdir\s+\//.test(trimmed)) {
            return { category: 'DANGEROUS', reason: 'Command can irreversibly destroy files or git history' };
        }
        // Check CAUTION: install packages, remote git modifications, container builds
        if (/\b(npm|yarn|pnpm|bun)\s+(install|add|remove|uninstall|update)\b/.test(trimmed) ||
            /\b(pip|pip3|poetry|uv)\s+(install|add|remove)\b/.test(trimmed) ||
            /\bgit\s+(push|checkout|commit|merge|rebase)\b/.test(trimmed) ||
            /\b(cargo|go)\s+(install|build|get)\b/.test(trimmed) ||
            /\bdocker\s+(build|run|compose)\b/.test(trimmed)) {
            return { category: 'CAUTION', reason: 'Modifies dependencies, git branches, or executes external code' };
        }
        // Safe inspection commands
        if (/\b(npm|yarn|pnpm|bun)\s+(test|run\s+test|run\s+lint|run\s+typecheck)\b/.test(trimmed) ||
            /\b(pytest|jest|vitest|mocha|cargo\s+test|go\s+test)\b/.test(trimmed) ||
            /\b(git\s+(status|diff|log|branch|show))\b/.test(trimmed) ||
            /\b(ls|dir|cat|echo|head|tail|grep|find|pwd)\b/.test(trimmed)) {
            return { category: 'SAFE', reason: 'Read-only inspection or safe verification command' };
        }
        return { category: 'CAUTION', reason: 'General shell execution requires standard verification' };
    }
    /**
     * Determine permission for an action (tool, command, file edit)
     */
    checkPermission(actionType, target) {
        // 1. Check if blocked
        if (actionType === 'command') {
            const { category, reason } = this.classifyCommand(target);
            if (category === 'BLOCKED') {
                return { decision: 'NEVER', category, reason };
            }
            // Check explicit user rules
            for (const rule of this.rules) {
                if (rule.targetType === 'command' && this.matchPattern(rule.pattern, target)) {
                    return { decision: rule.decision, category, reason: `Matched custom rule: ${rule.pattern}` };
                }
                if (rule.targetType === 'pattern' && this.matchPattern(rule.pattern, target)) {
                    return { decision: rule.decision, category, reason: `Matched security pattern: ${rule.pattern}` };
                }
            }
            // If category is DANGEROUS and no rule allows, require ASK or NEVER
            if (category === 'DANGEROUS') {
                return { decision: 'ASK', category, reason };
            }
            if (category === 'SAFE') {
                return { decision: 'ALWAYS_ALLOW', category, reason };
            }
            return { decision: 'ASK', category, reason };
        }
        if (actionType === 'file_delete') {
            return { decision: 'ASK', category: 'DANGEROUS', reason: 'File deletion must be confirmed' };
        }
        if (actionType === 'file_write') {
            // Check if file is sensitive
            if (this.isSensitiveFile(target)) {
                return { decision: 'ASK', category: 'CAUTION', reason: 'Modification of sensitive/secret configuration file' };
            }
            return { decision: 'ALWAYS_ALLOW', category: 'SAFE', reason: 'Standard file modification' };
        }
        return { decision: 'ALWAYS_ALLOW', category: 'SAFE', reason: 'Standard operation' };
    }
    /**
     * Validate that file path stays within the workspace boundary
     */
    isPathWithinWorkspace(filePath) {
        const absolute = path_1.default.resolve(this.workspaceRoot, filePath);
        return absolute.startsWith(this.workspaceRoot);
    }
    /**
     * Detect if a file is sensitive (e.g. .env, private keys, credentials)
     */
    isSensitiveFile(filePath) {
        const fileName = path_1.default.basename(filePath);
        return SENSITIVE_PATTERNS.some(regex => regex.test(fileName) || regex.test(filePath));
    }
    /**
     * Sanitize content by masking obvious secret keys before sending to AI providers
     */
    sanitizeSecretContent(content) {
        // Mask potential API keys, JWT tokens, private key blocks
        let sanitized = content;
        sanitized = sanitized.replace(/(BEGIN\s+[A-Z\s]+PRIVATE\s+KEY[\s\S]+?END\s+[A-Z\s]+PRIVATE\s+KEY)/g, '[REDACTED PRIVATE KEY]');
        sanitized = sanitized.replace(/(['"]?(?:api[_-]?key|secret|token|password|auth|jwt)['"]?\s*[:=]\s*['"]?)[a-zA-Z0-9_\-\.]{16,}(['"]?)/gi, '$1[REDACTED_SECRET]$2');
        return sanitized;
    }
    matchPattern(pattern, text) {
        if (pattern === text)
            return true;
        if (pattern.includes('*')) {
            const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
            try {
                const regex = new RegExp(regexStr, 'i');
                return regex.test(text);
            }
            catch {
                return false;
            }
        }
        return false;
    }
}
exports.SecurityManager = SecurityManager;
