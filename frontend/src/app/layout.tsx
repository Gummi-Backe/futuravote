import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { NavigationTracker } from "@/app/components/NavigationTracker";
import { HelpButton } from "@/app/components/HelpButton";
import { SiteFooter } from "@/app/components/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de"),
  title: "Future-Vote",
  description: "Future-Vote - Kachelbasierte Plattform für Zukunftsprognosen und Abstimmungen",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Future-Vote",
    description: "Kachelbasierte Plattform für Zukunftsprognosen und Abstimmungen.",
    type: "website",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Future-Vote" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Future-Vote",
    description: "Kachelbasierte Plattform für Zukunftsprognosen und Abstimmungen.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Suspense fallback={null}>
          <NavigationTracker />
        </Suspense>
        <Suspense fallback={null}>
          <HelpButton />
        </Suspense>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
