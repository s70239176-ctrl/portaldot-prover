// @ts-nocheck
"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const ONE_POT = BigInt("100000000000000");
const fmt = (p) => { try{return (Number(BigInt(p.replace(/,/g,"")))/Number(ONE_POT)).toFixed(2)+" POT";}catch{return "0 POT";} };

export default function MarketplacePage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [msg, setMsg] = useState(null);
  const [access, setAccess] = useState({});
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const caller = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const {ApiPromise, WsProvider} = await import("@polkadot/api");
      const {ContractPromise} = await import("@polkadot/api-contract");
      const ABI = await fetch("/abi.json").then(r=>r.json());
      const api = await ApiPromise.create({provider: new WsProvider(WS)});
      await api.isReady;
      const contract = new ContractPromise(api, ABI, CONTRACT);
      const gas = api.registry.createType("WeightV2", {
        refTime: BigInt("30000000000"), proofSize: BigInt("1000000")
      });

      const ir = await contract.query.listModelIds(caller, {gasLimit: gas}, 0, 20);
      const ids = ir.output?.toHuman()?.Ok || ir.output?.toHuman() || [];

      const out = [];
      const acc = {};
      for (const id of ids) {
        const mr = await contract.query.getModel(caller, {gasLimit: gas}, Number(id));
        const raw = mr.output?.toHuman();
        const v = raw?.Ok || raw;
        if (v) out.push({id: Number(id), ...v});

        const ar = await contract.query.hasAccess(caller, {gasLimit: gas}, caller, Number(id));
        const accessRaw = ar.output?.toHuman();
        acc[Number(id)] = accessRaw?.Ok === true;
      }
      setModels(out);
      setAccess(acc);
      await api.disconnect();
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [lastRefresh]);

  useEffect(() => { loadModels(); }, [loadModels]);

  async function buy(m) {
    setBuying(m.id); setMsg(null);
    try {
      const {ApiPromise, WsProvider} = await import("@polkadot/api");
      const {ContractPromise} = await import("@polkadot/api-contract");
      const {Keyring} = await import("@polkadot/keyring");
      const ABI = await fetch("/abi.json").then(r=>r.json());
      const api = await ApiPromise.create({provider: new WsProvider(WS)});
      await api.isReady;
      const contract = new ContractPromise(api, ABI, CONTRACT);
      const gas = api.registry.createType("WeightV2", {
        refTime: BigInt("30000000000"), proofSize: BigInt("1000000")
      });
      const kr = new Keyring({type: "sr25519", ss58Format: 42});
      const bob = kr.addFromUri("//Bob");
      const price = BigInt((m.price || "0").replace(/,/g,""));

      await new Promise((resolve, reject) => {
        let unsub;
        contract.tx.purchaseAccess(
          {gasLimit: gas, value: price, storageDepositLimit: null}, m.id
        ).signAndSend(bob, ({status, dispatchError}) => {
          if (dispatchError) { if(unsub)unsub(); reject(new Error(JSON.stringify(dispatchError.toHuman()))); return; }
          if (status.isInBlock) { if(unsub)unsub(); resolve(); }
        }).then(u=>{unsub=u;}).catch(reject);
      });
      await api.disconnect();
      setAccess(a => ({...a, [m.id]: true}));
      setMsg({id: m.id, text: "✅ Access purchased! You can now verify inferences.", ok: true});
    } catch(e) { setMsg({id: m.id, text: e.message, ok: false}); }
    setBuying(null);
  }

  return (
    <div>
      <div className="fade-up" style={{marginBottom:40}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <Link href="/" style={{color:"var(--text-muted)",fontSize:13,textDecoration:"none"}}>Dashboard</Link>
              <span style={{color:"var(--text-muted)"}}>›</span>
              <span style={{color:"var(--violet-glow)",fontSize:13}}>Marketplace</span>
            </div>
            <h1 className="display" style={{fontSize:36,fontWeight:800,letterSpacing:"-0.02em",marginBottom:8}}>
              AI Model Marketplace
            </h1>
            <p style={{color:"var(--text-secondary)",fontSize:15}}>
              Purchase access to verified AI models. Pay once, verify infinitely.
            </p>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setLastRefresh(Date.now())}
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 16px",borderRadius:8,
                background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.3)",
                color:"var(--violet-glow)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"Space Grotesk,sans-serif"}}>
              ↻ Refresh
            </button>
            <Link href="/register" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 20px",
              borderRadius:8,background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.4)",
              color:"var(--violet-glow)",textDecoration:"none",fontSize:13,fontWeight:600}}>
              ⊕ Register Model
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:"100px 0",color:"var(--text-muted)"}}>
          <div style={{fontSize:40,marginBottom:12,opacity:0.4}}>◌</div>
          Loading marketplace...
        </div>
      ) : models.length === 0 ? (
        <div style={{textAlign:"center",padding:"100px 0",background:"rgba(13,10,30,0.6)",
          border:"1px dashed var(--border)",borderRadius:16}}>
          <div style={{fontSize:56,marginBottom:16}}>🤖</div>
          <p style={{color:"var(--text-secondary)",marginBottom:20,fontSize:16}}>No models yet.</p>
          <Link href="/register" style={{display:"inline-flex",padding:"10px 24px",borderRadius:8,
            background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.4)",
            color:"var(--violet-glow)",textDecoration:"none",fontWeight:600}}>
            Register First Model
          </Link>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {models.map((m, i) => {
            let meta = {};
            try { meta = JSON.parse(m.metadata); } catch {}
            const owned = access[m.id];
            const isActive = m.isActive === true || m.isActive === "true";
            return (
              <div key={m.id} className="model-card fade-up" style={{animationDelay:`${i*0.06}s`}}>
                <div style={{display:"flex",gap:24,alignItems:"flex-start"}}>
                  <div style={{width:56,height:56,borderRadius:14,flexShrink:0,
                    background:"linear-gradient(135deg,rgba(124,58,237,0.3),rgba(79,70,229,0.3))",
                    border:"1px solid rgba(124,58,237,0.3)",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:26}}>🤖</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <span className="display" style={{fontSize:19,fontWeight:700}}>
                        {meta.name || `Model #${m.id}`}
                      </span>
                      {isActive && <span className="badge badge-green">● Active</span>}
                      {owned && <span className="badge badge-violet">✓ Owned</span>}
                      {meta.version && <span className="badge" style={{background:"rgba(6,182,212,0.1)",color:"#67e8f9",border:"1px solid rgba(6,182,212,0.3)"}}>v{meta.version}</span>}
                    </div>
                    <p style={{color:"var(--text-muted)",fontSize:14,marginBottom:12,lineHeight:1.5}}>
                      {meta.description || "No description"}
                    </p>
                    <div style={{display:"flex",gap:24}}>
                      {[
                        {label:"ID", val:`#${m.id}`},
                        {label:"Creator", val:(m.creator||"").slice(0,8)+"..."},
                        {label:"Buyers", val:m.totalPurchases||"0"},
                        {label:"Verifications", val:m.totalVerifications||"0"},
                      ].map(d=>(
                        <div key={d.label}>
                          <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,
                            letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:2}}>{d.label}</div>
                          <div className="mono" style={{fontSize:12,color:"var(--text-secondary)"}}>{d.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,minWidth:140}}>
                    <div className="display text-gold" style={{fontSize:26,fontWeight:800,marginBottom:12}}>
                      {fmt((m.price||"0").replace(/,/g,""))}
                    </div>
                    {owned ? (
                      <Link href={`/verify?id=${m.id}`} style={{display:"block",padding:"10px 20px",
                        borderRadius:8,textAlign:"center",background:"rgba(6,182,212,0.15)",
                        border:"1px solid rgba(6,182,212,0.4)",color:"#67e8f9",textDecoration:"none",
                        fontSize:13,fontWeight:600}}>
                        Verify Inference →
                      </Link>
                    ) : (
                      <button onClick={()=>buy(m)} disabled={buying===m.id||!isActive}
                        className="btn-primary"
                        style={{width:"100%",padding:"10px 20px",borderRadius:8,color:"white",
                          fontWeight:600,fontSize:13,border:"none",cursor:"pointer",
                          fontFamily:"Space Grotesk,sans-serif",opacity:buying===m.id?0.7:1}}>
                        {buying===m.id ? "⟳ Buying..." : "Buy Access"}
                      </button>
                    )}
                  </div>
                </div>
                {msg?.id===m.id && (
                  <div style={{marginTop:16,padding:"10px 14px",borderRadius:8,fontSize:13,
                    background:msg.ok?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",
                    border:`1px solid ${msg.ok?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`,
                    color:msg.ok?"#34d399":"#f87171"}}>
                    {msg.text}
                    {msg.ok && <Link href={`/verify?id=${m.id}`} style={{marginLeft:8,color:"#67e8f9",textDecoration:"underline"}}>Verify now →</Link>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
