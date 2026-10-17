import { prisma } from "@/lib/prisma";
import { AdminMessageAction } from "@/components/admin-controls";

export default async function AdminMessagesPage() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return <section className="admin-page"><p className="eyebrow">Guest correspondence</p><h1 className="page-title">Messages</h1><p className="section-copy">Enquiries are stored for the team and retained until your data policy says otherwise.</p><div className="admin-list">{messages.map((message) => <article className="admin-message" key={message.id}><div className="admin-list-row"><div><strong>{message.subject}</strong><small>{message.name} · {message.email} · {message.createdAt.toLocaleString()}</small></div><AdminMessageAction id={message.id} readAt={message.readAt?.toISOString() || null} /></div><p>{message.message}</p></article>)}{messages.length === 0 && <p className="admin-empty">No messages yet.</p>}</div></section>;
}
