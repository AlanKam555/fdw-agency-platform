import type { MetadataRoute } from "next";
import { carePages, services } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || "http://localhost:3000";
  const paths = [
    "",
    "/services",
    "/care",
    "/journal",
    "/maids",
    "/testimonials",
    "/faq",
    "/contact",
    "/apply",
    "/employers/enquire",
    "/privacy",
    "/disclaimer",
    ...services.map((service) => `/services/${service.slug}`),
    ...carePages.map((page) => `/care/${page.slug}`),
  ];
  return paths.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));
}
