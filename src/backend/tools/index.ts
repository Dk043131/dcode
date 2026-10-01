import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import * as diff from 'diff';
import { SecurityManager } from '../security.js';
import {
  CodeCheckpoint,
  FileTreeNode,
  ProjectHealthStatus,
  ToolDefinition,
  ToolExecutionResult,
} from '../../shared/types.js';

const execAsync = util.promisify(exec);

export class ToolRegistry {
  private workspaceRoot: string;
  private security: SecurityManager;
  private checkpoints: CodeCheckpoint[] = [];

  constructor(workspaceRoot: string, security: SecurityManager) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.security = security;
  }

  public getCheckpoints(): CodeCheckpoint[] {
    return this.checkpoints;
  }

  public async rollbackCheckpoint(checkpointId: string): Promise<boolean> {
    const cp = this.checkpoints.find(c => c.id === checkpointId);
    if (!cp) return false;

    for (const f of cp.files) {
      const fullPath = path.resolve(this.workspaceRoot, f.path);
      if (f.beforeContent === '') {
        // File was newly created, delete it
        if (fsSync.existsSync(fullPath)) {
          await fs.unlink(fullPath);
        }
      } else {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, f.beforeContent, 'utf-8');
      }
    }
    return true;
  }

  public getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'read_file',
        description: 'Read the contents of a file in the workspace. Supports line ranges for large files.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to file' },
            start_line: { type: 'number', description: 'Optional 1-based start line' },
            end_line: { type: 'number', description: 'Optional 1-based end line' },
          },
          required: ['path'],
        },
        category: 'read',
        securityLevel: 'safe',
      },
      {
        name: 'write_file',
        description: 'Create a new file or completely overwrite an existing file. Automatically records a rollback checkpoint.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to file' },
            content: { type: 'string', description: 'Complete file content to write' },
          },
          required: ['path', 'content'],
        },
        category: 'write',
        securityLevel: 'caution',
      },
      {
        name: 'edit_file',
        description: 'Precise search and replace of a block within an existing file. Avoids blind overwriting.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to file' },
            old_content: { type: 'string', description: 'Exact string or block to match in file' },
            new_content: { type: 'string', description: 'Replacement string' },
          },
          required: ['path', 'old_content', 'new_content'],
        },
        category: 'write',
        securityLevel: 'caution',
      },
      {
        name: 'delete_file',
        description: 'Delete a file from the workspace. Generates a restorable checkpoint.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to file to remove' },
          },
          required: ['path'],
        },
        category: 'write',
        securityLevel: 'dangerous',
      },
      {
        name: 'list_directory',
        description: 'List contents of a directory with optional recursive depth and exclusions.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative directory path. Default "."' },
            recursive: { type: 'boolean', description: 'Whether to traverse recursively' },
            depth: { type: 'number', description: 'Max depth if recursive (default 3)' },
            show_hidden: { type: 'boolean', description: 'Whether to include hidden files' },
          },
        },
        category: 'read',
        securityLevel: 'safe',
      },
      {
        name: 'search_code',
        description: 'Search for text or regex patterns across the codebase (uses ripgrep/grep).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Text or regex query' },
            regex: { type: 'boolean', description: 'Treat query as regex' },
            case_sensitive: { type: 'boolean', description: 'Case sensitive matching' },
            file_pattern: { type: 'string', description: 'Glob pattern like "*.ts" or "*.py"' },
          },
          required: ['query'],
        },
        category: 'search',
        securityLevel: 'safe',
      },
      {
        name: 'find_symbol',
        description: 'Find definitions of functions, classes, interfaces, or variables in the codebase.',
        parameters: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Symbol name to locate' },
            kind: { type: 'string', description: 'function | class | interface | type | variable' },
          },
          required: ['symbol'],
        },
        category: 'search',
        securityLevel: 'safe',
      },
      {
        name: 'run_command',
        description: 'Execute a terminal command in the workspace. Subject to Dcode security classification and permissions.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The shell command to execute' },
            working_directory: { type: 'string', description: 'Optional relative path' },
            timeout: { type: 'number', description: 'Timeout in ms (default 30000)' },
          },
          required: ['command'],
        },
        category: 'execute',
        securityLevel: 'caution',
      },
      {
        name: 'run_tests',
        description: 'Automatically detects project test runner (npm test, pytest, cargo test, go test) and runs tests.',
        parameters: {
          type: 'object',
          properties: {
            filter: { type: 'string', description: 'Optional test filter/pattern' },
          },
        },
        category: 'diagnostics',
        securityLevel: 'safe',
      },
      {
        name: 'run_linter',
        description: 'Automatically detects linter (eslint, ruff, flake8, cargo clippy) and checks code.',
        parameters: { type: 'object', properties: {} },
        category: 'diagnostics',
        securityLevel: 'safe',
      },
      {
        name: 'run_typecheck',
        description: 'Automatically detects type checker (tsc, mypy, pyright) and checks types.',
        parameters: { type: 'object', properties: {} },
        category: 'diagnostics',
        securityLevel: 'safe',
      },
      {
        name: 'run_build',
        description: 'Automatically detects build framework (npm run build, cargo build, go build) and compiles.',
        parameters: { type: 'object', properties: {} },
        category: 'diagnostics',
        securityLevel: 'safe',
      },
    ];
  }

  public async executeTool(toolName: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      switch (toolName) {
        case 'read_file':
          return await this.handleReadFile(params, startTime);
        case 'write_file':
          return await this.handleWriteFile(params, startTime);
        case 'edit_file':
          return await this.handleEditFile(params, startTime);
        case 'delete_file':
          return await this.handleDeleteFile(params, startTime);
        case 'list_directory':
          return await this.handleListDirectory(params, startTime);
        case 'search_code':
          return await this.handleSearchCode(params, startTime);
        case 'find_symbol':
          return await this.handleFindSymbol(params, startTime);
        case 'run_command':
          return await this.handleRunCommand(params, startTime);
        case 'run_tests':
          return await this.handleRunTests(params, startTime);
        case 'run_linter':
          return await this.handleRunLinter(params, startTime);
        case 'run_typecheck':
          return await this.handleRunTypecheck(params, startTime);
        case 'run_build':
          return await this.handleRunBuild(params, startTime);
        default:
          return {
            tool: toolName,
            success: false,
            error: `Unknown tool: ${toolName}`,
            executionTimeMs: Date.now() - startTime,
          };
      }
    } catch (err: any) {
      return {
        tool: toolName,
        success: false,
        error: err.message || String(err),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // --- Handlers ---

  private async handleReadFile(params: any, startTime: number): Promise<ToolExecutionResult> {
    const relPath = params.path;
    const fullPath = path.resolve(this.workspaceRoot, relPath);

    if (!this.security.isPathWithinWorkspace(fullPath)) {
      return {
        tool: 'read_file',
        success: false,
        error: `Security boundary error: Cannot read files outside workspace (${relPath})`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (!fsSync.existsSync(fullPath)) {
      return {
        tool: 'read_file',
        success: false,
        error: `File does not exist: ${relPath}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    let content = await fs.readFile(fullPath, 'utf-8');

    // Protect sensitive contents
    if (this.security.isSensitiveFile(relPath)) {
      content = this.security.sanitizeSecretContent(content);
    }

    const lines = content.split('\n');
    const totalLines = lines.length;

    let start = params.start_line ? Math.max(1, params.start_line) : 1;
    let end = params.end_line ? Math.min(totalLines, params.end_line) : totalLines;

    if (start > totalLines) {
      return {
        tool: 'read_file',
        success: true,
        output: { content: '', totalLines, slicedRange: [start, end] },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const sliced = lines.slice(start - 1, end).join('\n');

    return {
      tool: 'read_file',
      success: true,
      output: {
        path: relPath,
        content: sliced,
        totalLines,
        displayedRange: `${start}-${end} of ${totalLines}`,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  private async handleWriteFile(params: any, startTime: number): Promise<ToolExecutionResult> {
    const relPath = params.path;
    const fullPath = path.resolve(this.workspaceRoot, relPath);

    if (!this.security.isPathWithinWorkspace(fullPath)) {
      return {
        tool: 'write_file',
        success: false,
        error: `Security boundary error: Cannot write outside workspace (${relPath})`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    let beforeContent = '';
    const exists = fsSync.existsSync(fullPath);
    if (exists) {
      beforeContent = await fs.readFile(fullPath, 'utf-8');
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, params.content, 'utf-8');

    // Create Checkpoint
    const checkpoint: CodeCheckpoint = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      description: `write_file: ${relPath}`,
      files: [{ path: relPath, beforeContent, afterContent: params.content }],
    };
    this.checkpoints.unshift(checkpoint);

    // Compute diff
    const patch = diff.createTwoFilesPatch(relPath, relPath, beforeContent, params.content);
    const added = (patch.match(/^\+[^+]/gm) || []).length;
    const removed = (patch.match(/^-[^-]/gm) || []).length;

    return {
      tool: 'write_file',
      success: true,
      output: {
        path: relPath,
        bytesWritten: Buffer.byteLength(params.content, 'utf8'),
        checkpointId: checkpoint.id,
      },
      diffSummary: {
        path: relPath,
        additions: added,
        deletions: removed,
        patch,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  private async handleEditFile(params: any, startTime: number): Promise<ToolExecutionResult> {
    const relPath = params.path;
    const fullPath = path.resolve(this.workspaceRoot, relPath);

    if (!this.security.isPathWithinWorkspace(fullPath)) {
      return {
        tool: 'edit_file',
        success: false,
        error: `Security boundary error: Cannot edit outside workspace (${relPath})`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (!fsSync.existsSync(fullPath)) {
      return {
        tool: 'edit_file',
        success: false,
        error: `File not found: ${relPath}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const currentContent = await fs.readFile(fullPath, 'utf-8');
    const { old_content, new_content } = params;

    if (!currentContent.includes(old_content)) {
      return {
        tool: 'edit_file',
        success: false,
        error: `Exact old_content block not found in ${relPath}. Did the file change or was whitespace mismatched?`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const afterContent = currentContent.replace(old_content, new_content);
    await fs.writeFile(fullPath, afterContent, 'utf-8');

    // Checkpoint
    const checkpoint: CodeCheckpoint = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      description: `edit_file: ${relPath}`,
      files: [{ path: relPath, beforeContent: currentContent, afterContent }],
    };
    this.checkpoints.unshift(checkpoint);

    const patch = diff.createTwoFilesPatch(relPath, relPath, currentContent, afterContent);
    const added = (patch.match(/^\+[^+]/gm) || []).length;
    const removed = (patch.match(/^-[^-]/gm) || []).length;

    return {
      tool: 'edit_file',
      success: true,
      output: {
        path: relPath,
        checkpointId: checkpoint.id,
      },
      diffSummary: {
        path: relPath,
        additions: added,
        deletions: removed,
        patch,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  private async handleDeleteFile(params: any, startTime: number): Promise<ToolExecutionResult> {
    const relPath = params.path;
    const fullPath = path.resolve(this.workspaceRoot, relPath);

    if (!this.security.isPathWithinWorkspace(fullPath)) {
      return {
        tool: 'delete_file',
        success: false,
        error: `Security boundary error: Cannot delete outside workspace (${relPath})`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (!fsSync.existsSync(fullPath)) {
      return {
        tool: 'delete_file',
        success: false,
        error: `File does not exist: ${relPath}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const beforeContent = await fs.readFile(fullPath, 'utf-8');
    await fs.unlink(fullPath);

    const checkpoint: CodeCheckpoint = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      description: `delete_file: ${relPath}`,
      files: [{ path: relPath, beforeContent, afterContent: '' }],
    };
    this.checkpoints.unshift(checkpoint);

    return {
      tool: 'delete_file',
      success: true,
      output: { deleted: relPath, checkpointId: checkpoint.id },
      executionTimeMs: Date.now() - startTime,
    };
  }

  private async handleListDirectory(params: any, startTime: number): Promise<ToolExecutionResult> {
    const relPath = params.path || '.';
    const fullPath = path.resolve(this.workspaceRoot, relPath);

    if (!this.security.isPathWithinWorkspace(fullPath)) {
      return {
        tool: 'list_directory',
        success: false,
        error: `Security boundary error: Cannot list outside workspace (${relPath})`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (!fsSync.existsSync(fullPath)) {
      return {
        tool: 'list_directory',
        success: false,
        error: `Directory not found: ${relPath}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const maxDepth = params.depth ?? 3;
    const recursive = params.recursive ?? false;
    const showHidden = params.show_hidden ?? false;

    const buildTree = async (currentDir: string, depth: number): Promise<FileTreeNode[]> => {
      if (depth > maxDepth) return [];
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      const nodes: FileTreeNode[] = [];

      for (const entry of entries) {
        if (!showHidden && entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'dist-server') {
          continue;
        }

        const entryPath = path.join(currentDir, entry.name);
        const rel = path.relative(this.workspaceRoot, entryPath);
        const isDir = entry.isDirectory();

        if (isDir) {
          nodes.push({
            name: entry.name,
            path: rel,
            isDirectory: true,
            children: recursive ? await buildTree(entryPath, depth + 1) : undefined,
          });
        } else {
          const stat = await fs.stat(entryPath);
          nodes.push({
            name: entry.name,
            path: rel,
            isDirectory: false,
            size: stat.size,
            isSensitive: this.security.isSensitiveFile(rel),
          });
        }
      }
      return nodes;
    };

    const tree = await buildTree(fullPath, 1);
    return {
      tool: 'list_directory',
      success: true,
      output: { entries: tree },
      executionTimeMs: Date.now() - startTime,
    };
  }

  private async handleSearchCode(params: any, startTime: number): Promise<ToolExecutionResult> {
    const { query, regex, case_sensitive, file_pattern } = params;

    let cmd = 'grep -rnI';
    if (!case_sensitive) cmd += ' -i';
    if (regex) cmd += ' -E';

    if (file_pattern) {
      cmd += ` --include="${file_pattern}"`;
    }
    cmd += ` --exclude-dir={node_modules,.git,dist,dist-server,build,.next}`;
    cmd += ` -- "${query.replace(/"/g, '\\"')}" .`;

    try {
      const { stdout } = await execAsync(cmd, { cwd: this.workspaceRoot, maxBuffer: 1024 * 1024 * 2 });
      const lines = stdout.split('\n').filter(Boolean).slice(0, 50); // top 50 matches
      const results = lines.map(line => {
        const parts = line.split(':');
        const file = parts[0];
        const lineNum = parts[1];
        const content = parts.slice(2).join(':');
        return { file, line: parseInt(lineNum, 10), content: content.trim() };
      });

      return {
        tool: 'search_code',
        success: true,
        output: { query, totalMatches: lines.length, results },
        executionTimeMs: Date.now() - startTime,
      };
    } catch {
      return {
        tool: 'search_code',
        success: true,
        output: { query, totalMatches: 0, results: [] },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private async handleFindSymbol(params: any, startTime: number): Promise<ToolExecutionResult> {
    const { symbol } = params;
    // Fast regex symbol detection across common languages
    const pattern = `\\b(class|function|interface|type|const|let|var|def|func|struct)\\s+${symbol}\\b`;
    return await this.handleSearchCode({ query: pattern, regex: true }, startTime);
  }

  private async handleRunCommand(params: any, startTime: number): Promise<ToolExecutionResult> {
    const { command, working_directory, timeout = 30000 } = params;

    const cwd = working_directory
      ? path.resolve(this.workspaceRoot, working_directory)
      : this.workspaceRoot;

    if (!this.security.isPathWithinWorkspace(cwd)) {
      return {
        tool: 'run_command',
        success: false,
        error: `Cannot run command outside workspace: ${cwd}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command, { cwd, timeout });
      return {
        tool: 'run_command',
        success: true,
        output: {
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0,
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        tool: 'run_command',
        success: false,
        error: err.message,
        output: {
          command,
          stdout: err.stdout ? err.stdout.trim() : '',
          stderr: err.stderr ? err.stderr.trim() : err.message,
          exitCode: err.code || 1,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  public async detectProjectHealth(): Promise<ProjectHealthStatus> {
    const hasGit = fsSync.existsSync(path.join(this.workspaceRoot, '.git'));
    let packageManager: string | undefined;

    if (fsSync.existsSync(path.join(this.workspaceRoot, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
    else if (fsSync.existsSync(path.join(this.workspaceRoot, 'yarn.lock'))) packageManager = 'yarn';
    else if (fsSync.existsSync(path.join(this.workspaceRoot, 'bun.lockb'))) packageManager = 'bun';
    else if (fsSync.existsSync(path.join(this.workspaceRoot, 'package.json'))) packageManager = 'npm';
    else if (fsSync.existsSync(path.join(this.workspaceRoot, 'Cargo.toml'))) packageManager = 'cargo';
    else if (fsSync.existsSync(path.join(this.workspaceRoot, 'pyproject.toml'))) packageManager = 'poetry/uv';
    else if (fsSync.existsSync(path.join(this.workspaceRoot, 'requirements.txt'))) packageManager = 'pip';
    else if (fsSync.existsSync(path.join(this.workspaceRoot, 'go.mod'))) packageManager = 'go';

    let testFramework: string | undefined;
    let linter: string | undefined;
    let typeChecker: string | undefined;
    let buildTool: string | undefined;

    if (packageManager === 'npm' || packageManager === 'yarn' || packageManager === 'pnpm' || packageManager === 'bun') {
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(this.workspaceRoot, 'package.json'), 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps.vitest) testFramework = 'vitest';
        else if (allDeps.jest) testFramework = 'jest';
        else if (allDeps.mocha) testFramework = 'mocha';
        else if (pkg.scripts?.test) testFramework = 'npm test';

        if (allDeps.eslint) linter = 'eslint';
        else if (pkg.scripts?.lint) linter = 'npm run lint';

        if (allDeps.typescript || fsSync.existsSync(path.join(this.workspaceRoot, 'tsconfig.json'))) {
          typeChecker = 'tsc';
        }

        if (allDeps.vite) buildTool = 'vite';
        else if (allDeps.webpack) buildTool = 'webpack';
        else if (allDeps.next) buildTool = 'next';
      } catch {}
    } else if (packageManager === 'cargo') {
      testFramework = 'cargo test';
      linter = 'cargo clippy';
      typeChecker = 'rustc';
      buildTool = 'cargo build';
    } else if (packageManager === 'go') {
      testFramework = 'go test ./...';
      linter = 'golangci-lint';
      typeChecker = 'go vet';
      buildTool = 'go build';
    } else if (packageManager?.includes('pip') || packageManager?.includes('poetry')) {
      testFramework = 'pytest';
      linter = 'ruff / flake8';
      typeChecker = 'mypy / pyright';
    }

    let dirtyFilesCount = 0;
    if (hasGit) {
      try {
        const { stdout } = await execAsync('git status --porcelain', { cwd: this.workspaceRoot });
        dirtyFilesCount = stdout.split('\n').filter(Boolean).length;
      } catch {}
    }

    return {
      hasGit,
      packageManager,
      testFramework,
      linter,
      typeChecker,
      buildTool,
      dirtyFilesCount,
    };
  }

  private async handleRunTests(params: any, startTime: number): Promise<ToolExecutionResult> {
    const health = await this.detectProjectHealth();
    let cmd = 'npm test';
    if (health.packageManager === 'cargo') cmd = 'cargo test';
    else if (health.packageManager === 'go') cmd = 'go test ./...';
    else if (health.testFramework === 'pytest') cmd = 'pytest';
    else if (params.filter) cmd = `npm test -- ${params.filter}`;

    return await this.handleRunCommand({ command: cmd }, startTime);
  }

  private async handleRunLinter(_params: any, startTime: number): Promise<ToolExecutionResult> {
    const health = await this.detectProjectHealth();
    let cmd = 'npm run lint';
    if (health.packageManager === 'cargo') cmd = 'cargo clippy';
    else if (health.linter?.includes('ruff')) cmd = 'ruff check .';
    return await this.handleRunCommand({ command: cmd }, startTime);
  }

  private async handleRunTypecheck(_params: any, startTime: number): Promise<ToolExecutionResult> {
    const health = await this.detectProjectHealth();
    let cmd = 'npx tsc --noEmit';
    if (health.packageManager === 'cargo') cmd = 'cargo check';
    else if (health.typeChecker?.includes('mypy')) cmd = 'mypy .';
    return await this.handleRunCommand({ command: cmd }, startTime);
  }

  private async handleRunBuild(_params: any, startTime: number): Promise<ToolExecutionResult> {
    const health = await this.detectProjectHealth();
    let cmd = 'npm run build';
    if (health.packageManager === 'cargo') cmd = 'cargo build';
    else if (health.packageManager === 'go') cmd = 'go build';
    return await this.handleRunCommand({ command: cmd }, startTime);
  }
}
