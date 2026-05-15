// Runs inside the node container on startup
// Deploys contract automatically after node is ready
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { readFileSync, writeFileSync } from "fs";

const WS = "ws://127.0.0.1:9944";

async function deploy() {
  const api = await ApiPromise.create({ provider: new WsProvider(WS) });
  await api.isReady;

  const kr = new Keyring({ type: "sr25519", ss58Format: 42 });
  const alice = kr.addFromUri("//Alice");
  const wasm = "0x" + Buffer.from(readFileSync("/app/portaldot_prover.wasm")).toString("hex");
  const gas = api.registry.createType("WeightV2", {
    refTime: BigInt("30000000000"), proofSize: BigInt("1000000"),
  });

  const addr = await new Promise((resolve, reject) => {
    let unsub;
    api.tx.contracts.instantiateWithCode(
      0, gas, null, wasm, "0x9bae9d5e", "0x"
    ).signAndSend(alice, ({ status, dispatchError, events }) => {
      if (dispatchError) { if(unsub)unsub(); reject(new Error(dispatchError.toString())); return; }
      if (status.isInBlock) {
        if(unsub)unsub();
        const inst = events.find(({event}) => event.section==="contracts" && event.method==="Instantiated");
        if (inst) resolve(inst.event.data[1].toString());
        else reject(new Error("No Instantiated event"));
      }
    }).then(u=>{unsub=u;}).catch(reject);
  });

  console.log("CONTRACT_ADDRESS=" + addr);
  writeFileSync("/app/contract_address.txt", addr);
  await api.disconnect();
}

deploy().catch(e => { console.error("Auto-deploy failed:", e.message); process.exit(0); });
