import { PluginDefinition } from '../../shared/types.js';

export class PluginManager {
  private plugins: Map<string, PluginDefinition> = new Map();

  constructor() {
    this.initDefaultMarketplace();
  }

  private initDefaultMarketplace(): void {
    const defaults: PluginDefinition[] = [
      {
        id: 'dcode-git-lens',
        name: 'Dcode Git Lens Pro',
        version: '1.2.0',
        description: 'Supercharge Git workflows with inline blame, visual commit graphs, and PR generation.',
        author: 'Dcode Core Team',
        icon: 'git',
        enabled: true,
        category: 'productivity',
        downloads: 14200,
        rating: 4.9,
      },
      {
        id: 'dcode-test-copilot',
        name: 'Autonomous Test Synthesizer',
        version: '2.0.1',
        description: 'Auto-generates comprehensive unit and edge-case integration tests for any selected function.',
        author: 'AI Labs',
        icon: 'test',
        enabled: true,
        category: 'testing',
        downloads: 8930,
        rating: 4.8,
      },
      {
        id: 'dcode-security-shield',
        name: 'Vulnerability & Secret Hunter',
        version: '1.4.0',
        description: 'Continuous static security scans for leaked credentials, SQLi, and OWASP top 10 flaws.',
        author: 'CyberGuard',
        icon: 'security',
        enabled: true,
        category: 'security',
        downloads: 19500,
        rating: 5.0,
      },
      {
        id: 'dcode-docker-companion',
        name: 'Container & Cloud Deployer',
        version: '1.0.5',
        description: 'Generates production Dockerfiles, docker-compose setups, and one-click Kubernetes manifests.',
        author: 'CloudOps',
        icon: 'docker',
        enabled: false,
        category: 'productivity',
        downloads: 6410,
        rating: 4.7,
      },
      {
        id: 'dcode-theme-cyberpunk',
        name: 'Cyberpunk Obsidian Theme',
        version: '1.0.0',
        description: 'High-contrast neon dark theme tuned for developer focus and OLED displays.',
        author: 'Dcode Design',
        icon: 'theme',
        enabled: false,
        category: 'theme',
        downloads: 11200,
        rating: 4.8,
      },
    ];

    defaults.forEach(p => this.plugins.set(p.id, p));
  }

  public getPlugins(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }

  public togglePlugin(id: string): PluginDefinition | undefined {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.enabled = !plugin.enabled;
      return plugin;
    }
    return undefined;
  }

  public installPlugin(plugin: PluginDefinition): PluginDefinition {
    this.plugins.set(plugin.id, { ...plugin, enabled: true });
    return plugin;
  }
}
