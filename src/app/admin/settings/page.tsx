import { prisma } from "@/lib/prisma";
import { AdminSettingsForm } from "@/components/admin-settings-form";

export default async function AdminSettingsPage() {
  const settings = await prisma.hotelSetting.findUnique({ where: { id: 1 } });
  return <section className="admin-page"><p className="eyebrow">Resort configuration</p><h1 className="page-title">Settings</h1><p className="section-copy">These values are used in server-side quotes, customer notices and arrival reporting.</p><AdminSettingsForm settings={{
    name: settings?.name || "LuxuryStay Hotel & Resort",
    currency: settings?.currency || "INR",
    timezone: settings?.timezone || "Asia/Kolkata",
    taxPercent: settings?.taxPercent?.toNumber() ?? 12,
    cancellationHours: settings?.cancellationHours ?? 48,
    contactEmail: settings?.contactEmail || "",
    contactPhone: settings?.contactPhone || "",
    address: settings?.address || ""
  }} /></section>;
}
