"use client";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";

function Navbar() {
  const pathname = usePathname();
  const [account, setAccount] = useState<string|null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
      const ext = await web3Enable("PortaldotProver");
      if (!ext.length) {
        setAccount("5GrwvaEF...Alice (Dev)");
      } else {
        const accs = await web3Accounts();
        if (accs[0]) setAccount(accs[0].address.slice(0,6)+"..."+accs[0].address.slice(-4));
      }
    } catch(e) { setAccount("5GrwvaEF...Alice (Dev)"); }
    setConnecting(false);
  }, []);

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/register", label: "Register" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/verify", label: "Verify" },
  ];

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(3,1,10,0.85)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--border)",
      padding: "0 32px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "60px",
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
        <div style={{
          width: 32, height: 32,
          background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
          boxShadow: "0 0 16px rgba(124,58,237,0.4)",
        }}>🔮</div>
        <span className="display" style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Portaldot<span style={{ color: "var(--violet-glow)" }}>Prover</span>
        </span>
      </Link>

      {/* Links */}
      <div style={{ display: "flex", gap: 4 }}>
        {links.map(l => (
          <Link key={l.href} href={l.href} className="nav-link" style={{
            color: pathname === l.href ? "var(--violet-glow)" : undefined,
            background: pathname === l.href ? "rgba(124,58,237,0.12)" : undefined,
            textDecoration: "none",
          }}>{l.label}</Link>
        ))}
      </div>

      {/* Wallet */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--green)",
            boxShadow: "0 0 8px var(--green)",
          }}/>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            substrate-contracts-node
          </span>
        </div>
        <button
          onClick={connect}
          disabled={connecting}
          style={{
            background: account ? "rgba(124,58,237,0.15)" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
            border: account ? "1px solid rgba(124,58,237,0.4)" : "none",
            borderRadius: 8,
            padding: "7px 16px",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "Space Grotesk, sans-serif",
            boxShadow: account ? "none" : "0 0 20px rgba(124,58,237,0.3)",
            transition: "all 0.2s",
          }}
        >
          {connecting ? "Connecting..." : account ? `⬡ ${account}` : "Connect Wallet"}
        </button>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
          <Navbar />
          <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>
            {children}
          </main>
          <footer style={{
            borderTop: "1px solid var(--border)",
            padding: "24px 32px",
            display: "flex", justifyContent: "center", alignItems: "center", gap: 24,
            marginTop: 80,
          }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              PortaldotProver v1.0 · Built on Portaldot
            </span>
            <span style={{ color: "var(--border-bright)" }}>·</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              ink! v5 · substrate-contracts-node v0.41.0
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
