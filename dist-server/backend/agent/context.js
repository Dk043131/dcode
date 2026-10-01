"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextEngine = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ContextEngine {
    workspaceRoot;
    fileIndex = new Map();
    projectRules = '';
    memoryNotes = [];
    constructor(workspaceRoot) {
        this.workspaceRoot = path_1.default.resolve(workspaceRoot);
        this.loadProjectRules();
    }
    async loadProjectRules() {
        const rulesPath = path_1.default.join(this.workspaceRoot, '.dcoderules');
        if (fs_1.default.existsSync(rulesPath)) {
            try {
                this.projectRules = await promises_1.default.readFile(rulesPath, 'utf-8');
            }
            catch { }
        }
        else {
            // Default initial rules
            this.projectRules = `# Dcode Project Rules
- Follow clean architecture and modularity.
- Run tests after non-trivial modifications.
- Do not commit secrets or raw tokens.
- Prefer explicit types in TypeScript.`;
        }
    }
    getProjectRules() {
        return this.projectRules;
    }
    async setProjectRules(rules) {
        this.projectRules = rules;
        const rulesPath = path_1.default.join(this.workspaceRoot, '.dcoderules');
        await promises_1.default.writeFile(rulesPath, rules, 'utf-8');
    }
    getMemoryNotes() {
        return [...this.memoryNotes];
    }
    addMemoryNote(note) {
        this.memoryNotes.push(note);
    }
    clearMemory() {
        this.memoryNotes = [];
    }
    /**
     * Fast codebase indexing for relevant context gathering
     */
    async indexCodebase() {
        this.fileIndex.clear();
        const traverse = async (dir) => {
            let entries = [];
            try {
                entries = await promises_1.default.readdir(dir, { withFileTypes: true });
            }
            catch {
                return;
            }
            for (const entry of entries) {
                if (entry.name.startsWith('.') && entry.name !== '.dcoderules')
                    continue;
                if (['node_modules', 'dist', 'dist-server', 'build', '.git', 'coverage'].includes(entry.name)) {
                    continue;
                }
                const fullPath = path_1.default.join(dir, entry.name);
                const rel = path_1.default.relative(this.workspaceRoot, fullPath);
                if (entry.isDirectory()) {
                    await traverse(fullPath);
                }
                else if (entry.isFile()) {
                    const ext = path_1.default.extname(entry.name).toLowerCase();
                    if (['.ts', '.tsx', '.js', '.jsx', '.json', '.py', '.rs', '.go', '.html', '.css', '.md'].includes(ext)) {
                        try {
                            const stat = await promises_1.default.stat(fullPath);
                            if (stat.size > 200 * 1024)
                                continue; // skip very large files
                            const content = await promises_1.default.readFile(fullPath, 'utf-8');
                            const symbols = this.extractSymbols(content);
                            const snippet = content.slice(0, 300);
                            this.fileIndex.set(rel, {
                                path: rel,
                                name: entry.name,
                                extension: ext,
                                symbols,
                                snippet,
                                size: stat.size,
                            });
                        }
                        catch { }
                    }
                }
            }
        };
        await traverse(this.workspaceRoot);
        return this.fileIndex.size;
    }
    extractSymbols(content) {
        const symbols = new Set();
        const regex = /\b(export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+([a-zA-Z0-9_$]+)|(?:class|function)\s+([a-zA-Z0-9_$]+))/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const sym = match[2] || match[3];
            if (sym && sym.length > 2) {
                symbols.add(sym);
            }
        }
        return Array.from(symbols).slice(0, 20);
    }
    /**
     * Synthesize high-density project context for agent queries
     */
    getContextOverview(userQuery) {
        const totalFiles = this.fileIndex.size;
        const fileList = Array.from(this.fileIndex.keys()).slice(0, 40).join(', ');
        let relevantSymbols = '';
        if (userQuery) {
            const keywords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const matched = [];
            for (const [path, entry] of this.fileIndex.entries()) {
                const hasKeyword = keywords.some(k => path.toLowerCase().includes(k) || entry.symbols.some(s => s.toLowerCase().includes(k)));
                if (hasKeyword) {
                    matched.push(`${path} (symbols: ${entry.symbols.slice(0, 5).join(', ')})`);
                }
            }
            if (matched.length > 0) {
                relevantSymbols = `\nRelevant Codebase Files:\n- ${matched.slice(0, 10).join('\n- ')}`;
            }
        }
        return `Workspace Summary:
Indexed Files (${totalFiles}): ${fileList}${totalFiles > 40 ? '... [and more]' : ''}
${relevantSymbols}

Project Rules:
${this.projectRules}

Persistent Memory Notes:
${this.memoryNotes.length > 0 ? this.memoryNotes.map(n => `- ${n}`).join('\n') : '(None)'}`;
    }
}
exports.ContextEngine = ContextEngine;
