import { prisma } from "@/lib/prisma";
import { AdminRoomManager } from "@/components/admin-controls";

export default async function AdminRoomsPage() {
  const stored = await prisma.roomType.findMany({ include: { _count: { select: { rooms: true } }, seasonalRates: { orderBy: { startsOn: "asc" } } }, orderBy: { name: "asc" } });
  const rooms = stored.map((room) => ({
    ...room,
    basePrice: room.basePrice.toNumber(),
    inventory: room._count.rooms,
    seasonalRates: room.seasonalRates.map((rate) => ({ id: rate.id, startsOn: rate.startsOn.toISOString(), endsOn: rate.endsOn.toISOString(), nightlyRate: rate.nightlyRate.toNumber() }))
  }));
  return <section className="admin-page"><p className="eyebrow">Inventory & pricing</p><h1 className="page-title">Rooms & rates</h1><p className="section-copy">Manage bookable room types, physical room counts and seasonal nightly pricing.</p><AdminRoomManager rooms={rooms} /></section>;
}
