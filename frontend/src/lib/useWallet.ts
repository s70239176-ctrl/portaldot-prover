"use client";
import { useState, useCallback } from "react";

export type Account = { address: string; name: string; source: string };

export function useWallet() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
      const extensions = await web3Enable("PortaldotProver");
      if (!extensions.length) {
        const devAccounts: Account[] = [
          { address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", name: "Alice (Dev)", source: "dev" },
          { address: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", name: "Bob (Dev)", source: "dev" },
        ];
        setAccounts(devAccounts);
        setSelected(devAccounts[0]);
        setError("No wallet extension — using dev accounts");
        return;
      }
      const accs = await web3Accounts();
      const mapped = accs.map(a => ({
        address: a.address,
        name: a.meta.name || "Unknown",
        source: a.meta.source || "unknown",
      }));
      setAccounts(mapped);
      if (mapped.length > 0) setSelected(mapped[0]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  return { accounts, selected, setSelected, connect, isConnecting, error };
}
