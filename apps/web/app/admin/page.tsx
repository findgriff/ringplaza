import { getAdminMetrics, getAdminUsage } from "../../lib/api";

const list = [
  { label: "Top product", value: "Aurora Band", hint: "42 orders" },
  { label: "Traffic", value: "14.2k sessions", hint: "Search + social" },
  { label: "Webhooks", value: "order.paid", hint: "Webhook/Discord" }
];

export default async function AdminPage() {
  const { series } = await getAdminMetrics().catch(() => ({ series: [] }));
  const usage = await getAdminUsage().catch(() => ({ planId: "starter", orderLimit: 100, usage: 0, graceRemaining: 10, allowed: true }));
  const latest = series[series.length - 1];
  const totalRevenue = series.reduce((sum, s) => sum + s.revenue_cents, 0);
  const totalOrders = series.reduce((sum, s) => sum + s.orders, 0);
  const cards = [
    { title: "GMV (total)", value: `$${(totalRevenue / 100).toFixed(2)}`, delta: "" },
    { title: "AOV (latest)", value: latest ? `$${(latest.aov_cents / 100).toFixed(2)}` : "$0.00", delta: "" },
    { title: "Orders", value: `${totalOrders}`, delta: "" }
  ];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="tag">Admin dashboard</div>
      <UsageBanner usage={usage.usage} limit={usage.orderLimit} graceRemaining={usage.graceRemaining} planId={usage.planId} allowed={usage.allowed} />
      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {cards.map((card) => (
          <div key={card.title} className="card">
            <div className="muted">{card.title}</div>
            <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0" }}>{card.value}</div>
            <div style={{ color: "#4ade80", fontWeight: 600 }}>{card.delta}</div>
          </div>
        ))}
      </section>

      <section className="glass" style={{ padding: 16 }}>
        <h2 className="section-title">Ops + billing</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {list.map((item) => (
            <li
              key={item.label}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{item.label}</div>
                <div className="muted">{item.hint}</div>
              </div>
              <div>{item.value}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass" style={{ padding: 16 }}>
        <h2 className="section-title">Daily metrics</h2>
        {series.length === 0 ? (
          <div className="muted">No metrics yet.</div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            <MetricChart title="Orders" series={series} field="orders" accent="var(--accent)" />
            <MetricChart title="Revenue" series={series} field="revenue_cents" accent="#4ade80" formatter={(v) => `$${(v / 100).toFixed(2)}`} />
            <MetricChart title="AOV" series={series} field="aov_cents" accent="#fbbf24" formatter={(v) => `$${(v / 100).toFixed(2)}`} />
          </div>
        )}
      </section>
    </div>
  );
}

type MetricChartProps = {
  title: string;
  field: "orders" | "revenue_cents" | "aov_cents";
  series: Awaited<ReturnType<typeof getAdminMetrics>>["series"];
  accent: string;
  formatter?: (v: number) => string;
};

function MetricChart({ title, series, field, accent, formatter }: MetricChartProps) {
  const max = Math.max(...series.map((s) => Number(s[field]))); 
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          Last {series.length} days
        </div>
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {series.map((point) => {
          const value = Number(point[field]);
          const pct = max ? (value / max) * 100 : 0;
          return (
            <div key={`${title}-${point.day}`} style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span className="muted">{point.day}</span>
                <span style={{ fontWeight: 600 }}>{formatter ? formatter(value) : value}</span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden"
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: accent,
                    transition: "width 200ms ease"
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type UsageBannerProps = {
  usage: number;
  limit?: number | null;
  graceRemaining: number;
  planId?: string;
  allowed: boolean;
};

function UsageBanner({ usage, limit, graceRemaining, planId, allowed }: UsageBannerProps) {
  const limitDisplay = limit ? `${usage}/${limit}` : `${usage}`;
  const status = !allowed ? "Blocked at limit" : limit ? (usage >= limit ? "In grace" : "Within limit") : "Unlimited";
  return (
    <div className="glass" style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div className="muted" style={{ fontSize: 12 }}>
          Plan: {planId ?? "unknown"}
        </div>
        <div style={{ fontWeight: 700 }}>
          Orders this month: {limitDisplay}
          {limit && usage >= limit ? ` (+${graceRemaining} grace remaining)` : ""}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {status}
        </div>
      </div>
      {!allowed && (
        <button className="btn" style={{ padding: "10px 14px" }}>
          Upgrade plan
        </button>
      )}
    </div>
  );
}
