import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import SupabaseProvider from "@/components/SupabaseProvider";
import "./globals.css";

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "BookCircle · Read. Reflect. Grow.",
    template: "%s · BookCircle",
  },
  description:
    "A private circle for good books, meaningful conversations, and small changes that last.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BookCircle",
  },
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "BookCircle",
    title: "BookCircle · Read. Reflect. Grow.",
    description:
      "A private circle for good books, meaningful conversations, and small changes that last.",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#245C4F",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable} antialiased`}>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
