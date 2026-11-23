import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BookCircle",
    short_name: "Circle",
    description: "Read. Reflect. Grow together.",
    start_url: "/home",
    display: "standalone",
    background_color: "#FAF6EF",
    theme_color: "#FAF6EF",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
