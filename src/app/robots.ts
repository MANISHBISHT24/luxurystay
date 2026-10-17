import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/dashboard", "/my-bookings"] },
    sitemap: new URL("/sitemap.xml", process.env.AUTH_URL || "http://localhost:3000").toString()
  };
}
