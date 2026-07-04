import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BeatCanvas | Premium Audio Visualizer Video Generator",
  description: "Transform your music into stunning, professional animated videos in seconds. Generate high-fidelity visualizer videos styled like NCS, Monstercat, and Trap Nation directly in your browser or on the server.",
  keywords: "audio visualizer, music visualizer, video generator, NCS style, trap nation visualizer, music video maker, spectrum rendering, FFmpeg WASM, Web Audio API",
  authors: [{ name: "BeatCanvas Team" }],
  openGraph: {
    title: "BeatCanvas | Free Premium Audio Visualizer Video Generator",
    description: "Generate beautiful, professional audio spectrum videos for YouTube, Instagram, and TikTok instantly. Real-time preview, multiple styles, high customization, and zero watermark.",
    url: "https://beatcanvas.com",
    siteName: "BeatCanvas",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BeatCanvas | Premium Audio Visualizer Video Generator",
    description: "Transform your music into professional animated visualizer videos in seconds.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="bg-background text-foreground min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
