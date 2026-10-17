import { prisma } from "@/lib/prisma";

export default async function AdminAuditPage() {
  const entries = await prisma.auditLog.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return <section className="admin-page"><p className="eyebrow">Accountability</p><h1 className="page-title">Audit log</h1><p className="section-copy">Recent booking, pricing and content changes.</p><div className="admin-list">{entries.map((entry) => <article className="admin-list-row" key={entry.id}><div><strong>{entry.action}</strong><small>{entry.entity} · {entry.entityId}</small></div><small>{entry.user?.name || entry.user?.email || "System"}</small><small>{entry.createdAt.toLocaleString()}</small></article>)}{entries.length === 0 && <p className="admin-empty">No activity recorded yet.</p>}</div></section>;
}
