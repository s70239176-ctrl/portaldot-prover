# PortaldotProver — Demo Video Script
## Duration: ~2.5 minutes | Format: Screen recording + narration

---

### SCENE 1 — Hook (0:00–0:20)
**Screen:** Title card — "PortaldotProver: On-chain AI Model Verification"
**Narration:**
"AI models are black boxes. You don't know who trained them, whether
they've been tampered with, or if you're paying for the real thing.
PortaldotProver solves this — using Portaldot's blockchain to make
AI models verifiable, ownable, and monetizable. With sub-cent fees,
this is finally practical."

---

### SCENE 2 — Problem (0:20–0:35)
**Screen:** Split screen — Ethereum gas fee ($45) vs Portaldot fee (< $0.01)
**Narration:**
"On Ethereum, a single contract interaction costs $5 to $50 in gas.
AI micro-payments are impossible. Portaldot changes that —
transactions cost fractions of a cent in POT."

---

### SCENE 3 — Architecture (0:35–0:50)
**Screen:** Show the repo structure briefly, then the ink! contract code
**Narration:**
"The core is an ink! smart contract deployed on Portaldot.
It stores model hashes, tracks access rights, and generates
cryptographic proofs — all on-chain, all auditable."

---

### SCENE 4 — Dashboard (0:50–1:05)
**Screen:** Open http://localhost:3001 — show the dashboard
**Narration:**
"This is the PortaldotProver marketplace. The dashboard shows
registered models, total volume in POT, and live chain status.
The node is running locally — in production this connects to
Portaldot mainnet."

---

### SCENE 5 — Register Model (1:05–1:25)
**Screen:** Navigate to /register, fill in form, submit
**Narration:**
"As an AI creator, I register my model — giving it a name,
description, IPFS CID pointing to the weights, and a price.
I stake 1 POT as reputation. Watch the transaction confirm
in about 6 seconds — that's Portaldot's block time."
**Action:** Fill form with "GPT-Mini-Demo", submit, show success message

---

### SCENE 6 — Marketplace (1:25–1:45)
**Screen:** Navigate to /marketplace, show model card, click Buy Access
**Narration:**
"The model appears in the marketplace instantly. A buyer
pays the listed POT price to unlock access. The payment
goes directly to the creator's on-chain earnings balance.
No intermediaries. No platform fees."
**Action:** Click Buy Access, show transaction confirming, badge changes to "✓ Owned"

---

### SCENE 7 — Verify Inference (1:45–2:10)
**Screen:** Navigate to /verify, enter model ID and input data, submit
**Narration:**
"Now the powerful part — inference verification. The buyer
submits their input data. The contract computes a BLAKE2b proof
binding the model hash, the input, the caller's address,
and the current block number. This proof is stored permanently
on-chain."
**Action:** Enter "What is 2+2?" as input, submit, show the proof panel
**Narration:**
"Anyone can verify this proof later. The creator can't deny
the model was used. The buyer can prove exactly what input
they submitted. This is verifiable AI provenance."

---

### SCENE 8 — On-chain Events (2:10–2:25)
**Screen:** Show Portaldot explorer with InferenceVerified event
**Narration:**
"Every action emits on-chain events — ModelRegistered,
AccessPurchased, InferenceVerified. These form an immutable
audit trail. Future ZKP integration will replace the BLAKE2b
proof with a full zk-SNARK — but the architecture is ready today."

---

### SCENE 9 — Close (2:25–2:35)
**Screen:** Return to dashboard showing stats updated
**Narration:**
"PortaldotProver — prove, own, and monetize AI models
on Portaldot. Sub-cent fees. Tamper-proof provenance.
Built with ink!, deployed on Portaldot. The code is
open source. Links in the description."
**Screen:** GitHub URL + "Prove. Own. Monetize."

---

## Recording Tips
- Use OBS or Loom for screen recording
- Run node in background terminal (hide it)
- Pre-fund Bob account so marketplace purchase works instantly
- Use Chrome with Polkadot.js extension installed
- Record at 1920x1080, export at 1080p
- Add upbeat background music at 20% volume
