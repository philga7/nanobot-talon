#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve SDK paths explicitly (esbuild can fail on package exports in some envs)
const sdkDir = join(__dirname, 'node_modules', '@modelcontextprotocol', 'sdk');
const mcpPath = join(sdkDir, 'dist', 'esm', 'server', 'mcp.js');
const stdioPath = join(sdkDir, 'dist', 'esm', 'server', 'stdio.js');
if (!existsSync(mcpPath) || !existsSync(stdioPath)) {
  console.error('MCP SDK files not found:', { mcpPath, stdioPath, mcpExists: existsSync(mcpPath), stdioExists: existsSync(stdioPath) });
  process.exit(1);
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
