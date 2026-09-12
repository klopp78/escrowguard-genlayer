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
  metadataBase: new URL("https://escrowguard-genlayer.galaxthoo.chatgpt.site"),
  title: "EscrowGuard for GenLayer",
  description:
    "A GenLayer-powered escrow workflow that authorizes milestone releases only after consensus-reviewed evidence.",
  openGraph: {
    title: "EscrowGuard for GenLayer",
    description:
      "Consensus-reviewed milestone evidence and bounded payout authorization.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "EscrowGuard for GenLayer social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EscrowGuard for GenLayer",
    description:
      "Consensus-reviewed milestone evidence and bounded payout authorization.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
