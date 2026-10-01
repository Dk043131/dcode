import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export interface FileIndexEntry {
  path: string;
  name: string;
  extension: string;
  symbols: string[];
  snippet: string;
  size: number;
}

export class ContextEngine {
  private workspaceRoot: string;
  private fileIndex: Map<string, FileIndexEntry> = new Map();
  private projectRules: string = '';
  private memoryNotes: string[] = [];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.loadProjectRules();
  }

  public async loadProjectRules(): Promise<void> {
    const rulesPath = path.join(this.workspaceRoot, '.dcoderules');
    if (fsSync.existsSync(rulesPath)) {
      try {
        this.projectRules = await fs.readFile(rulesPath, 'utf-8');
      } catch {}
    } else {
      // Default initial rules
      this.projectRules = `# Dcode Project Rules
- Follow clean architecture and modularity.
- Run tests after non-trivial modifications.
- Do not commit secrets or raw tokens.
- Prefer explicit types in TypeScript.`;
    }
  }

  public getProjectRules(): string {
    return this.projectRules;
  }

  public async setProjectRules(rules: string): Promise<void> {
    this.projectRules = rules;
    const rulesPath = path.join(this.workspaceRoot, '.dcoderules');
    await fs.writeFile(rulesPath, rules, 'utf-8');
  }

  public getMemoryNotes(): string[] {
    return [...this.memoryNotes];
  }

  public addMemoryNote(note: string): void {
    this.memoryNotes.push(note);
  }

  public clearMemory(): void {
    this.memoryNotes = [];
  }

  /**
   * Fast codebase indexing for relevant context gathering
   */
  public async indexCodebase(): Promise<number> {
    this.fileIndex.clear();

    const traverse = async (dir: string) => {
      let entries: fsSync.Dirent[] = [];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.dcoderules') continue;
        if (['node_modules', 'dist', 'dist-server', 'build', '.git', 'coverage'].includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        const rel = path.relative(this.workspaceRoot, fullPath);

        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.ts', '.tsx', '.js', '.jsx', '.json', '.py', '.rs', '.go', '.html', '.css', '.md'].includes(ext)) {
            try {
              const stat = await fs.stat(fullPath);
              if (stat.size > 200 * 1024) continue; // skip very large files

              const content = await fs.readFile(fullPath, 'utf-8');
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
            } catch {}
          }
        }
      }
    };

    await traverse(this.workspaceRoot);
    return this.fileIndex.size;
  }

  private extractSymbols(content: string): string[] {
    const symbols = new Set<string>();
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
  public getContextOverview(userQuery?: string): string {
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
