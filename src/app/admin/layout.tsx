import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/authz";

const links = [
  ["Overview", "/admin"],
  ["Rooms & rates", "/admin/rooms"],
  ["Bookings", "/admin/bookings"],
  ["Offers", "/admin/offers"],
  ["Customers", "/admin/customers"],
  ["Messages", "/admin/messages"],
  ["Reports", "/admin/reports"],
  ["Audit log", "/admin/audit"],
  ["Settings", "/admin/settings"]
];

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return <div className="admin-shell"><aside className="admin-sidebar"><p className="eyebrow">LuxuryStay</p><h2>Administration</h2><nav aria-label="Admin navigation">{links.map(([name, href]) => <Link href={href} key={href}>{name}</Link>)}</nav><Link className="text-link" href="/">View website ↗</Link></aside><div className="admin-content">{children}</div></div>;
}
