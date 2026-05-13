"use client";
import { useState, useEffect } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ContractPromise } from "@polkadot/api-contract";
import Link from "next/link";

const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
const ADDR = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

function toHash(s: string) {
  const b = new TextEncoder().encode(s.padEnd(32,"\0").slice(0,32));
  return "0x"+Array.from(b).map(x=>x.toString(16).padStart(2,"0")).join("");
}

export default function VerifyPage() {
  const [modelId, setModelId] = useState("1");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState<boolean|null>(null);
  const caller = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

  useEffect(()=>{
    if(!modelId) return;
    setHasAccess(null);
    (async()=>{
      try{
        const ABI = await fetch("/abi.json").then(r=>r.json());
        const api = await ApiPromise.create({provider:new WsProvider(WS)});
        await api.isReady;
        const contract = new ContractPromise(api,ABI,ADDR);
        const gasLimit = api.registry.createType("WeightV2",{refTime:BigInt("30000000000"),proofSize:BigInt("1000000")});
        const res = await (contract.query as any).hasAccess(caller,{gasLimit},caller,Number(modelId));
        setHasAccess(res.output?.toHuman()===true);
        await api.disconnect();
      }catch(e){console.error(e);}
    })();
  },[modelId]);

  async function handleVerify(e:React.FormEvent){
    e.preventDefault();
    if(!hasAccess){setMessage("No access — purchase first");setStatus("error");return;}
    setStatus("loading");setMessage("Computing proof...");setProof(null);
    try{
      const ABI = await fetch("/abi.json").then(r=>r.json());
      const api = await ApiPromise.create({provider:new WsProvider(WS)});
      await api.isReady;
      const contract = new ContractPromise(api,ABI,ADDR);
      const gasLimit = api.registry.createType("WeightV2",{refTime:BigInt("30000000000"),proofSize:BigInt("1000000")});
      const inputHash = toHash(input);
      const dry = await (contract.query as any).verifyInference(caller,{gasLimit},Number(modelId),inputHash);
      if(dry.result.isOk){
        const val = dry.output?.toHuman() as any;
        if(val?.Ok){
          const {Keyring} = await import("@polkadot/keyring");
          const {u8aToHex} = await import("@polkadot/util");
          const kr = new Keyring({type:"sr25519",ss58Format:42});
          const alice = kr.addFromUri("//Alice");
          const signer = {signPayload:async(p:any)=>({id:p.id,signature:u8aToHex(alice.sign(p.data))})};
          await new Promise<void>((resolve,reject)=>{
            let unsub:any;
            (contract.tx as any).verifyInference({gasLimit,storageDepositLimit:null},Number(modelId),inputHash)
              .signAndSend(alice.address,{signer},({status,dispatchError}:any)=>{
                if(dispatchError){if(unsub)unsub();reject(new Error(dispatchError.toString()));return;}
                if(status.isInBlock){if(unsub)unsub();resolve();}
              }).then((u:any)=>{unsub=u;}).catch(reject);
          });
          setProof({modelId:Number(modelId),verifier:caller,inputHash,
            proofHash:val.Ok.proofHash||val.Ok.proof_hash||"computed",
            verifiedAt:String(val.Ok.verifiedAt||val.Ok.verified_at||0)});
          setStatus("success");setMessage("✅ Inference verified on-chain!");
        }else{setStatus("error");setMessage("Error: "+JSON.stringify(val?.Err));}
      }else{setStatus("error");setMessage("Failed: "+dry.result.toString());}
      await api.disconnect();
    }catch(e:any){setStatus("error");setMessage(e.message);}
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Verify Inference</h1>
      <p className="text-gray-400 mb-8 text-sm">Generate a tamper-proof on-chain proof for your AI inference. Powered by BLAKE2b on Portaldot.</p>
      <form onSubmit={handleVerify} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Model ID</label>
          <input required type="number" min="1" value={modelId} onChange={e=>setModelId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"/>
          {hasAccess!==null&&(
            <p className={`text-xs mt-1 ${hasAccess?"text-green-400":"text-red-400"}`}>
              {hasAccess?"✓ Access granted":"✗ No access — "}{!hasAccess&&<Link href="/marketplace" className="underline">buy here</Link>}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Input Data</label>
          <textarea required value={input} onChange={e=>setInput(e.target.value)} rows={4}
            placeholder="The input you sent to the AI model (prompt, data, etc.)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"/>
          {input&&<p className="text-xs text-gray-600 mt-1 font-mono">Hash: {toHash(input)}</p>}
        </div>
        <button type="submit" disabled={status==="loading"||hasAccess===false}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors">
          {status==="loading"?"Verifying...":"Generate On-chain Proof"}
        </button>
        {message&&(
          <div className={`rounded-lg p-3 text-sm border ${
            status==="success"?"bg-green-900/40 text-green-300 border-green-800":
            status==="error"?"bg-red-900/40 text-red-300 border-red-800":
            "bg-blue-900/40 text-blue-300 border-blue-800"}`}>{message}</div>
        )}
      </form>
      {proof&&(
        <div className="mt-6 bg-gray-900 border border-green-800 rounded-xl p-6">
          <h2 className="text-green-400 font-bold text-lg mb-4">✅ Verification Proof</h2>
          <div className="space-y-2 text-sm font-mono">
            {[["Model","#"+proof.modelId],["Verifier",proof.verifier],["Input Hash",proof.inputHash],["Proof Hash",proof.proofHash],["Block",proof.verifiedAt]].map(([k,v])=>(
              <div key={k} className="flex gap-3"><span className="text-gray-500 w-24 flex-shrink-0">{k}:</span><span className="text-white break-all">{v}</span></div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500 bg-gray-800 p-3 rounded-lg">Permanently stored on Portaldot. Verifiable by anyone.</p>
        </div>
      )}
    </div>
  );
}
