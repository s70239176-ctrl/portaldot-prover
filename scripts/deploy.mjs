
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WS_ENDPOINT = "ws://127.0.0.1:9944";
const WASM_PATH   = join(__dirname, "portaldot_prover.wasm");
const ABI_PATH    = join(__dirname, "portaldot_prover.json");
const OUT_PATH    = join(__dirname, "deployment.json");

function log(msg) { console.log(`[PortaldotProver] ${msg}`); }

async function main() {
  log(`Connecting to ${WS_ENDPOINT}...`);
  const provider = new WsProvider(WS_ENDPOINT);
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  log(`Connected: ${(await api.rpc.system.chain()).toString()}`);

  const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
  const alice   = keyring.addFromUri("//Alice");
  log(`Alice: ${alice.address}`);

  const { data: { free } } = await api.query.system.account(alice.address);
  log(`Alice balance: ${free.toHuman()}`);

  const wasmRaw = readFileSync(WASM_PATH);
  const wasm = "0x" + Buffer.from(wasmRaw).toString("hex");
  const abi  = JSON.parse(readFileSync(ABI_PATH, "utf8"));
  const selector = abi.spec.constructors[0].selector;
  log(`WASM: ${wasmRaw.length} bytes, selector: ${selector}`);
  log(`WASM hex prefix: ${wasm.slice(0,18)}...`);

  // Modern pallet: instantiateWithCode(value, gasLimit, storageDepositLimit, code, data, salt)
  // gasLimit as WeightV2
  const gasLimit = api.registry.createType("WeightV2", {
    refTime:   BigInt("30000000000"),
    proofSize: BigInt("1000000"),
  });

  log(`Submitting instantiateWithCode...`);

  const contractAddress = await new Promise((resolve, reject) => {
    let unsub;
    api.tx.contracts.instantiateWithCode(
      0,            // value
      gasLimit,     // gasLimit (WeightV2)
      null,         // storageDepositLimit (null = unlimited)
      wasm,         // code
      selector,     // data = constructor selector
      "0x"          // salt
    ).signAndSend(alice, ({ status, dispatchError, events }) => {
      if (dispatchError) {
        if (unsub) unsub();
        if (dispatchError.isModule) {
          try {
            const e = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${e.section}.${e.name}: ${e.docs.join(" ")}`));
          } catch(_) {
            reject(new Error(`Module: ${JSON.stringify(dispatchError.asModule.toHuman())}`));
          }
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock) {
        log(`In block: ${status.asInBlock}`);
        if (unsub) unsub();

        events.forEach(({ event }) => {
          log(`  ${event.section}.${event.method}: ${JSON.stringify(event.data.toHuman())}`);
        });

        const inst = events.find(({ event }) =>
          event.section === "contracts" && event.method === "Instantiated"
        );

        if (inst) {
          resolve(inst.event.data[1].toString());
          return;
        }

        const failed = events.find(({ event }) =>
          event.section === "system" && event.method === "ExtrinsicFailed"
        );
        if (failed) {
          reject(new Error(`ExtrinsicFailed: ${JSON.stringify(failed.event.data.toHuman())}`));
        } else {
          reject(new Error("No Instantiated event found"));
        }
      }
    }).then(u => { unsub = u; }).catch(reject);
  });

  log(`\n✅ Contract deployed at: ${contractAddress}`);
  writeFileSync(OUT_PATH, JSON.stringify({
    contractAddress,
    deployer: alice.address,
    network: WS_ENDPOINT,
    deployedAt: new Date().toISOString(),
  }, null, 2));

  log(`\nAdd to frontend/.env.local:`);
  log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  log(`NEXT_PUBLIC_WS_ENDPOINT=ws://127.0.0.1:9944`);

  await api.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
