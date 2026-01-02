import Link from "next/link";
import { redirect } from "next/navigation";
import { createBillingPortal, createBillingSubscription, getAdminUsage } from "../../../lib/api";

const priceIds = {
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER || "",
  unlimited: process.env.NEXT_PUBLIC_STRIPE_PRICE_UNLIMITED || ""
};

async function upgrade(plan: "starter" | "unlimited") {
  "use server";
  const priceId = priceIds[plan];
  if (!priceId) {
    throw new Error("Missing price ID");
  }
  const session = await createBillingSubscription(priceId);
  redirect(session.url);
}

async function portal() {
  "use server";
  const session = await createBillingPortal();
  redirect(session.url);
}

export default async function PlanPage() {
  const usage = await getAdminUsage().catch(() => ({ planId: "starter", orderLimit: 100, usage: 0, graceRemaining: 10, allowed: true }));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="tag">Plan & Billing</div>
      <div className="glass" style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Current plan
            </div>
            <div style={{ fontWeight: 700, fontSize: 22, textTransform: "capitalize" }}>{usage.planId ?? "starter"}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Orders this month: {usage.usage}
            </div>
          </div>
          <form action={portal}>
            <button className="btn" type="submit">
              Open billing portal
            </button>
          </form>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <PlanCard name="Starter" price="$6.99" description="Up to 100 orders + 10 grace" cta="Stay/Choose" onSelect={() => upgrade("starter")} />
          <PlanCard name="Unlimited" price="$15.99" description="Unlimited orders" cta="Upgrade" onSelect={() => upgrade("unlimited")} />
        </div>
        <Link href="/admin" className="muted">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function PlanCard(props: { name: string; price: string; description: string; cta: string; onSelect: () => Promise<void> }) {
  return (
    <form action={props.onSelect} className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700 }}>{props.name}</div>
      <div style={{ fontSize: 24 }}>{props.price}</div>
      <div className="muted" style={{ fontSize: 13 }}>
        {props.description}
      </div>
      <button className="btn" type="submit" style={{ width: "fit-content" }}>
        {props.cta}
      </button>
    </form>
  );
}
