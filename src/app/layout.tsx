import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Ambient } from "@/components/Ambient";
import { NotWastedProvider } from "@/context/NotWastedContext";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Not Wasted — Surplus saved",
  description: "Org-to-org surplus exchange connecting institutional donors with verified food banks, shelters, furniture banks and clothing closets. Powered by OCI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${playfair.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Ambient />
        <div className="relative z-10">
          <NotWastedProvider>{children}</NotWastedProvider>
        </div>
      </body>
    </html>
  );
}
