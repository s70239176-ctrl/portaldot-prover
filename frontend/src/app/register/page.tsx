"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const ONE_POT = BigInt("100000000000000");

export default function RegisterPage() {
  const [form, setForm] = useState({name:"",desc:"",cid:"",version:"1.0.0",price:"1",stake:"1"});
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [chainReady, setChainReady] = useState("connecting");
  const refs = useRef<any>({});

  const f = (k: string) => (e: any) => setForm((p:any) => ({...p,[k]:e.target.value}));

  useEffect(() => {
    if (!CONTRACT) { setChainReady("failed"); setMessage("Contract address not set"); return; }
    (async () => {
      try {
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        const { ContractPromise } = await import("@polkadot/api-contract");
        const { Keyring } = await import("@polkadot/keyring");
        const ABI = await fetch("/abi.json").then(r => r.json());
        const api = await ApiPromise.create({ provider: new WsProvider(WS) });
        await api.isReady;
        const contract = new ContractPromise(api, ABI, CONTRACT);
        const kr = new Keyring({ type: "sr25519", ss58Format: 42 });
        refs.current = { api, contract, alice: kr.addFromUri("//Alice") };
        setChainReady("ready");
      } catch(e:any) { setChainReady("failed"); setMessage(e.message); setStatus("error"); }
    })();
    return () => refs.current.api?.disconnect();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (chainReady !== "ready") return;
    setStatus("loading"); setMessage("Submitting transaction...");
    try {
      const { api, contract, alice } = refs.current;
      const gas = api.registry.createType("WeightV2",{refTime:BigInt("30000000000") as any,proofSize:BigInt("1000000")}) as any;
      const metadata = JSON.stringify({name:form.name,description:form.desc,ipfs_cid:form.cid,version:form.version});
      const bytes = new TextEncoder().encode(form.name.padEnd(32,"\0").slice(0,32));
      const modelHash = "0x"+Array.from(bytes).map((b:number)=>b.toString(16).padStart(2,"0")).join("");
      const price = BigInt(Math.floor(parseFloat(form.price)*Number(ONE_POT)));
      const stake = BigInt(Math.floor(parseFloat(form.stake)*Number(ONE_POT)));

      await new Promise<void>((resolve,reject) => {
        let unsub:any;
        contract.tx.registerModel(
          {gasLimit:gas, value:stake, storageDepositLimit:null},
          modelHash, metadata, price
        ).signAndSend(alice, ({status,dispatchError}:any) => {
          if (dispatchError) { if(unsub)unsub(); reject(new Error(JSON.stringify(dispatchError.toHuman()))); return; }
          if (status.isInBlock) { if(unsub)unsub(); resolve(); }
        }).then((u:any)=>{unsub=u;}).catch(reject);
      });

      setStatus("success");
      setMessage(`Model "${form.name}" registered on Portaldot!`);
      setForm({name:"",desc:"",cid:"",version:"1.0.0",price:"1",stake:"1"});
    } catch(e:any) { setStatus("error"); setMessage(e.message); }
  }

  return (
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <div className="fade-up" style={{marginBottom:40}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <Link href="/" style={{color:"var(--text-muted)",fontSize:13,textDecoration:"none"}}>Dashboard</Link>
          <span style={{color:"var(--text-muted)"}}>›</span>
          <span style={{color:"var(--violet-glow)",fontSize:13}}>Register Model</span>
        </div>
        <h1 className="display" style={{fontSize:36,fontWeight:800,letterSpacing:"-0.02em",marginBottom:8}}>Register AI Model</h1>
        <p style={{color:"var(--text-secondary)",fontSize:15,lineHeight:1.6}}>Publish your model on-chain. Stake POT as reputation. Earn when buyers access your model.</p>
      </div>

      <div className="fade-up-1" style={{
        display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderRadius:8,marginBottom:24,
        background:chainReady==="ready"?"rgba(16,185,129,0.08)":chainReady==="failed"?"rgba(239,68,68,0.08)":"rgba(124,58,237,0.08)",
        border:`1px solid ${chainReady==="ready"?"rgba(16,185,129,0.25)":chainReady==="failed"?"rgba(239,68,68,0.25)":"rgba(124,58,237,0.25)"}`,
      }}>
        <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,
          background:chainReady==="ready"?"#10b981":chainReady==="failed"?"#ef4444":"#7c3aed",
          boxShadow:chainReady==="ready"?"0 0 8px #10b981":"none"}}/>
        <span style={{fontSize:13,color:chainReady==="ready"?"#34d399":chainReady==="failed"?"#f87171":"#a78bfa"}}>
          {chainReady==="connecting"&&"Connecting to Portaldot node..."}
          {chainReady==="ready"&&"Connected — ready to register"}
          {chainReady==="failed"&&"Connection failed: "+message}
        </span>
      </div>

      <form onSubmit={submit} className="fade-up-2">
        <div style={{background:"rgba(13,10,30,0.8)",border:"1px solid var(--border)",borderRadius:16,padding:32,display:"flex",flexDirection:"column",gap:20}}>
          <div>
            <label style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-muted)",display:"block",marginBottom:8}}>Model Name *</label>
            <input required value={form.name} onChange={f("name")} placeholder="e.g. GPT-Mini-v2" className="input-field"/>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-muted)",display:"block",marginBottom:8}}>Description</label>
            <textarea value={form.desc} onChange={f("desc")} rows={3} placeholder="What does your model do?" className="input-field" style={{resize:"vertical"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-muted)",display:"block",marginBottom:8}}>IPFS CID</label>
              <input value={form.cid} onChange={f("cid")} placeholder="QmXxx..." className="input-field mono"/>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-muted)",display:"block",marginBottom:8}}>Version</label>
              <input value={form.version} onChange={f("version")} className="input-field mono"/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-muted)",display:"block",marginBottom:8}}>Access Price (POT) *</label>
              <input required type="number" min="0.1" step="0.1" value={form.price} onChange={f("price")} className="input-field"/>
              <p style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>Min 0.1 POT</p>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-muted)",display:"block",marginBottom:8}}>Creator Stake (POT) *</label>
              <input required type="number" min="1" step="1" value={form.stake} onChange={f("stake")} className="input-field"/>
              <p style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>Min 1 POT</p>
            </div>
          </div>
          <div style={{background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:10,padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {["Model hash stored on-chain — tamper-proof","Stake locked as reputation signal","Buyers pay POT → credited instantly","All usage tracked via on-chain events"].map(t=>(
              <div key={t} style={{display:"flex",gap:6}}>
                <span style={{color:"var(--violet-glow)",fontSize:12}}>✦</span>
                <span style={{fontSize:12,color:"var(--text-muted)",lineHeight:1.5}}>{t}</span>
              </div>
            ))}
          </div>
          <button type="submit" disabled={status==="loading"||chainReady!=="ready"}
            className="btn-primary"
            style={{width:"100%",padding:"14px",borderRadius:10,color:"white",fontWeight:700,fontSize:15,border:"none",
              cursor:chainReady!=="ready"?"not-allowed":"pointer",fontFamily:"Space Grotesk, sans-serif",
              opacity:status==="loading"||chainReady!=="ready"?0.6:1}}>
            {status==="loading"?"⟳ Processing...":chainReady==="connecting"?"⟳ Connecting...":"⊕ Register Model"}
          </button>
          {status!=="idle"&&status!=="loading"&&chainReady!=="failed"&&message&&(
            <div style={{padding:"12px 16px",borderRadius:8,fontSize:13,lineHeight:1.5,
              background:status==="success"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",
              border:`1px solid ${status==="success"?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`,
              color:status==="success"?"#34d399":"#f87171"}}>
              {message}
              {status==="success"&&<div style={{marginTop:8}}><Link href="/marketplace" style={{color:"#a78bfa",textDecoration:"underline",fontSize:12}}>View in marketplace →</Link></div>}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
