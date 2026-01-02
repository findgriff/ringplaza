import Link from "next/link";
import { redirect } from "next/navigation";
import { capturePayPalOrder, createPayPalOrder, createStripeCheckoutSession } from "../../lib/api";

async function payWithStripe() {
  "use server";
  const session = await createStripeCheckoutSession(13800, "USD");
  redirect(session.url);
}

async function payWithPayPal() {
  "use server";
  const session = await createPayPalOrder(13800, "USD");
  if (session.url) {
    redirect(session.url);
  }
  return null;
}

export default function CartPage() {
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="tag">Cart</div>
      <div className="glass" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Aurora Band</strong>
            <div className="muted">Size 7 · $138.00</div>
          </div>
          <div className="muted">Qty 2</div>
        </div>
        <hr style={{ border: "1px solid var(--border)", margin: "16px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div>
            <div className="muted">Total</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>$138.00</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <form action={payWithStripe}>
              <button className="btn" type="submit" name="provider" value="stripe">
                Pay with Stripe
              </button>
            </form>
            <form action={payWithPayPal}>
              <button
                className="btn"
                type="submit"
                name="provider"
                value="paypal"
                style={{ background: "linear-gradient(120deg, #fbbf24, #f59e0b)", color: "#0b1220" }}
              >
                Pay with PayPal
              </button>
            </form>
          </div>
        </div>
      </div>
      <Link href="/" className="muted">
        Continue shopping
      </Link>
    </div>
  );
}
