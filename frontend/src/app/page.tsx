"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Dashboard() {
  const [stats, setStats] = useState<{models: string, volume: string} | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
  const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
  const ONE_POT = BigInt("100000000000000");

  function formatBalance(planck: string) {
    try {
      const n = BigInt(planck.replace(/,/g, ""));
      return (Number(n) / Number(ONE_POT)).toFixed(4) + " POT";
    } catch { return "0 POT"; }
  }

  useEffect(() => {
    if (!CONTRACT) { setLoading(false); return; }
    (async () => {
      try {
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        const { ContractPromise } = await import("@polkadot/api-contract");
        const ABI = await fetch("/abi.json").then(r => r.json());
        const api = await ApiPromise.create({ provider: new WsProvider(WS) });
        await api.isReady;
        setIsConnected(true);
        const contract = new ContractPromise(api, ABI, CONTRACT);
        const gasLimit = api.registry.createType("WeightV2", {
          refTime: BigInt("30000000000"), proofSize: BigInt("1000000"),
        });
        const caller = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
        const s = await (contract.query as any).getStats(caller, { gasLimit });
        if (s.result.isOk) {
          const v = s.output?.toHuman() as any;
          if (Array.isArray(v)) setStats({ models: v[0], volume: v[1] });
        }
        const ids = await (contract.query as any).listModelIds(caller, { gasLimit }, 0, 20);
        if (ids.result.isOk) {
          const idList = ids.output?.toHuman() as any[] || [];
          const out = [];
          for (const id of idList) {
            const m = await (contract.query as any).getModel(caller, { gasLimit }, Number(id));
            if (m.result.isOk && m.output) {
              const v = m.output.toHuman() as any;
              if (v) out.push({ id: Number(id), ...v });
            }
          }
          setModels(out);
        }
        await api.disconnect();
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [WS, CONTRACT]);

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16 mb-10">
        <div className="text-6xl mb-4">🔮</div>
        <h1 className="text-5xl font-bold text-white mb-3">PortaldotProver</h1>
        <p className="text-xl text-purple-300 mb-2">On-chain AI Model Verification & Marketplace</p>
        <p className="text-gray-400 max-w-lg mx-auto text-sm mb-8">
          Prove. Own. Monetize AI Models on Portaldot. Sub-cent POT fees make AI micro-payments practical.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/register"
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-colors">
            Register Model
          </Link>
          <Link href="/marketplace"
            className="border border-purple-600 hover:bg-purple-900/50 text-white px-8 py-3 rounded-lg font-medium transition-colors">
            Browse Marketplace
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: "Total Models", value: stats?.models ?? "—", icon: "🤖" },
          { label: "Total Volume", value: stats ? formatBalance(stats.volume.replace(/,/g,"")) : "—", icon: "💰" },
          { label: "Network", value: isConnected ? "● Connected" : "Connecting...", icon: "🔗" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-gray-500 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Models */}
      <h2 className="text-xl font-bold text-white mb-4">Registered Models</h2>
      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading chain data...</div>
      ) : !CONTRACT ? (
        <div className="text-center py-16 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-yellow-400">Contract address not configured.</p>
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 rounded-xl border border-gray-800">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-gray-400 mb-4">No models registered yet.</p>
          <Link href="/register" className="text-purple-400 hover:underline">Register the first model →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {models.map((m: any) => {
            let meta: any = {};
            try { meta = JSON.parse(m.metadata); } catch {}
            return (
              <div key={m.id} className="bg-gray-900 border border-gray-800 hover:border-purple-800 rounded-xl p-5 flex items-center justify-between transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold">{meta.name || `Model #${m.id}`}</span>
                    {m.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">Active</span>}
                  </div>
                  <p className="text-gray-400 text-sm">{meta.description || "No description"}</p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-600">
                    <span>#{m.id}</span>
                    <span>{m.creator?.slice(0,8)}...</span>
                    <span>{m.totalPurchases} buyers</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-purple-400 font-bold text-lg mb-1">
                    {formatBalance(m.price?.replace(/,/g,"") || "0")}
                  </div>
                  <Link href="/marketplace" className="text-xs text-purple-400 hover:underline">Buy Access →</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Why Portaldot */}
      <div className="mt-12 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-bold mb-4">⚡ Why Portaldot?</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            { icon: "💸", title: "Sub-cent Fees", desc: "POT gas makes AI micro-payments practical" },
            { icon: "🔐", title: "Tamper-proof", desc: "BLAKE2b proofs stored permanently on-chain" },
            { icon: "🚀", title: "High TPS", desc: "Fast block times for real-time verification" },
          ].map(f => (
            <div key={f.title} className="text-center">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-white font-medium mb-1">{f.title}</div>
              <div className="text-gray-400 text-xs">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
