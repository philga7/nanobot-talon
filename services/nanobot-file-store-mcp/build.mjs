#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_VERSION = '1.27.1';
const sdkDir = join(__dirname, 'node_modules', '@modelcontextprotocol', 'sdk');
const mcpPath = join(sdkDir, 'dist', 'esm', 'server', 'mcp.js');
const stdioPath = join(sdkDir, 'dist', 'esm', 'server', 'stdio.js');

if (!existsSync(mcpPath) || !existsSync(stdioPath)) {
  console.log('MCP SDK dist missing, running npm pack to extract...');
  mkdirSync(sdkDir, { recursive: true });
  const pack = spawnSync('npm', ['pack', `@modelcontextprotocol/sdk@${SDK_VERSION}`, '--silent'], {
    cwd: __dirname,
    encoding: 'utf8',
  });
  if (pack.status !== 0) {
    console.error('npm pack failed:', pack.stderr || pack.stdout);
    process.exit(1);
  }
  const tgz = pack.stdout.trim().split('\n').pop();
  const tgzPath = join(__dirname, tgz);
  const tar = spawnSync('tar', ['-xzf', tgzPath, '--strip-components=1', '-C', sdkDir, 'package/dist'], {
    cwd: __dirname,
  });
  rmSync(tgzPath, { force: true });
  if (tar.status !== 0) {
    console.error('tar extract failed');
    process.exit(1);
  }
  if (!existsSync(mcpPath) || !existsSync(stdioPath)) {
    console.error('MCP SDK dist still missing after extract');
    process.exit(1);
  }
}

mkdirSync('dist', { recursive: true });
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  banner: { js: '#!/usr/bin/env node' },
  alias: {
    '@modelcontextprotocol/sdk/server/mcp.js': mcpPath,
    '@modelcontextprotocol/sdk/server/stdio.js': stdioPath,
  },
});
console.log('Bundled to dist/index.js');
