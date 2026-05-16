"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const ONE_POT = BigInt("100000000000000");

function fmt(planck: string) {
  try { return (Number(BigInt(planck.replace(/,/g,""))) / Number(ONE_POT)).toFixed(2) + " POT"; }
  catch { return "0 POT"; }
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!CONTRACT) { setLoading(false); return; }
    (async () => {
      try {
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        const { ContractPromise } = await import("@polkadot/api-contract");
        const ABI = await fetch("/abi.json").then(r => r.json());
        const api = await ApiPromise.create({ provider: new WsProvider(WS) });
        await api.isReady;
        setConnected(true);
        const contract = new ContractPromise(api, ABI, CONTRACT);
        const gas = api.registry.createType("WeightV2", { refTime: BigInt("30000000000") as any, proofSize: BigInt("1000000") });
        const caller = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
        const sr = await (contract.query as any).getStats(caller, { gasLimit: gas });
        if (sr.result.isOk) { const v = sr.output?.toHuman() as any; if (Array.isArray(v)) setStats({ models: v[0], volume: v[1] }); }
        const ir = await (contract.query as any).listModelIds(caller, { gasLimit: gas }, 0, 10);
        if (ir.result.isOk) {
          const ids = ir.output?.toHuman() as any[] || [];
          const out: any[] = [];
          for (const id of ids) {
            const mr = await (contract.query as any).getModel(caller, { gasLimit: gas }, Number(id));
            if (mr.result.isOk && mr.output) { const v = mr.output.toHuman() as any; if (v) out.push({ id: Number(id), ...v }); }
          }
          setModels(out);
        }
        await api.disconnect();
      } catch(e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      {/* Hero */}
      <div className="fade-up" style={{ textAlign: "center", padding: "60px 0 48px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)",
          borderRadius: 100, padding: "4px 14px", marginBottom: 24,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
          <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Live on Portaldot
          </span>
        </div>
        <h1 className="display fade-up-1" style={{
          fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 800,
          lineHeight: 1.05, letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #f8f6ff 30%, #a78bfa 70%, #7c3aed 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: 16,
        }}>
          AI Model Verification<br />& Marketplace
        </h1>
        <p className="fade-up-2" style={{ fontSize: 18, color: "var(--text-secondary)", maxWidth: 520, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Register, sell, and verify AI models on-chain. Tamper-proof provenance.
          Sub-cent POT fees. Powered by Portaldot.
        </p>
        <div className="fade-up-3" style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/register" className="btn-primary" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 28px", borderRadius: 10,
            color: "white", fontWeight: 600, fontSize: 15,
            textDecoration: "none",
          }}>
            <span>⊕</span> Register Model
          </Link>
          <Link href="/marketplace" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 28px", borderRadius: 10,
            color: "var(--violet-glow)", fontWeight: 600, fontSize: 15,
            textDecoration: "none",
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.3)",
            transition: "all 0.2s",
          }}>
            Browse Marketplace →
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 48 }}>
        {[
          { label: "Total Models", value: stats?.models ?? (loading ? "—" : "0"), icon: "◈", color: "#7c3aed" },
          { label: "Total Volume", value: stats ? fmt(stats.volume.replace(/,/g,"")) : (loading ? "—" : "0 POT"), icon: "◆", color: "#f59e0b" },
          { label: "Network Status", value: connected ? "Connected" : loading ? "Connecting..." : "Offline", icon: "◉", color: "#10b981" },
        ].map((s, i) => (
          <div key={s.label} className="stat-card fade-up" style={{ animationDelay: `${i*0.1}s` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</span>
              <span style={{ fontSize: 20, color: s.color, opacity: 0.7 }}>{s.icon}</span>
            </div>
            <div className="display" style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {s.value}
            </div>
            <div style={{ marginTop: 8, height: 2, background: `linear-gradient(90deg, ${s.color}40, transparent)`, borderRadius: 1 }} />
          </div>
        ))}
      </div>

      {/* Models */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          Registered Models
        </h2>
        <Link href="/register" style={{
          fontSize: 13, color: "var(--violet-glow)", textDecoration: "none", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 4,
        }}>⊕ Register new</Link>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>◌</div>
          Loading chain data...
        </div>
      ) : models.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "80px 0",
          background: "rgba(13,10,30,0.6)", border: "1px dashed var(--border)",
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>No models registered yet.</p>
          <Link href="/register" style={{
            display: "inline-flex", padding: "10px 24px", borderRadius: 8,
            background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)",
            color: "var(--violet-glow)", textDecoration: "none", fontWeight: 600, fontSize: 14,
          }}>Register the first model →</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {models.map((m: any, i) => {
            let meta: any = {};
            try { meta = JSON.parse(m.metadata); } catch {}
            return (
              <div key={m.id} className="model-card fade-up" style={{ animationDelay: `${i*0.05}s` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span className="display" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                        {meta.name || `Model #${m.id}`}
                      </span>
                      {m.isActive && <span className="badge badge-green">● Active</span>}
                      {meta.version && <span className="badge badge-violet">v{meta.version}</span>}
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 10, lineHeight: 1.5 }}>
                      {meta.description || "No description provided"}
                    </p>
                    <div style={{ display: "flex", gap: 20 }}>
                      {[
                        { label: "ID", value: `#${m.id}` },
                        { label: "Creator", value: m.creator?.slice(0,8)+"..." },
                        { label: "Buyers", value: m.totalPurchases || "0" },
                        { label: "Verifications", value: m.totalVerifications || "0" },
                      ].map(d => (
                        <div key={d.label}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>{d.label}</div>
                          <div className="mono" style={{ fontSize: 13, color: "var(--text-secondary)" }}>{d.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", marginLeft: 24 }}>
                    <div className="display text-gold" style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
                      {fmt(m.price?.replace(/,/g,"") || "0")}
                    </div>
                    <Link href="/marketplace" style={{
                      display: "inline-block", padding: "8px 18px", borderRadius: 7,
                      background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)",
                      color: "var(--violet-glow)", textDecoration: "none",
                      fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                    }}>Buy Access</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Why Portaldot */}
      <div style={{
        marginTop: 64,
        background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(79,70,229,0.06))",
        border: "1px solid rgba(124,58,237,0.2)",
        borderRadius: 16, padding: "40px 48px",
      }}>
        <h3 className="display" style={{ fontSize: 22, fontWeight: 800, marginBottom: 32, textAlign: "center", color: "var(--text-primary)" }}>
          Why Portaldot?
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32 }}>
          {[
            { icon: "💸", title: "Sub-cent Fees", desc: "POT gas makes AI micro-payments practical. What costs $50 on Ethereum costs fractions of a cent here.", color: "#f59e0b" },
            { icon: "🔐", title: "Tamper-proof Proofs", desc: "BLAKE2b proofs bind model + input + caller + block. Permanently stored. Publicly verifiable.", color: "#7c3aed" },
            { icon: "⚡", title: "High Throughput", desc: "Fast block times enable real-time inference verification at scale.", color: "#06b6d4" },
          ].map(f => (
            <div key={f.title} style={{ textAlign: "center" }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: `${f.color}18`, border: `1px solid ${f.color}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, margin: "0 auto 16px",
              }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
