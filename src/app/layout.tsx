import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Anek_Bangla, Space_Grotesk } from "next/font/google";
import { QueryProvider } from "@/lib/query/provider";
import { ToastProvider } from "@/components/ui/Toast";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
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
  // The browser-chrome colour, kept in step with --qf-accent in globals.css.
  // Static on purpose: this is read from the served HTML before any script
  // runs, so it cannot follow a theme stored in localStorage, and the default
  // theme is the honest answer for it.
  themeColor: "#c43f3f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="bn"
      data-theme="red"
      /*
       * The pre-paint script below rewrites `data-theme` before React
       * hydrates, so on any theme but the default the attribute React
       * rendered and the attribute in the DOM genuinely differ. Without this,
       * React logs a hydration-mismatch error on every single page load for
       * everyone who chose another theme — and "won't be patched up", which is
       * the outcome we want, is not a thing to leave an error in the console
       * about. It suppresses the warning for this element's own attributes
       * only; children still hydrate under the normal rules.
       */
      suppressHydrationWarning
      className={`${hindSiliguri.variable} ${anekBangla.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        {/*
         * Before the first paint, not after hydration.
         *
         * The server has no idea which theme this browser chose — the choice
         * lives in localStorage — so the HTML always ships `data-theme="red"`.
         * Left to React, the correction would land after the page had already
         * painted, and every load would flash red for anyone using another
         * theme. This one line reads the stored value and fixes the attribute
         * while the document is still parsing.
         *
         * `dangerouslySetInnerHTML` is the only way to inline a script in the
         * App Router without Next deferring it; the content is a constant from
         * our own module, with no interpolated input.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <QueryProvider>
              <ToastProvider>{children}</ToastProvider>
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
