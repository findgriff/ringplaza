import Link from "next/link";

const features = [
  { title: "Multi-tenant core", text: "Isolated data per shop with domain + theme overlays." },
  { title: "Checkout ready", text: "Stripe + PayPal hosted flows to keep PCI scope minimal." },
  { title: "AliExpress seeding", text: "CSV/API import path to launch with curated products fast." },
  { title: "Theme controls", text: "Palette toggles, typography, hero blocks, and widget slots." }
];

const metrics = [
  { label: "Seed to live", value: "<30m", hint: "Provision a second tenant with fixtures" },
  { label: "Plans", value: "$6.99 / $15.99", hint: "Starter vs Unlimited, AppSumo compatible" },
  { label: "Orders", value: "100 + grace", hint: "Starter order gating with upgrade banner" }
];

export default function HomePage() {
  return (
    <div className="grid" style={{ gap: 20 }}>
      <section className="glass" style={{ padding: 22, display: "grid", gap: 16 }}>
        <div className="pill">
          <span>Commerce that flows</span>
        </div>
        <h1 style={{ fontSize: 42, margin: "0 0 6px" }}>Your pocket empire.</h1>
        <p className="muted" style={{ maxWidth: 620, margin: 0 }}>
          RingPlaza is a multi-tenant storefront SaaS with a polished default theme, tenant-aware API,
          and hosted checkout rails. Ship vertical stores in minutes, keep infra lean, and own your
          stack.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link className="btn" href="/onboarding">
            Launch a tenant
          </Link>
          <Link className="muted" href="/admin">
            View admin shell →
          </Link>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {features.map((f) => (
          <div key={f.title} className="card">
            <div className="tag">{f.title}</div>
            <p className="muted" style={{ marginTop: 10 }}>
              {f.text}
            </p>
          </div>
        ))}
      </section>

      <section className="glass" style={{ padding: 20 }}>
        <h2 className="section-title">Default product</h2>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(260px, 1fr) 1fr",
            alignItems: "center"
          }}
        >
          <div
            className="card"
            style={{
              height: 260,
              background:
                "radial-gradient(120% 80% at 30% 20%, rgba(13,214,198,0.25), transparent), rgba(255,255,255,0.02)",
              display: "grid",
              placeItems: "center",
              borderColor: "rgba(13,214,198,0.4)"
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                border: "2px dashed rgba(255,255,255,0.4)",
                display: "grid",
                placeItems: "center"
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0dd6c6, #4ade80)",
                  boxShadow: "0 10px 40px rgba(13,214,198,0.35)"
                }}
              />
            </div>
          </div>
          <div className="grid" style={{ gap: 10 }}>
            <div className="tag">Aurora Band</div>
            <p className="muted" style={{ margin: 0 }}>
              Default PDP seeded from AliExpress/CSV imports. Variants, price rules, search-ready.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link className="btn" href="/shop/demo-ring">
                View PDP
              </Link>
              <Link className="muted" href="/cart">
                Cart & checkout
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {metrics.map((metric) => (
          <div key={metric.label} className="card" style={{ background: "rgba(13,214,198,0.04)" }}>
            <div className="muted" style={{ fontSize: 13 }}>
              {metric.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, margin: "6px 0" }}>{metric.value}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {metric.hint}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
