import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SecurityManager } from '../src/backend/security';

describe('Dcode Security System', () => {
  const security = new SecurityManager(process.cwd());

  it('classifies rm -rf as DANGEROUS or BLOCKED', () => {
    const classification = security.classifyCommand('rm -rf ./some_dir');
    assert.strictEqual(classification.category, 'DANGEROUS');
  });

  it('classifies sudo as BLOCKED', () => {
    const classification = security.classifyCommand('sudo apt-get install');
    assert.strictEqual(classification.category, 'BLOCKED');
  });

  it('classifies npm test as SAFE', () => {
    const classification = security.classifyCommand('npm test');
    assert.strictEqual(classification.category, 'SAFE');
  });

  it('detects sensitive secret files', () => {
    assert.strictEqual(security.isSensitiveFile('.env.production'), true);
    assert.strictEqual(security.isSensitiveFile('credentials.json'), true);
    assert.strictEqual(security.isSensitiveFile('src/index.ts'), false);
  });
});
