import { prisma } from "@/lib/prisma";

export default async function AdminCustomersPage() {
  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    select: { id: true, name: true, email: true, createdAt: true, _count: { select: { bookings: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return <section className="admin-page"><p className="eyebrow">Customer records</p><h1 className="page-title">Customers</h1><p className="section-copy">Limited account details for service purposes. Full booking contact details remain in the booking record.</p><div className="admin-list">{customers.map((customer) => <article className="admin-list-row" key={customer.id}><div><strong>{customer.name || "Guest account"}</strong><small>{customer.email}</small></div><span>{customer._count.bookings} bookings</span><small>Joined {customer.createdAt.toLocaleDateString()}</small></article>)}{customers.length === 0 && <p className="admin-empty">No customer accounts yet.</p>}</div></section>;
}
