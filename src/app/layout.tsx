import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Anek_Bangla, Space_Grotesk } from "next/font/google";
import { QueryProvider } from "@/lib/query/provider";
import { ToastProvider } from "@/components/ui/Toast";
import { site } from "@/config/site";
import "./globals.css";

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind-siliguri",
});
const anekBangla = Anek_Bangla({
  subsets: ["bengali", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-anek-bangla",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#db4a4a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="bn"
      className={`${hindSiliguri.variable} ${anekBangla.variable} ${spaceGrotesk.variable}`}
    >
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
