import Link from "next/link";

export default function CheckoutSuccess() {
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="tag">Order confirmed</div>
      <div className="glass" style={{ padding: 18 }}>
        <h1 style={{ marginTop: 0 }}>Thanks for your order!</h1>
        <p className="muted">
          We routed checkout through hosted payments to keep PCI scope small. Admin will see this in the seeded
          orders table.
        </p>
        <Link href="/" className="btn">
          Back to store
        </Link>
      </div>
    </div>
  );
}
