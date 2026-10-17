"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="empty-page"><p className="eyebrow">A momentary pause</p><h1>We need a moment.</h1><p>Your request could not be completed just now.</p><div className="error-actions"><button className="button button-dark" onClick={() => reset()}>Try again</button><Link className="text-link" href="/">Return home ↗</Link></div></section>;
}
