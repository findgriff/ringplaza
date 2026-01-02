import Link from "next/link";

export default function CheckoutCancelled() {
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="tag">Checkout cancelled</div>
      <div className="glass" style={{ padding: 18 }}>
        <h1 style={{ marginTop: 0 }}>Payment was cancelled</h1>
        <p className="muted">No worries—your cart is still here if you want to try again.</p>
        <Link href="/cart" className="btn">
          Return to cart
        </Link>
      </div>
    </div>
  );
}
