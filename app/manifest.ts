import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BookCircle",
    short_name: "BookCircle",
    description: "Read. Reflect. Grow together.",
    start_url: "/home",
    display: "standalone",
    background_color: "#FAF9F6",
    theme_color: "#393B93",
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
