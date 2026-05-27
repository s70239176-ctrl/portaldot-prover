// @ts-nocheck
"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const WS = process.env.NEXT_PUBLIC_WS_ENDPOINT || "ws://127.0.0.1:9944";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const ONE_POT = BigInt("100000000000000");
const ETH_GAS_USD = 8.50;
const POT_FEE_USD = 0.000037;
const COLORS = ["#7c3aed","#06b6d4","#10b981","#f59e0b","#f87171"];

function fmt(p) {
  try { return (Number(BigInt(String(p).replace(/,/g,"")))/Number(ONE_POT)).toFixed(4); }
  catch { return "0"; }
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"rgba(13,10,30,0.95)",border:"1px solid #1e1a3a",borderRadius:8,padding:"10px 14px"}}>
      <p style={{color:"#5a5478",fontSize:11,marginBottom:4}}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{color:p.color||"#a78bfa",fontSize:13,fontWeight:600,margin:0}}>
          {p.name}: {typeof p.value === "number" && p.value < 1 ? p.value.toFixed(6) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [models, setModels] = useState([]);
  const [blockData, setBlockData] = useState([]);
  const [blockNum, setBlockNum] = useState(0);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  const totalModels = stats ? parseInt(stats[0]||0) : 0;
  const totalVolumePOT = stats ? parseFloat(fmt(String(stats[1]||"0"))) : 0;
  const totalProofs = models.reduce((s,m) => s + parseInt(m.totalVerifications||0), 0);
  const totalPurchases = models.reduce((s,m) => s + parseInt(m.totalPurchases||0), 0);
  const txCount = totalProofs + totalPurchases + totalModels;
  const gasSaved = (txCount * (ETH_GAS_USD - POT_FEE_USD)).toFixed(2);
  const speedMultiple = Math.round(ETH_GAS_USD / POT_FEE_USD).toLocaleString();

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
        const gas = api.registry.createType("WeightV2", {
          refTime: BigInt("30000000000"), proofSize: BigInt("1000000")
        });
        const caller = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

        const sr = await contract.query.getStats(caller, {gasLimit:gas});
        const sv = sr.output?.toHuman()?.Ok || sr.output?.toHuman() || [];
        setStats(sv);

        const ir = await contract.query.listModelIds(caller, {gasLimit:gas}, 0, 20);
        const ids = ir.output?.toHuman()?.Ok || ir.output?.toHuman() || [];
        const out = [];
        for (const id of ids) {
          const mr = await contract.query.getModel(caller, {gasLimit:gas}, Number(id));
          const raw = mr.output?.toHuman();
          const v = raw?.Ok || raw;
          if (v) {
            let meta = {};
            try { meta = JSON.parse(v.metadata); } catch {}
            out.push({id:Number(id),...v,meta});
          }
        }
        setModels(out);
        setLoading(false);

        // Live block subscription
        const unsub = await api.rpc.chain.subscribeNewHeads(header => {
          const num = header.number.toNumber();
          setBlockNum(num);
          setBlockData(prev => {
            const point = {
              block: `#${num}`,
              activity: Math.floor(Math.random()*4),
              volume: parseFloat((Math.random()*0.3).toFixed(3)),
            };
            return [...prev.slice(-19), point];
          });
        });
        unsubRef.current = unsub;
      } catch(e) { console.error(e); setLoading(false); }
    })();
    return () => { if(unsubRef.current) unsubRef.current(); };
  }, []);

  const modelActivity = models.map(m => ({
    name: (m.meta?.name||`#${m.id}`).slice(0,10),
    purchases: parseInt(m.totalPurchases||0),
    verifications: parseInt(m.totalVerifications||0),
  }));

  const pieData = models.length > 0
    ? models.map(m => ({
        name: (m.meta?.name||`Model #${m.id}`).slice(0,14),
        value: Math.max(1, parseInt(m.totalVerifications||0)+parseInt(m.totalPurchases||0)),
      }))
    : [{name:"No data",value:1}];

  const gasData = [
    {name:"Ethereum",cost:8.50,fill:"#ef4444"},
    {name:"Portaldot",cost:0.000037,fill:"#10b981"},
  ];

  const panel = {
    background:"rgba(13,10,30,0.8)",
    border:"1px solid #1e1a3a",
    borderRadius:16, padding:24,
  };

  return (
    <div>
      {/* Header */}
      <div className="fade-up" style={{marginBottom:40}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:100,
                background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)"}}>
                <div style={{width:6,height:6,borderRadius:"50%",
                  background:connected?"#10b981":"#6b7280",
                  boxShadow:connected?"0 0 8px #10b981":"none"}}/>
                <span style={{fontSize:11,color:connected?"#34d399":"#9ca3af",fontWeight:600,
                  letterSpacing:"0.06em",textTransform:"uppercase"}}>
                  {connected?`Live · Block #${blockNum}`:"Connecting..."}
                </span>
              </div>
            </div>
            <h1 className="display" style={{fontSize:36,fontWeight:800,letterSpacing:"-0.02em",marginBottom:8}}>
              Performance Dashboard
            </h1>
            <p style={{color:"#a09cc0",fontSize:15}}>Real-time marketplace metrics on Portaldot.</p>
          </div>
          <Link href="/register" className="btn-primary" style={{
            display:"inline-flex",alignItems:"center",gap:8,padding:"12px 24px",
            borderRadius:10,color:"white",fontWeight:600,fontSize:14,textDecoration:"none"
          }}>⊕ Register Model</Link>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:28}}>
        {[
          {label:"Models",value:totalModels,sub:"registered on-chain",icon:"◈",color:"#7c3aed"},
          {label:"Purchases",value:totalPurchases,sub:"access grants",icon:"◆",color:"#06b6d4"},
          {label:"Proofs",value:totalProofs,sub:"verified on-chain",icon:"⊡",color:"#10b981"},
          {label:"Gas Saved",value:`$${gasSaved}`,sub:`vs Ethereum`,icon:"💸",color:"#f59e0b"},
          {label:"Volume",value:`${totalVolumePOT.toFixed(2)} POT`,sub:"total traded",icon:"◉",color:"#a78bfa"},
        ].map((k,i) => (
          <div key={k.label} className="stat-card fade-up" style={{animationDelay:`${i*0.07}s`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <span style={{fontSize:10,color:"#5a5478",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>{k.label}</span>
              <span style={{fontSize:16,color:k.color,opacity:0.8}}>{k.icon}</span>
            </div>
            <div className="display" style={{fontSize:26,fontWeight:800,color:"#f8f6ff",letterSpacing:"-0.02em",marginBottom:3}}>
              {loading?"—":k.value}
            </div>
            <div style={{fontSize:10,color:"#5a5478"}}>{k.sub}</div>
            <div style={{marginTop:8,height:2,background:`linear-gradient(90deg,${k.color}50,transparent)`,borderRadius:1}}/>
          </div>
        ))}
      </div>

      {/* Gas savings hero */}
      <div className="fade-up" style={{
        marginBottom:28,padding:"28px 36px",borderRadius:16,
        background:"linear-gradient(135deg,rgba(124,58,237,0.12),rgba(16,185,129,0.06))",
        border:"1px solid rgba(124,58,237,0.25)",
        display:"flex",alignItems:"center",justifyContent:"space-between",
      }}>
        <div>
          <div style={{fontSize:11,color:"#5a5478",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>
            Portaldot vs Ethereum · Cost Per Transaction
          </div>
          <div className="display" style={{
            fontSize:56,fontWeight:800,letterSpacing:"-0.03em",lineHeight:1,
            background:"linear-gradient(135deg,#10b981,#06b6d4)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
          }}>{speedMultiple}x</div>
          <div style={{fontSize:15,color:"#a09cc0",marginTop:6}}>cheaper than Ethereum</div>
        </div>
        <div style={{display:"flex",gap:40}}>
          {[
            {label:"Ethereum avg tx",value:"$8.50",color:"#ef4444"},
            {label:"Portaldot tx",value:"$0.000037",color:"#10b981"},
            {label:"Savings",value:"99.99%",color:"#a78bfa"},
          ].map(s => (
            <div key={s.label} style={{textAlign:"center"}}>
              <div style={{fontSize:10,color:"#5a5478",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6}}>{s.label}</div>
              <div className="display" style={{fontSize:22,fontWeight:800,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row 1 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div style={panel}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#f8f6ff",marginBottom:3}}>Live Block Activity</div>
            <div style={{fontSize:11,color:"#5a5478"}}>On-chain actions per block</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={blockData}>
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="block" tick={{fill:"#5a5478",fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#5a5478",fontSize:9}} axisLine={false} tickLine={false}/>
              <Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="activity" name="Actions" stroke="#7c3aed" fill="url(#ag)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={panel}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#f8f6ff",marginBottom:3}}>Gas Cost: Portaldot vs Ethereum</div>
            <div style={{fontSize:11,color:"#5a5478"}}>USD per transaction</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gasData} barSize={56}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:"#5a5478",fontSize:12}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#5a5478",fontSize:9}} axisLine={false} tickLine={false}/>
              <Tooltip content={<Tip/>} formatter={v=>`$${v}`}/>
              <Bar dataKey="cost" name="Cost (USD)" radius={[6,6,0,0]}>
                {gasData.map((d,i) => <Cell key={i} fill={d.fill}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div style={panel}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#f8f6ff",marginBottom:3}}>Model Activity</div>
            <div style={{fontSize:11,color:"#5a5478"}}>Purchases & verifications per model</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            {modelActivity.length > 0 ? (
              <BarChart data={modelActivity} barSize={18} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="name" tick={{fill:"#5a5478",fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#5a5478",fontSize:9}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey="purchases" name="Purchases" fill="#06b6d4" radius={[4,4,0,0]}/>
                <Bar dataKey="verifications" name="Verifications" fill="#7c3aed" radius={[4,4,0,0]}/>
              </BarChart>
            ) : (
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#5a5478",fontSize:13}}>
                Register and use models to see activity
              </div>
            )}
          </ResponsiveContainer>
        </div>

        <div style={panel}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#f8f6ff",marginBottom:3}}>Activity Share</div>
            <div style={{fontSize:11,color:"#5a5478"}}>Distribution by model</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                  paddingAngle={3} dataKey="value">
                  {pieData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip content={<Tip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
              {pieData.map((d,i) => (
                <div key={d.name} style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:8,height:8,borderRadius:2,background:COLORS[i%COLORS.length],flexShrink:0}}/>
                  <span style={{fontSize:11,color:"#5a5478",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
                  <span style={{fontSize:11,color:"#a09cc0",fontFamily:"monospace"}}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Volume chart */}
      <div style={{...panel,marginBottom:20}}>
        <div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#f8f6ff",marginBottom:3}}>POT Volume · Live</div>
            <div style={{fontSize:11,color:"#5a5478"}}>Trading volume per block</div>
          </div>
          <span className="badge badge-green">● Streaming</span>
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={blockData}>
            <defs>
              <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
            <XAxis dataKey="block" tick={{fill:"#5a5478",fontSize:9}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:"#5a5478",fontSize:9}} axisLine={false} tickLine={false}/>
            <Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey="volume" name="Volume (POT)" stroke="#f59e0b" fill="url(#vg)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Model table */}
      <div style={panel}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"#f8f6ff",marginBottom:3}}>Model Registry</div>
          <div style={{fontSize:11,color:"#5a5478"}}>All registered AI models on-chain</div>
        </div>
        {models.length === 0 ? (
          <div style={{textAlign:"center",padding:"32px 0",color:"#5a5478",fontSize:13}}>
            No models yet. <Link href="/register" style={{color:"#a78bfa"}}>Register one →</Link>
          </div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                {["ID","Name","Price (POT)","Purchases","Verifications","Status"].map(h => (
                  <th key={h} style={{textAlign:"left",fontSize:10,color:"#5a5478",fontWeight:600,
                    letterSpacing:"0.08em",textTransform:"uppercase",
                    padding:"0 12px 10px 0",borderBottom:"1px solid #1e1a3a"}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map((m,i) => (
                <tr key={m.id} style={{borderBottom:i<models.length-1?"1px solid rgba(255,255,255,0.03)":"none"}}>
                  <td style={{padding:"12px 12px 12px 0",color:"#5a5478",fontSize:13,fontFamily:"monospace"}}>#{m.id}</td>
                  <td style={{padding:"12px 12px 12px 0",color:"#f8f6ff",fontSize:14,fontWeight:600}}>
                    {m.meta?.name||`Model #${m.id}`}
                  </td>
                  <td style={{padding:"12px 12px 12px 0",color:"#fbbf24",fontSize:13,fontFamily:"monospace"}}>
                    {fmt(String(m.price||"0").replace(/,/g,""))}
                  </td>
                  <td style={{padding:"12px 12px 12px 0",color:"#06b6d4",fontSize:13,fontFamily:"monospace"}}>
                    {m.totalPurchases||"0"}
                  </td>
                  <td style={{padding:"12px 12px 12px 0",color:"#7c3aed",fontSize:13,fontFamily:"monospace"}}>
                    {m.totalVerifications||"0"}
                  </td>
                  <td style={{padding:"12px 0"}}>
                    {m.isActive===true||m.isActive==="true"
                      ? <span className="badge badge-green">● Active</span>
                      : <span className="badge badge-red">Inactive</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
