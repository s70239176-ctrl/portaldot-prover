"use client";
import { useEffect, useState } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ContractPromise } from "@polkadot/api-contract";
import Link from "next/link";

const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
const ADDR = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const ONE_POT = BigInt("100000000000000");

function fmt(planck: string) {
  const n = BigInt(planck.replace(/,/g,""));
  return (Number(n)/Number(ONE_POT)).toFixed(4)+" POT";
}

type Model = { id:number; creator:string; price:string; totalPurchases:number; isActive:boolean; metadata:string };

export default function MarketplacePage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number|null>(null);
  const [msg, setMsg] = useState<{id:number;text:string;ok:boolean}|null>(null);
  const [access, setAccess] = useState<Record<number,boolean>>({});
  const caller = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

  useEffect(()=>{
    (async()=>{
      try {
        const ABI = await fetch("/abi.json").then(r=>r.json());
        const api = await ApiPromise.create({ provider: new WsProvider(WS) });
        await api.isReady;
        const contract = new ContractPromise(api, ABI, ADDR);
        const gasLimit = api.registry.createType("WeightV2",{refTime:BigInt("30000000000"),proofSize:BigInt("1000000")});
        const idsRes = await (contract.query as any).listModelIds(caller,{gasLimit},0,20);
        const ids: number[] = idsRes.output?.toHuman() || [];
        const out:Model[]=[], acc:Record<number,boolean>={};
        for(const id of ids){
          const mRes = await (contract.query as any).getModel(caller,{gasLimit},Number(id));
          const v = mRes.output?.toHuman() as any;
          if(v){
            out.push({id:Number(id),creator:v.creator,price:v.price,
              totalPurchases:Number(v.totalPurchases),isActive:v.isActive,metadata:v.metadata});
            const aRes = await (contract.query as any).hasAccess(caller,{gasLimit},caller,Number(id));
            acc[Number(id)] = aRes.output?.toHuman()===true;
          }
        }
        setModels(out); setAccess(acc);
        await api.disconnect();
      } catch(e){console.error(e);}
      setLoading(false);
    })();
  },[]);

  async function buy(m:Model){
    setPurchasing(m.id); setMsg(null);
    try{
      const ABI = await fetch("/abi.json").then(r=>r.json());
      const api = await ApiPromise.create({ provider: new WsProvider(WS) });
      await api.isReady;
      const contract = new ContractPromise(api,ABI,ADDR);
      const gasLimit = api.registry.createType("WeightV2",{refTime:BigInt("30000000000"),proofSize:BigInt("1000000")});
      const { Keyring } = await import("@polkadot/keyring");
      const { u8aToHex } = await import("@polkadot/util");
      const kr = new Keyring({type:"sr25519",ss58Format:42});
      const bob = kr.addFromUri("//Bob");
      const signer = { signPayload: async(p:any)=>({id:p.id,signature:u8aToHex(bob.sign(p.data))}) };
      const price = BigInt(m.price.replace(/,/g,""));
      await new Promise<void>((resolve,reject)=>{
        let unsub:any;
        (contract.tx as any).purchaseAccess({gasLimit,value:price,storageDepositLimit:null},m.id)
          .signAndSend(bob.address,{signer},({status,dispatchError}:any)=>{
            if(dispatchError){if(unsub)unsub();reject(new Error(dispatchError.toString()));return;}
            if(status.isInBlock){if(unsub)unsub();resolve();}
          }).then((u:any)=>{unsub=u;}).catch(reject);
      });
      await api.disconnect();
      setAccess(a=>({...a,[m.id]:true}));
      setMsg({id:m.id,text:"✅ Access purchased!",ok:true});
    }catch(e:any){setMsg({id:m.id,text:e.message,ok:false});}
    setPurchasing(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Marketplace</h1>
          <p className="text-gray-400 text-sm">Buy POT access to verified AI models on Portaldot.</p>
        </div>
        <Link href="/register" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Register</Link>
      </div>
      {loading?(
        <div className="text-center py-20 text-gray-500">Loading marketplace...</div>
      ):models.length===0?(
        <div className="text-center py-20 bg-gray-900 rounded-xl border border-gray-800">
          <div className="text-5xl mb-4">🤖</div>
          <p className="text-gray-400 mb-4">No models yet.</p>
          <Link href="/register" className="bg-purple-600 text-white px-6 py-2 rounded-lg text-sm">Register First Model</Link>
        </div>
      ):(
        <div className="space-y-4">
          {models.map(m=>{
            let meta:any={};
            try{meta=JSON.parse(m.metadata);}catch{}
            const owned=access[m.id];
            return(
              <div key={m.id} className="bg-gray-900 border border-gray-800 hover:border-purple-800 rounded-xl p-6 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold text-lg">{meta.name||`Model #${m.id}`}</h3>
                      {m.isActive&&<span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">Active</span>}
                      {owned&&<span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">✓ Owned</span>}
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{meta.description||"No description"}</p>
                    <p className="text-xs text-gray-600">#{m.id} · {m.creator.slice(0,8)}... · {m.totalPurchases} buyers</p>
                  </div>
                  <div className="text-right ml-6">
                    <div className="text-2xl font-bold text-purple-400 mb-3">{fmt(m.price)}</div>
                    {owned?(
                      <Link href={`/verify?id=${m.id}`} className="block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm text-center">Verify →</Link>
                    ):(
                      <button onClick={()=>buy(m)} disabled={purchasing===m.id||!m.isActive}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm">
                        {purchasing===m.id?"Buying...":"Buy Access"}
                      </button>
                    )}
                  </div>
                </div>
                {msg?.id===m.id&&<div className={`mt-3 p-2 rounded text-xs ${msg.ok?"bg-green-900/40 text-green-300":"bg-red-900/40 text-red-300"}`}>{msg.text}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
