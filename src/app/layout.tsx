import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nestwell Operations",
  description: "Nestwell's family-run operations hub — jobs, time tracking and earnings for the crew.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Nestwell Crew", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#2f4e3d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
