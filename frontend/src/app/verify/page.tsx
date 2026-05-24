// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const toHash = (s:string) => { const b=new TextEncoder().encode(s.padEnd(32,"\0").slice(0,32)); return "0x"+Array.from(b).map((x:number)=>x.toString(16).padStart(2,"0")).join(""); };

export default function VerifyPage() {
  const [modelId, setModelId] = useState("1");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState<boolean|null>(null);
  const caller = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

  useEffect(()=>{
    if(!modelId||!CONTRACT) return;
    setHasAccess(null);
    (async()=>{
      try{
        const {ApiPromise,WsProvider}=await import("@polkadot/api");
        const {ContractPromise}=await import("@polkadot/api-contract");
        const ABI=await fetch("/abi.json").then(r=>r.json());
        const api=await ApiPromise.create({provider:new WsProvider(WS)});
        await api.isReady;
        const contract=new ContractPromise(api,ABI,CONTRACT);
        const gas=api.registry.createType("WeightV2",{refTime:BigInt("30000000000"),proofSize:BigInt("1000000")}) as any;
        const bob = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
        const rAlice=await contract.query.hasAccess(caller,{gasLimit:gas},caller,Number(modelId));
        const rBob=await contract.query.hasAccess(caller,{gasLimit:gas},bob,Number(modelId));
        const aliceHas = rAlice.result.isOk && rAlice.output?.toHuman()?.Ok === true;
        const bobHas = rBob.result.isOk && rBob.output?.toHuman()?.Ok === true;
        setHasAccess(aliceHas || bobHas);
        await api.disconnect();
      }catch(e){console.error(e);}
    })();
  },[modelId]);

  async function verify(e:React.FormEvent){
    e.preventDefault();
    if(!hasAccess){setMessage("No access to this model.");setStatus("error");return;}
    setStatus("loading");setMessage("Computing on-chain proof...");setProof(null);
    try{
      const {ApiPromise,WsProvider}=await import("@polkadot/api");
      const {ContractPromise}=await import("@polkadot/api-contract");
      const {Keyring}=await import("@polkadot/keyring");
      const ABI=await fetch("/abi.json").then(r=>r.json());
      const api=await ApiPromise.create({provider:new WsProvider(WS)});
      await api.isReady;
      const contract=new ContractPromise(api,ABI,CONTRACT);
      const gas=api.registry.createType("WeightV2",{refTime:BigInt("30000000000"),proofSize:BigInt("1000000")}) as any;
      const kr=new Keyring({type:"sr25519",ss58Format:42});
      const alice=kr.addFromUri("//Alice");
      const bob=kr.addFromUri("//Bob");
      const inputHash=toHash(input);

      // Try Bob first (purchaser), fall back to Alice
      const bobAccess = await contract.query.hasAccess(
        alice.address,{gasLimit:gas},bob.address,Number(modelId)
      );
      const signer = bobAccess.output?.toHuman()?.Ok === true ? bob : alice;

      const dry=await contract.query.verifyInference(signer.address,{gasLimit:gas},Number(modelId),inputHash);
      if(dry.result.isOk){
        const val=dry.output?.toHuman() as any;
        if(val?.Ok){
          await new Promise<void>((resolve,reject)=>{
            let unsub:any;
            contract.tx.verifyInference({gasLimit:gas,storageDepositLimit:null},Number(modelId),inputHash)
              .signAndSend(alice,({status,dispatchError}:any)=>{
                if(dispatchError){if(unsub)unsub();reject(new Error(JSON.stringify(dispatchError.toHuman())));return;}
                if(status.isInBlock){if(unsub)unsub();resolve();}
              }).then((u:any)=>{unsub=u;}).catch(reject);
          });
          setProof({modelId:Number(modelId),verifier:signer.address,inputHash,
            proofHash:val.Ok.proofHash||val.Ok.proof_hash||"computed",
            verifiedAt:String(val.Ok.verifiedAt||val.Ok.verified_at||0)});
          setStatus("success");setMessage("Proof generated and stored on-chain!");
        }else{setStatus("error");setMessage("Contract error: "+JSON.stringify(val?.Err));}
      }else{setStatus("error");setMessage("Access denied or model inactive.");}
      await api.disconnect();
    }catch(e:any){setStatus("error");setMessage(e.message);}
  }

  return (
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <div className="fade-up" style={{marginBottom:40}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <Link href="/" style={{color:"var(--text-muted)",fontSize:13,textDecoration:"none"}}>Dashboard</Link>
          <span style={{color:"var(--text-muted)"}}>›</span>
          <span style={{color:"var(--violet-glow)",fontSize:13}}>Verify Inference</span>
        </div>
        <h1 className="display" style={{fontSize:36,fontWeight:800,letterSpacing:"-0.02em",marginBottom:8}}>Verify Inference</h1>
        <p style={{color:"var(--text-secondary)",fontSize:15,lineHeight:1.6}}>Generate a tamper-proof on-chain proof for your AI inference.</p>
      </div>

      <div className="fade-up-1" style={{background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:12,padding:"16px 20px",marginBottom:24,display:"flex",gap:24}}>
        <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",paddingTop:2,flexShrink:0}}>Proof Formula</div>
        <div className="mono" style={{fontSize:12,color:"var(--violet-glow)",lineHeight:1.8}}>
          BLAKE2b(<span style={{color:"#f59e0b"}}>model_hash</span> ++ <span style={{color:"#06b6d4"}}>input_hash</span> ++ <span style={{color:"#10b981"}}>caller</span> ++ <span style={{color:"#f87171"}}>block_num</span>)
        </div>
      </div>

      <form onSubmit={verify} className="fade-up-2">
        <div style={{background:"rgba(13,10,30,0.8)",border:"1px solid var(--border)",borderRadius:16,padding:32,display:"flex",flexDirection:"column",gap:20}}>
          <div>
            <label style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-muted)",display:"block",marginBottom:8}}>Model ID *</label>
            <input required type="number" min="1" value={modelId} onChange={e=>setModelId(e.target.value)} className="input-field mono"/>
            {hasAccess!==null&&(
              <div style={{marginTop:8,display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:6,fontSize:12,background:hasAccess?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",border:`1px solid ${hasAccess?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`,color:hasAccess?"#34d399":"#f87171"}}>
                {hasAccess?"✓ Access granted":"✗ No access — "}
                {!hasAccess&&<Link href="/marketplace" style={{color:"#a78bfa",textDecoration:"underline"}}>purchase first</Link>}
              </div>
            )}
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-muted)",display:"block",marginBottom:8}}>Input Data *</label>
            <textarea required value={input} onChange={e=>setInput(e.target.value)} rows={4}
              placeholder="The input you sent to the AI model (prompt, data, query...)"
              className="input-field" style={{resize:"vertical"}}/>
            {input&&<div className="mono" style={{fontSize:11,color:"var(--text-muted)",marginTop:6}}>Hash: <span style={{color:"var(--violet-glow)"}}>{toHash(input)}</span></div>}
          </div>
          <button type="submit" disabled={status==="loading"||hasAccess===false}
            className="btn-primary"
            style={{width:"100%",padding:"14px",borderRadius:10,color:"white",fontWeight:700,fontSize:15,border:"none",cursor:hasAccess===false?"not-allowed":"pointer",fontFamily:"Space Grotesk, sans-serif",opacity:status==="loading"||hasAccess===false?0.6:1}}>
            {status==="loading"?"⟳ Generating proof...":"⊡ Generate On-chain Proof"}
          </button>
          {message&&(
            <div style={{padding:"12px 16px",borderRadius:8,fontSize:13,background:status==="success"?"rgba(16,185,129,0.1)":status==="error"?"rgba(239,68,68,0.1)":"rgba(124,58,237,0.1)",border:`1px solid ${status==="success"?"rgba(16,185,129,0.3)":status==="error"?"rgba(239,68,68,0.3)":"rgba(124,58,237,0.3)"}`,color:status==="success"?"#34d399":status==="error"?"#f87171":"#a78bfa"}}>
              {message}
            </div>
          )}
        </div>
      </form>

      {proof&&(
        <div className="fade-up" style={{marginTop:24,background:"rgba(13,10,30,0.9)",border:"1px solid rgba(16,185,129,0.4)",borderRadius:16,padding:32,boxShadow:"0 0 40px rgba(16,185,129,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
            <div style={{width:36,height:36,borderRadius:10,background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>✓</div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:"#34d399"}}>Verification Proof</div>
              <div style={{fontSize:12,color:"var(--text-muted)"}}>Permanently stored on Portaldot</div>
            </div>
          </div>
          {[["Model ID",`#${proof.modelId}`],["Verifier",proof.verifier],["Input Hash",proof.inputHash],["Proof Hash",proof.proofHash],["Block",proof.verifiedAt]].map(([k,v])=>(
            <div key={k} className="proof-row">
              <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",width:120,flexShrink:0,paddingTop:2}}>{k}</div>
              <div className="mono" style={{fontSize:13,color:"var(--text-secondary)",wordBreak:"break-all",lineHeight:1.5}}>{v}</div>
            </div>
          ))}
          <div style={{marginTop:20,padding:"12px 16px",borderRadius:8,background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.2)",fontSize:12,color:"var(--text-muted)",lineHeight:1.6}}>
            This proof is immutably stored on Portaldot and publicly verifiable.
          </div>
        </div>
      )}
    </div>
  );
}
