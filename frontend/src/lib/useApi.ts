"use client";
import { useState, useEffect } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ContractPromise } from "@polkadot/api-contract";
import { CHAIN_CONFIG } from "@/lib/config";
import ABI from "@/lib/abi.json";

export type ApiState = {
  api: ApiPromise | null;
  contract: ContractPromise | null;
  isReady: boolean;
  error: string | null;
};

export function useApi(): ApiState {
  const [state, setState] = useState<ApiState>({
    api: null, contract: null, isReady: false, error: null,
  });

  useEffect(() => {
    let api: ApiPromise;
    async function connect() {
      try {
        const provider = new WsProvider(CHAIN_CONFIG.WS_ENDPOINT);
        api = await ApiPromise.create({ provider });
        await api.isReady;
        const contract = new ContractPromise(api, ABI as any, CHAIN_CONFIG.CONTRACT_ADDRESS);
        setState({ api, contract, isReady: true, error: null });
      } catch (e: any) {
        setState(s => ({ ...s, error: e.message, isReady: false }));
      }
    }
    connect();
    return () => { api?.disconnect(); };
  }, []);

  return state;
}
