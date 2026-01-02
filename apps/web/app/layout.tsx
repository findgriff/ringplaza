import "./globals.css";
import { Inter } from "next/font/google";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "RingPlaza",
  description: "Your pocket empire. Multi-tenant storefronts that flow."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <header className="shell" style={{ paddingBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background:
                    "conic-gradient(from 140deg, rgba(13,214,198,0.2), rgba(13,214,198,0.7), rgba(74,222,128,0.6), rgba(13,214,198,0.2))",
                  border: "1px solid var(--border)",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 10px 30px rgba(13,214,198,0.3)"
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "2px solid #0b1220",
                    background: "rgba(255,255,255,0.8)"
                  }}
                />
              </div>
              <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: 0.5 }}>RingPlaza</span>
            </Link>
            <nav style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Link href="/onboarding" className="muted">
                Onboarding
              </Link>
              <Link href="/admin" className="muted">
                Admin
              </Link>
              <Link href="/admin/imports" className="muted">
                Imports
              </Link>
              <Link href="/admin/plan" className="muted">
                Plan
              </Link>
              <Link href="/cart" className="btn" style={{ padding: "10px 14px" }}>
                Cart
              </Link>
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
