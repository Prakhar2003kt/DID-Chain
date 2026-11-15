import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd();
const state = path.join(os.homedir(), 'Desktop', 'DID-Chain-Anvil-State', 'state.json');
const RPC = 'http://127.0.0.1:8545';

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function rpcReady() {
  try {
    const response = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: []
      }),
      signal: AbortSignal.timeout(1500)
    });

    if (!response.ok) return false;
    const result = await response.json();
    if (result.result !== '0x7a69') {
      throw new Error('Port 8545 is running a different blockchain');
    }
    return true;
  } catch (error) {
    if (error.message?.includes('different blockchain')) throw error;
    return false;
  }
}

async function waitForRpc() {
  for (let i = 0; i < 30; i++) {
    if (await rpcReady()) return;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Blockchain did not start successfully');
}

function launch(command, args) {
  return spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false
  });
}

console.log('\nDID-Chain — One-Command Demo Launch\n');

let blockchain;

if (await rpcReady()) {
  console.log('✓ Local blockchain already running');
} else {
  if (!existsSync(state) || statSync(state).size === 0) {
    throw new Error('Saved Anvil blockchain state is missing. Refusing fresh-chain startup.');
  }

  const foundry = spawnSync('anvil', ['--version'], { encoding: 'utf8' });
  if (foundry.status !== 0) {
    throw new Error('Anvil not installed or missing from PATH');
  }

  console.log('Starting persistent Anvil...');
  blockchain = launch('anvil', [
    '--host', '127.0.0.1',
    '--port', '8545',
    '--chain-id', '31337',
    '--state', state
  ]);

  await waitForRpc();
}

console.log('Checking registry, issuer and application startup...');

const app = launch(npmCommand(), ['run', 'demo:start']);

app.on('error', error => {
  console.error('Application failed:', error.message);
  process.exitCode = 1;
});

if (blockchain) {
  const shutdown = () => {
    console.log('\nStopping persistent blockchain safely...');
    blockchain.kill('SIGINT');
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

console.log('Launch initiated. Keep this Terminal running if services were started here.');
