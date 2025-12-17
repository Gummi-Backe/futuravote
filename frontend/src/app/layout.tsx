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
  title: "Future-Vote",
  description: "Future-Vote - Kachelbasierte Plattform für Zukunftsprognosen und Abstimmungen",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
