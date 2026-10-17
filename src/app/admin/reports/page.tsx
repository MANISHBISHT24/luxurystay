import Link from "next/link";

export default function AdminReportsPage() {
  return <section className="admin-page"><p className="eyebrow">Exportable operations data</p><h1 className="page-title">Reports</h1><p className="section-copy">Download a CSV of up to 10,000 recent bookings with server-calculated totals. Access is limited to administrators.</p><Link className="button button-dark" href="/api/admin/reports">Download bookings CSV</Link></section>;
}
