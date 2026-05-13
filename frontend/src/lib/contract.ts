import { ApiPromise } from "@polkadot/api";
import { ContractPromise } from "@polkadot/api-contract";
import { CHAIN_CONFIG } from "@/lib/config";

export function getGasLimit(api: ApiPromise) {
  return api.registry.createType("WeightV2", {
    refTime: CHAIN_CONFIG.GAS_LIMIT.refTime,
    proofSize: CHAIN_CONFIG.GAS_LIMIT.proofSize,
  });
}

export async function queryContract(
  contract: ContractPromise,
  api: ApiPromise,
  caller: string,
  method: string,
  args: unknown[] = []
) {
  const gasLimit = getGasLimit(api);
  const result = await (contract.query as any)[method](caller, { gasLimit }, ...args);
  if (result.result.isOk) {
    return { ok: true, value: result.output?.toHuman() };
  }
  return { ok: false, error: result.result.asErr.toString() };
}

export async function execContract(
  contract: ContractPromise,
  api: ApiPromise,
  address: string,
  signer: any,
  method: string,
  args: unknown[] = [],
  value: bigint = 0n
): Promise<string> {
  const gasLimit = getGasLimit(api);
  return new Promise((resolve, reject) => {
    let unsub: any;
    (contract.tx as any)[method](
      { gasLimit, value, storageDepositLimit: null },
      ...args
    ).signAndSend(address, { signer }, ({ status, dispatchError }: any) => {
      if (dispatchError) {
        if (unsub) unsub();
        reject(new Error(dispatchError.toString()));
        return;
      }
      if (status.isInBlock) {
        if (unsub) unsub();
        resolve(status.asInBlock.toString());
      }
    }).then((u: any) => { unsub = u; }).catch(reject);
  });
}

export function formatBalance(planck: string | number | bigint): string {
  const raw = planck.toString().replace(/,/g, "");
  const n = BigInt(raw);
  const pot = Number(n) / Number(CHAIN_CONFIG.ONE_POT);
  return pot.toFixed(4) + " POT";
}

export function toHash(input: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input.slice(0, 32).padEnd(32, "\0"));
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function getDevSigner(address: string) {
  const { Keyring } = await import("@polkadot/keyring");
  const { u8aToHex } = await import("@polkadot/util");
  const kr = new Keyring({ type: "sr25519", ss58Format: 42 });
  const uri = address === "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"
    ? "//Bob" : "//Alice";
  const pair = kr.addFromUri(uri);
  return {
    signPayload: async (payload: any) => ({
      id: payload.id,
      signature: u8aToHex(pair.sign(payload.data)),
    }),
  };
}
