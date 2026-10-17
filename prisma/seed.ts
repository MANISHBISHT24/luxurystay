import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

const rooms = [
  { slug: "garden-suite", name: "Garden Suite", description: "A light-filled hideaway with a private garden terrace and room to unwind.", maxGuests: 2, bedSummary: "King bed", areaSqm: 58, basePrice: 18500, imageUrl: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=85" },
  { slug: "pool-villa", name: "Pool Villa", description: "A secluded villa with a plunge pool, outdoor shower and generous living space.", maxGuests: 3, bedSummary: "King bed · daybed", areaSqm: 92, basePrice: 28500, imageUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=85" },
  { slug: "residence-suite", name: "Residence Suite", description: "A calm, expansive residence for longer stays and unhurried gatherings.", maxGuests: 4, bedSummary: "King bed · twin beds", areaSqm: 118, basePrice: 38500, imageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85" }
];

const amenities = [
  { name: "Restorative spa", description: "A considered menu of treatments and quiet spaces to unwind.", icon: "sparkles" },
  { name: "Infinity pool", description: "An open-air pool for slow afternoons and early swims.", icon: "waves" },
  { name: "Movement studio", description: "Small-group sessions and room for your own practice.", icon: "activity" },
  { name: "Garden dining", description: "Season-led menus inspired by local ingredients.", icon: "utensils" }
];

async function main() {
  await prisma.hotelSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "LuxuryStay Hotel & Resort", currency: "INR", timezone: "Asia/Kolkata", taxPercent: 12, cancellationHours: 48 }
  });
  for (const room of rooms) {
    const saved = await prisma.roomType.upsert({
      where: { slug: room.slug },
      update: room,
      create: { ...room, featured: true }
    });
    await prisma.room.createMany({
      data: Array.from({ length: 4 }, (_, index) => ({ typeId: saved.id, number: room.slug.slice(0, 2).toUpperCase() + "-" + (index + 1).toString().padStart(2, "0") })),
      skipDuplicates: true
    });
  }
  for (const amenity of amenities) {
    await prisma.amenity.upsert({ where: { name: amenity.name }, update: amenity, create: amenity });
  }
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = process.env.ADMIN_EMAIL.toLowerCase();
    await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN" },
      create: {
        email,
        name: "LuxuryStay Administrator",
        passwordHash: await hash(process.env.ADMIN_PASSWORD, 12),
        emailVerified: new Date(),
        role: "ADMIN"
      }
    });
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error("Seed failed.", error);
    process.exitCode = 1;
  });
