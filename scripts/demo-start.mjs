import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { JsonRpcProvider, Contract } from 'ethers';

const RPC = 'http://127.0.0.1:8545';
const WEB = 'http://127.0.0.1:5173';

async function rpc(method, params = []) {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    }),
    signal: AbortSignal.timeout(3000)
  });

  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result.result;
}

console.log('\nDID-Chain Demo Startup\n');

if (!existsSync('web/.env')) {
  console.error('BLOCKED: web/.env is missing.');
  process.exit(1);
}

if (!existsSync('web/src/generated/deployment.json')) {
  console.error('BLOCKED: Registry deployment file is missing.');
  process.exit(1);
}

let deployment;
try {
  deployment = JSON.parse(
    readFileSync('web/src/generated/deployment.json', 'utf8')
  );
} catch {
  console.error('BLOCKED: Invalid deployment JSON.');
  process.exit(1);
}

try {
  const chainId = await rpc('eth_chainId');
  if (chainId !== '0x7a69') {
    console.error('BLOCKED: Wrong blockchain network.');
    process.exit(1);
  }

  console.log('✓ Hardhat network: 31337');

  if (!deployment.address || deployment.chainId !== 31337) {
    console.error('BLOCKED: Deployment configuration mismatch.');
    process.exit(1);
  }

  const code = await rpc('eth_getCode', [
    deployment.address,
    'latest'
  ]);

  if (!code || code === '0x') {
    console.error('BLOCKED: Registry contract missing.');
    console.error('Do not reset old credential data automatically.');
    process.exit(1);
  }

  const provider = new JsonRpcProvider(RPC);
  const registry = new Contract(
    deployment.address,
    deployment.abi,
    provider
  );

  const issuer = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const authorized = await registry.isAuthorizedIssuer(issuer);

  if (!authorized) {
    throw new Error('University issuer is not authorized on-chain');
  }

  console.log('✓ Registry contract found');
  console.log('✓ University issuer authorized');
  console.log('✓ Deployment configuration matched');
} catch (error) {
  console.error('BLOCKED: Blockchain readiness check failed.');
  console.error(error.message);
  process.exit(1);
}

try {
  const response = await fetch(WEB, {
    signal: AbortSignal.timeout(2000)
  });

  if (response.ok) {
    console.log('✓ React application already running');
    console.log(`\nOpen: ${WEB}\n`);
    process.exit(0);
  }
} catch {
  // Web server is not running; start it below.
}

console.log('Starting React application...');

const child = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: false
});

child.on('error', error => {
  console.error('Failed to start React:', error.message);
  process.exitCode = 1;
});

console.log('React startup requested.');
console.log('Keep this Terminal open while demonstrating DID-Chain.');
