import Link from "next/link";

export default function OnboardingPage() {
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="tag">Provision a tenant</div>
      <div className="glass" style={{ padding: 18, display: "grid", gap: 10 }}>
        <h1 style={{ margin: 0 }}>Fast launch</h1>
        <p className="muted">
          CLI/API provisioning will create a tenant, seed defaults, and attach preview domain
          {` {shop}.shops.ringplaza.com`}. Add a custom domain later.
        </p>
        <ol style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", lineHeight: 1.6 }}>
          <li>Run migrations + seed (npm run migrate && npm run seed).</li>
          <li>POST /api/tenants with slug + plan to spawn another store.</li>
          <li>Point DNS at app.ringplaza.com or use preview domains for QA.</li>
        </ol>
        <Link href="/" className="btn" style={{ width: "fit-content" }}>
          Back home
        </Link>
      </div>
    </div>
  );
}
