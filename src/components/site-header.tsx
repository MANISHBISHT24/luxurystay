import Link from "next/link";
import { auth } from "@/auth";

const links = [
  ["Stay", "/rooms"],
  ["The resort", "/about"],
  ["Experiences", "/experiences"],
  ["Dining", "/dining"],
  ["Offers", "/offers"]
];

export async function SiteHeader() {
  const session = await auth().catch(() => null);
  const accountHref = session?.user?.role === "ADMIN" ? "/admin" : "/dashboard";
  const accountLabel = session?.user?.role === "ADMIN" ? "Admin" : "My stays";

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="LuxuryStay home">
        <span className="brand-mark">L</span>
        <span className="brand-name">LUXURYSTAY<small>HOTEL &amp; RESORT</small></span>
      </Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <div className="header-actions">
        {session?.user ? (
          <Link className="text-link" href={accountHref}>{accountLabel}</Link>
        ) : (
          <Link className="text-link" href="/login">Sign in</Link>
        )}
        <Link className="button button-dark header-book" href="/rooms">Book your stay</Link>
      </div>
      <details className="mobile-menu">
        <summary aria-label="Open navigation"><span></span><span></span></summary>
        <nav aria-label="Mobile navigation">
          {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          <Link href="/gallery">Gallery</Link>
          <Link href="/contact">Contact</Link>
          {session?.user ? (
            <Link href={accountHref}>{accountLabel}</Link>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </details>
    </header>
  );
}
