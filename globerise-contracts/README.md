# GlobeRise Smart Contracts

Solidity smart contracts for the GlobeRise MLM platform built with Hardhat.

## Structure

```
globerise-contracts/
├── contracts/          # Solidity source files
│   ├── GlobeRisePlatform.sol   # Main platform contract (UUPS upgradeable)
│   └── GlobeRiseToken.sol      # GRT ERC20 token
├── test/               # Contract test files
├── scripts/            # Deployment & upgrade scripts
├── test-scripts/       # Manual testing scripts
├── docs/               # Contract documentation
├── deployments/        # Deployment addresses & info
└── hardhat.config.ts   # Hardhat configuration
```

## Prerequisites

- Node.js v18+
- npm or yarn

## Setup

```bash
cd globerise-contracts
npm install
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile contracts |
| `npm run test` | Run all tests |
| `npm run coverage` | Generate coverage report |
| `npm run node` | Start local Hardhat node |
| `npm run deploy:local` | Deploy to local network |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet |
| `npm run verify:sepolia` | Verify contracts on Etherscan |
| `npm run upgrade:sepolia` | Upgrade proxy contract |
| `npm run clean` | Clean build artifacts |

## Environment Variables

Create a `.env` file with:

```env
# Network RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# Deployer private key (without 0x prefix)
DEPLOYER_PRIVATE_KEY=your_private_key

# Etherscan API key for verification
ETHERSCAN_API_KEY=your_etherscan_key

# Gas reporter (optional)
REPORT_GAS=true
COINMARKETCAP_API_KEY=your_cmc_key
```

## Contracts

### GlobeRiseToken (GRT)
- ERC20 token with permit (gasless approvals)
- Fixed supply: 1 billion tokens
- Burnable

### GlobeRisePlatform
- UUPS upgradeable proxy pattern
- MLM investment platform
- Binary tree referral system
- Staking with tiered rewards
- Role-based access control (Admin, Operator, Upgrader)

## Documentation

See the `docs/` folder for detailed documentation:
- [Integration Guide](docs/INTEGRATION_GUIDE.md)
- [Admin Guide](docs/ADMIN_GUIDE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)

## Solidity Version

Using Solidity **0.8.30** (latest stable release)

