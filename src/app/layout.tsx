import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlightResist AI 2.0 — Autonomous Travel Recovery Intelligence",
  description:
    "When an active journey breaks, FlightResist assesses downstream impact across the entire itinerary and executes an optimal recovery with a single confirmation. Alibaba Cloud × Atlas Agentic AI Hackathon 2026.",
  keywords: [
    "FlightResist",
    "agentic AI",
    "travel recovery",
    "trip impact graph",
    "deterministic optimization",
    "Atlas",
    "Alibaba Cloud",
    "hackathon",
  ],
  authors: [{ name: "FlightResist AI" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "FlightResist AI 2.0",
    description: "Autonomous travel recovery intelligence — impact graph, deterministic pruning, 1-tap execution.",
    siteName: "FlightResist AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlightResist AI 2.0",
    description: "Autonomous travel recovery intelligence — impact graph, deterministic pruning, 1-tap execution.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Set the theme class before first paint to avoid a flash of the wrong
            theme. Mirrors next-themes' storage contract: `theme` = light | dark |
            system, defaulting to dark (the console is designed dark-first). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&(t==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches:true));if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-black focus:rounded focus:font-semibold focus:text-sm"
          >
            Skip to main content
          </a>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
