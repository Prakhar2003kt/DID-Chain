import { defineConfig } from 'hardhat/config';
import toolbox from '@nomicfoundation/hardhat-toolbox-mocha-ethers';

export default defineConfig({
  plugins: [toolbox],
  solidity: { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    localhost: { type: 'http', chainType: 'l1', url: 'http://127.0.0.1:8545', chainId: 31337 },
    hardhatMainnet: { type: 'edr-simulated', chainType: 'l1' }
  },
  paths: { sources: './contracts', tests: './test' }
});
