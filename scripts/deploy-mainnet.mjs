#!/usr/bin/env node
// deploy-mainnet.mjs
// Runs once after node starts — deploys contract and saves address

import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use Railway's internal node URL, or external if set
const WS = process.env.NODE_WS_URL || "ws://localhost:9944";
const MAX_RETRIES = 30;
const RETRY_DELAY = 5000;

function log(msg) { console.log(`[Deploy] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForNode() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      log(`Attempting connection to ${WS} (attempt ${i+1}/${MAX_RETRIES})...`);
      const provider = new WsProvider(WS);
      const api = await ApiPromise.create({ provider });
      await api.isReady;
      log("Node is ready!");
      return api;
    } catch(e) {
      log(`Node not ready: ${e.message}`);
      await sleep(RETRY_DELAY);
    }
  }
  throw new Error("Node never became ready");
}

async function main() {
  const api = await waitForNode();
  
  const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
  const alice = keyring.addFromUri("//Alice");
  log(`Deploying from Alice: ${alice.address}`);

  const wasmPath = join(__dirname, "portaldot_prover.wasm");
  const wasmRaw = readFileSync(wasmPath);
  const wasm = "0x" + Buffer.from(wasmRaw).toString("hex");
  log(`WASM loaded: ${wasmRaw.length} bytes`);

  // Check if already deployed
  const deploymentPath = join(__dirname, "deployment.json");
  try {
    const existing = JSON.parse(readFileSync(deploymentPath, "utf8"));
    if (existing.contractAddress) {
      // Verify it still exists on chain
      const info = await api.query.contracts.contractInfoOf(existing.contractAddress);
      if (info.isSome) {
        log(`Contract already deployed at: ${existing.contractAddress}`);
        await api.disconnect();
        return existing.contractAddress;
      }
    }
  } catch(e) { /* not deployed yet */ }

  const gasLimit = api.registry.createType("WeightV2", {
    refTime: BigInt("30000000000"),
    proofSize: BigInt("1000000"),
  });

  log("Deploying contract...");

  const contractAddress = await new Promise((resolve, reject) => {
    let unsub;
    api.tx.contracts.instantiateWithCode(
      0,
      gasLimit,
      null,
      wasm,
      "0x9bae9d5e",
      "0x"
    ).signAndSend(alice, ({ status, dispatchError, events }) => {
      if (dispatchError) {
        if (unsub) unsub();
        reject(new Error(dispatchError.toString()));
        return;
      }
      if (status.isInBlock) {
        if (unsub) unsub();
        log(`In block: ${status.asInBlock}`);
        events.forEach(({ event }) => {
          log(`  ${event.section}.${event.method}`);
        });
        const inst = events.find(({ event }) =>
          event.section === "contracts" && event.method === "Instantiated"
        );
        if (inst) {
          resolve(inst.event.data[1].toString());
        } else {
          reject(new Error("No Instantiated event"));
        }
      }
    }).then(u => { unsub = u; }).catch(reject);
  });

  log(`\n✅ Contract deployed: ${contractAddress}`);
  
  writeFileSync(deploymentPath, JSON.stringify({
    contractAddress,
    deployer: alice.address,
    network: WS,
    deployedAt: new Date().toISOString(),
  }, null, 2));

  // Write to a location the frontend can read
  writeFileSync("/tmp/contract_address.txt", contractAddress);
  
  await api.disconnect();
  return contractAddress;
}

main()
  .then(addr => { log(`Done: ${addr}`); process.exit(0); })
  .catch(err => { console.error("Failed:", err.message); process.exit(1); });
