"use client";
import "./globals.css";
import Link from "next/link";
import { useState, useCallback } from "react";

function Navbar({ onConnect, selected, isConnecting }: {
  onConnect: () => void;
  selected: { address: string; name: string } | null;
  isConnecting: boolean;
}) {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🔮</span>
          <span className="text-white font-bold text-xl">PortaldotProver</span>
        </Link>
        <div className="flex gap-6 text-sm">
          {[["/ ","Dashboard"],["/register","Register"],["/marketplace","Marketplace"],["/verify","Verify"]].map(([href,label])=>(
            <Link key={href} href={href} className="text-gray-400 hover:text-purple-400 transition-colors">{label}</Link>
          ))}
        </div>
      </div>
      <button onClick={onConnect} disabled={isConnecting}
        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
        {isConnecting ? "Connecting..." : selected ? `${selected.name} (${selected.address.slice(0,6)}...)` : "Connect Wallet"}
      </button>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<{address:string;name:string;source:string}|null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
      const extensions = await web3Enable("PortaldotProver");
      if (!extensions.length) {
        setSelected({ address:"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", name:"Alice (Dev)", source:"dev" });
      } else {
        const accs = await web3Accounts();
        if (accs[0]) setSelected({ address:accs[0].address, name:accs[0].meta.name||"Account", source:accs[0].meta.source||"" });
      }
    } catch(e) { console.error(e); }
    setIsConnecting(false);
  }, []);

  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">
        <Navbar onConnect={connect} selected={selected} isConnecting={isConnecting} />
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
