"use client";

const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

export { WS, CONTRACT };

export async function getApi() {
  const { ApiPromise, WsProvider } = await import("@polkadot/api");
  const api = await ApiPromise.create({ provider: new WsProvider(WS) });
  await api.isReady;
  return api;
}

export async function getContract(api: any) {
  const { ContractPromise } = await import("@polkadot/api-contract");
  const ABI = await fetch("/abi.json").then(r => r.json());
  return new ContractPromise(api, ABI, CONTRACT);
}

export function getGas(api: any) {
  return api.registry.createType("WeightV2", {
    refTime: BigInt("30000000000"),
    proofSize: BigInt("1000000"),
  });
}

export async function getAlice() {
  const { Keyring } = await import("@polkadot/keyring");
  const kr = new Keyring({ type: "sr25519", ss58Format: 42 });
  return kr.addFromUri("//Alice");
}

export async function getBob() {
  const { Keyring } = await import("@polkadot/keyring");
  const kr = new Keyring({ type: "sr25519", ss58Format: 42 });
  return kr.addFromUri("//Bob");
}

export function sendTx(tx: any, account: any): Promise<void> {
  return new Promise((resolve, reject) => {
    let unsub: any;
    tx.signAndSend(account, ({ status, dispatchError }: any) => {
      if (dispatchError) {
        if (unsub) unsub();
        const msg = dispatchError.isModule
          ? JSON.stringify(dispatchError.asModule.toHuman())
          : dispatchError.toString();
        reject(new Error(msg));
        return;
      }
      if (status.isInBlock) {
        if (unsub) unsub();
        resolve();
      }
    }).then((u: any) => { unsub = u; }).catch(reject);
  });
}

export const ONE_POT = BigInt("100000000000000");
export const fmt = (p: string) => {
  try { return (Number(BigInt(p.replace(/,/g,""))) / Number(ONE_POT)).toFixed(2) + " POT"; }
  catch { return "0 POT"; }
};
