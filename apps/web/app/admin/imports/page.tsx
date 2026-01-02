import {
  startShopifyCsvImport,
  startShopifyGraphqlImport,
  startAliExpressImport,
  getImportStatus
} from "../../../lib/api";
import { revalidatePath } from "next/cache";

async function startCsv(formData: FormData) {
  "use server";
  const filename = formData.get("filename")?.toString();
  const job = await startShopifyCsvImport(filename || undefined);
  revalidatePath("/admin/imports");
  return job;
}

async function startGraphql(formData: FormData) {
  "use server";
  const shopDomain = formData.get("shopDomain")?.toString() || "";
  const accessToken = formData.get("accessToken")?.toString() || "";
  const job = await startShopifyGraphqlImport(shopDomain, accessToken);
  revalidatePath("/admin/imports");
  return job;
}

async function startAliExpress(formData: FormData) {
  "use server";
  const url = formData.get("url")?.toString() || "";
  const job = await startAliExpressImport(url);
  revalidatePath("/admin/imports");
  return job;
}

export default async function ImportsPage() {
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="tag">Shopify import</div>
      <div className="glass" style={{ padding: 16, display: "grid", gap: 12 }}>
        <h2 className="section-title">Quick uploader</h2>
        <p className="muted">Choose CSV or API lane to pull products, variants, and images into this tenant.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <form action={startCsv} className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>CSV lane</div>
            <input name="filename" placeholder="shopify-export.csv" style={inputStyle} />
            <button className="btn" type="submit">
              Upload CSV
            </button>
            <small className="muted">Multipart endpoint `/imports/shopify/csv` accepts CSV; progress shown below.</small>
          </form>
          <form action={startGraphql} className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>GraphQL lane</div>
            <input name="shopDomain" placeholder="mystore.myshopify.com" style={inputStyle} required />
            <input name="accessToken" placeholder="Admin API token" style={inputStyle} required />
            <button className="btn" type="submit">
              Start GraphQL import
            </button>
            <small className="muted">POST `/imports/shopify/graphql` with domain + token.</small>
          </form>
          <form action={startAliExpress} className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>AliExpress URL</div>
            <input name="url" placeholder="https://www.aliexpress.com/..." style={inputStyle} required />
            <button className="btn" type="submit">
              Import URL
            </button>
            <small className="muted">Phase 1: URL-only; auto-ordering will use this source later.</small>
          </form>
        </div>
        <ProgressList />
      </div>
    </div>
  );
}

async function ProgressList() {
  // Placeholder; would fetch real jobs. For now show a static example.
  const example = { id: "demo-job", status: "processing", metadata: { progress: 100, message: "Imported placeholder" } };
  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Progress</div>
      <div className="muted" style={{ fontSize: 12 }}>
        Job ID: {example.id}
      </div>
      <ProgressBar percent={example.metadata.progress || 0} label={example.metadata.message} />
    </div>
  );
}

function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {label && <div className="muted" style={{ fontSize: 12 }}>{label}</div>}
      <div style={{ height: 10, borderRadius: 12, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: "linear-gradient(120deg, #0dd6c6, #4ade80)" }} />
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit"
};
