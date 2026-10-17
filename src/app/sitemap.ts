import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.AUTH_URL || "http://localhost:3000";
  const pages = ["", "/rooms", "/about", "/amenities", "/dining", "/experiences", "/gallery", "/offers", "/contact", "/faq", "/privacy", "/terms"];
  return pages.map((page) => ({ url: new URL(page || "/", base).toString(), changeFrequency: "weekly", priority: page ? 0.7 : 1 }));
}
