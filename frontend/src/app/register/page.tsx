"use client";
import { useState } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ContractPromise } from "@polkadot/api-contract";
import Link from "next/link";

const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
const ADDR = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const ONE_POT = BigInt("100000000000000");

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("1");
  const [stake, setStake] = useState("1");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading"); setMessage("Connecting to chain...");
    try {
      const ABI = await fetch("/abi.json").then(r=>r.json());
      const api = await ApiPromise.create({ provider: new WsProvider(WS) });
      await api.isReady;
      const contract = new ContractPromise(api, ABI, ADDR);
      const gasLimit = api.registry.createType("WeightV2", { refTime: BigInt("30000000000"), proofSize: BigInt("1000000") });
      const { Keyring } = await import("@polkadot/keyring");
      const { u8aToHex } = await import("@polkadot/util");
      const kr = new Keyring({ type:"sr25519", ss58Format:42 });
      const alice = kr.addFromUri("//Alice");
      const metadata = JSON.stringify({ name, description:desc, version:"1.0.0" });
      const modelHash = "0x" + Array.from(new TextEncoder().encode(name.padEnd(32,"\0").slice(0,32))).map(b=>b.toString(16).padStart(2,"0")).join("");
      const pricePlanck = BigInt(Math.floor(parseFloat(price)*Number(ONE_POT)));
      const stakePlanck = BigInt(Math.floor(parseFloat(stake)*Number(ONE_POT)));
      const signer = { signPayload: async (p:any) => ({ id:p.id, signature:u8aToHex(alice.sign(p.data)) }) };
      setMessage("Submitting transaction...");
      await new Promise<void>((resolve,reject)=>{
        let unsub:any;
        (contract.tx as any).registerModel({gasLimit,value:stakePlanck,storageDepositLimit:null},modelHash,metadata,pricePlanck)
          .signAndSend(alice.address,{signer},({status,dispatchError}:any)=>{
            if(dispatchError){if(unsub)unsub();reject(new Error(dispatchError.toString()));return;}
            if(status.isInBlock){if(unsub)unsub();resolve();}
          }).then((u:any)=>{unsub=u;}).catch(reject);
      });
      await api.disconnect();
      setStatus("success"); setMessage(`✅ Model "${name}" registered on Portaldot!`);
      setName(""); setDesc(""); setPrice("1"); setStake("1");
    } catch(e:any) { setStatus("error"); setMessage(e.message); }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Register AI Model</h1>
      <p className="text-gray-400 mb-8 text-sm">Stake POT to register your model on-chain. Buyers pay POT for access.</p>
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Model Name *</label>
          <input required value={name} onChange={e=>setName(e.target.value)} placeholder="GPT-Mini-v2"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"/>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="What does your model do?"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"/>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Access Price (POT)</label>
            <input type="number" min="0.1" step="0.1" required value={price} onChange={e=>setPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"/>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Stake (POT)</label>
            <input type="number" min="1" step="1" required value={stake} onChange={e=>setStake(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"/>
          </div>
        </div>
        <button type="submit" disabled={status==="loading"}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors">
          {status==="loading" ? "Registering..." : "Register Model"}
        </button>
        {message && (
          <div className={`rounded-lg p-3 text-sm border ${
            status==="success"?"bg-green-900/40 text-green-300 border-green-800":
            status==="error"?"bg-red-900/40 text-red-300 border-red-800":
            "bg-blue-900/40 text-blue-300 border-blue-800"}`}>{message}</div>
        )}
      </form>
      <p className="mt-4 text-center text-sm"><Link href="/marketplace" className="text-purple-400 hover:underline">View Marketplace →</Link></p>
    </div>
  );
}
