import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "../../../../lib/api";

type Props = { params: { handle: string } };

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.handle).catch(() => null);

  if (!product) {
    return notFound();
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="tag">Default PDP</div>
      <div
        className="glass"
        style={{
          padding: 20,
          display: "grid",
          gap: 18,
          gridTemplateColumns: "minmax(260px, 1fr) 1fr"
        }}
      >
        <div
          className="card"
          style={{
            height: 260,
            background:
              "radial-gradient(120% 80% at 50% 10%, rgba(13,214,198,0.2), transparent), rgba(255,255,255,0.04)",
            borderColor: "rgba(13,214,198,0.4)"
          }}
        />
        <div className="grid" style={{ gap: 10 }}>
          <h1 style={{ margin: 0 }}>{product.title}</h1>
          <p className="muted">{product.description ?? "A sleek product to verify theming + checkout."}</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Link className="btn" href="/cart">
              Add to cart
            </Link>
            <Link className="muted" href="/">
              Back
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
