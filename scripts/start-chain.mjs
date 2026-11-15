import { existsSync, statSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const state = path.join(
  os.homedir(),
  'Desktop',
  'DID-Chain-Anvil-State',
  'state.json'
);

const rpcUrl = 'http://127.0.0.1:8545';

console.log('\nDID-Chain — Persistent Blockchain Startup\n');

if (!existsSync(state) || statSync(state).size === 0) {
  console.error('BLOCKED: Saved blockchain state is missing.');
  console.error(`Expected: ${state}`);
  console.error('Refusing to create a fresh chain automatically.');
  process.exit(1);
}

console.log('✓ Saved blockchain state found');

const check = spawnSync('anvil', ['--version'], {
  encoding: 'utf8'
});

if (check.error || check.status !== 0) {
  console.error('BLOCKED: Anvil is not available in PATH.');
  process.exit(1);
}

console.log('✓ Anvil installed');

try {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_chainId',
      params: []
    }),
    signal: AbortSignal.timeout(2000)
  });

  if (response.ok) {
    console.error('Port 8545 already has a blockchain running.');
    console.error('Do not start a second node.');
    process.exit(1);
  }

  console.error('Port 8545 is occupied by another service.');
  process.exit(1);
} catch (error) {
  if (error.name === 'TimeoutError') {
    console.error('Port 8545 did not respond. Check for another process.');
    process.exit(1);
  }

  if (error.cause?.code !== 'ECONNREFUSED') {
    console.error('RPC check failed:', error.message);
    process.exit(1);
  }
}

console.log('✓ RPC port available');
console.log('Starting persistent Anvil...');
console.log('Keep this Terminal running.\n');

const child = spawn('anvil', [
  '--host', '127.0.0.1',
  '--port', '8545',
  '--chain-id', '31337',
  '--state', state
], {
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error('Anvil startup failed:', error.message);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
