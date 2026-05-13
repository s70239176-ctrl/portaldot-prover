# PortaldotProver 🔮

> **Prove. Own. Monetize AI Models on Portaldot.**

On-chain AI Model Verification & Marketplace — built for the Portaldot ecosystem.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![ink! v5](https://img.shields.io/badge/ink!-v5.0.0-blue.svg)](https://use.ink/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Polkadot](https://img.shields.io/badge/Polkadot.js-API-E6007A.svg)](https://polkadot.js.org/)

---

## 🎯 Problem Solved

AI models lack:
- **Verifiable provenance** — who trained it, when, on what data?
- **Tamper-proof usage tracking** — who accessed it and when?
- **Practical micro-payment monetization** — Ethereum gas makes sub-$1 payments impossible

**PortaldotProver solves all three** using Portaldot's high TPS, sub-cent POT fees, and Substrate's ZKP-ready runtime.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **Model Registration** | Register AI model hash + metadata on-chain with POT stake |
| 💰 **Marketplace** | Browse and purchase access to AI models with POT |
| 🔐 **Inference Verification** | Generate tamper-proof BLAKE2b proofs of AI inference |
| 📊 **Reputation Staking** | Creators stake POT — slashable by future governance |
| 🔗 **Wallet Integration** | Polkadot.js extension + dev account fallback |
| ⚡ **Sub-cent Fees** | POT gas fees make AI micro-payments practical |

---

## 🏗️ Architecture
portaldot-prover/
├── contract/                    # ink! v5 smart contract
│   └── portaldot-prover/
│       ├── lib.rs               # Contract logic
│       ├── Cargo.toml           # ink! v5.0.0 dependencies
│       └── rust-toolchain.toml  # nightly-2025-01-10
├── frontend/                    # Next.js 16 + Tailwind
│   └── src/
│       ├── app/                 # App router pages
│       │   ├── page.tsx         # Dashboard
│       │   ├── register/        # Register model
│       │   ├── marketplace/     # Buy access
│       │   └── verify/          # Verify inference
│       └── lib/                 # Shared utilities
├── scripts/                     # Deployment scripts
│   ├── deploy.mjs               # JS deployment (Polkadot.js)
│   ├── portaldot_prover.wasm    # Compiled contract
│   └── portaldot_prover.json    # Contract ABI/metadata
└── local-node/                  # Dev node binaries
---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Rust + Cargo
- Git

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/portaldot-prover
cd portaldot-prover
```

### 2. Start the Dev Node

```bash
# Download substrate-contracts-node (supports ink! v5)
cd local-node
curl -L -o substrate-contracts-node.tar.gz \
  "https://github.com/paritytech/substrate-contracts-node/releases/download/v0.41.0/substrate-contracts-node-linux.tar.gz"
tar -xzvf substrate-contracts-node.tar.gz

# Run dev node
./artifacts/substrate-contracts-node-linux/substrate-contracts-node --dev
```

### 3. Build the Contract

```bash
cd contract/portaldot-prover

# Install nightly toolchain (required for ink! v5)
rustup toolchain install nightly-2025-01-10
rustup component add rust-src --toolchain nightly-2025-01-10
rustup target add wasm32-unknown-unknown --toolchain nightly-2025-01-10

# Build
cargo contract build --release
```

### 4. Deploy the Contract

```bash
cd scripts
npm install
node deploy.mjs
# Output: Contract deployed at: 5Xxx...
# Copy the address to frontend/.env.local
```

### 5. Configure & Run Frontend

```bash
# Set contract address
cat > frontend/.env.local << EOF
NEXT_PUBLIC_WS_ENDPOINT=ws://127.0.0.1:9944
NEXT_PUBLIC_CONTRACT_ADDRESS=<YOUR_CONTRACT_ADDRESS>
EOF

# Install and run
cd frontend
npm install
npm run dev -- --turbopack
```

Open http://localhost:3001 🎉

---

## 📜 Smart Contract

### Contract Messages

| Message | Type | Description |
|---|---|---|
| `register_model(hash, metadata, price)` | payable | Register AI model, stake POT |
| `purchase_access(model_id)` | payable | Buy access to a model |
| `verify_inference(model_id, input_hash)` | write | Generate on-chain proof |
| `withdraw_earnings()` | write | Claim creator earnings |
| `deactivate_model(model_id)` | write | Deactivate + reclaim stake |
| `get_model(model_id)` | read | Fetch model details |
| `has_access(account, model_id)` | read | Check access rights |
| `get_stats()` | read | Total models + volume |

### Proof Algorithm (MVP)
proof_hash = BLAKE2b_256(
model_hash    // 32 bytes — which model
++ input_hash // 32 bytes — which input
++ caller     // 32 bytes — who verified
++ block_num  // 4 bytes  — when
)
This deterministically binds model + input + identity + time — tamper-evident without a full ZK circuit.

### Events

```rust
ModelRegistered  { model_id, creator, price, stake }
AccessPurchased  { model_id, buyer, amount_paid }
InferenceVerified { model_id, verifier, input_hash, proof_hash }
EarningsWithdrawn { creator, amount }
```

---

## 🌐 Why Portaldot?

| Feature | Portaldot | Ethereum |
|---|---|---|
| Gas fees | Sub-cent POT | $5–$50+ |
| TPS | High | ~15 |
| Micro-payments | ✅ Practical | ❌ Uneconomical |
| ZKP support | ✅ Runtime-ready | Requires L2 |
| ink! contracts | ✅ Native | ❌ |
| Token | POT (10^14 planck) | ETH (10^18 wei) |

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | ink! v5.0.0 (Rust) |
| Blockchain | Portaldot (Substrate) |
| Contract Tooling | cargo-contract v5 |
| Frontend | Next.js 16, React 18 |
| Styling | Tailwind CSS |
| Chain Interaction | @polkadot/api, @polkadot/api-contract |
| Wallet | Polkadot.js Extension |
| Dev Node | substrate-contracts-node v0.41.0 |

---

## 🧪 Running Tests

```bash
cd contract/portaldot-prover
cargo test

# Expected output:
# test portaldot_prover::tests::test_register_model_success ... ok
# test portaldot_prover::tests::test_purchase_access_success ... ok
# test portaldot_prover::tests::test_verify_inference_with_access ... ok
# ... (9 tests total)
# test result: ok. 9 passed; 0 failed
```

---

## 🗺️ Roadmap

### MVP (Current)
- [x] On-chain model registration with hash + metadata
- [x] POT-gated access marketplace
- [x] BLAKE2b inference verification proof
- [x] Creator earnings + staking
- [x] React/Next.js frontend with wallet integration

### v2 — ZKP Integration
- [ ] zk-SNARK proof of model training (ZKP of weights)
- [ ] Verifiable inference with ZK circuits
- [ ] Privacy-preserving model execution

### v3 — Ecosystem
- [ ] DAO governance for creator reputation slashing
- [ ] Multi-sig model ownership
- [ ] Cross-chain model registry via XCM
- [ ] IPFS integration for decentralized model storage
- [ ] Model versioning and upgrade paths

---

## 📹 Demo Video

[▶️ Watch Demo](https://youtu.be/PLACEHOLDER)

---

## 🤝 Contributing

Pull requests welcome. For major changes, open an issue first.

---

## 📄 License

MIT © 2025 PortaldotProver Team

---

*Built with ❤️ for the Portaldot Hackathon 2025*
