import Link from "next/link";

export default function NotFound() {
  return <section className="empty-page"><p className="eyebrow">A quiet detour</p><h1>This page wandered off.</h1><p>Let us help you find your way back to a little rest.</p><Link className="button button-dark" href="/">Return home</Link></section>;
}
