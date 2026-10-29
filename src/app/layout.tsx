import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getSettings } from "@/server/services/settings";
import { brand } from "@/config/brand";
import "./globals.css";

// Personal data changes constantly; render every request from the database.
export const dynamic = "force-dynamic";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Newsreader({ variable: "--font-display", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brand.themeColorLight },
    { media: "(prefers-color-scheme: dark)", color: brand.themeColorDark },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let accent: string = brand.defaultAccent;
  let theme = "system";
  try {
    const s = await getSettings();
    accent = s.accent;
    theme = s.theme;
  } catch {
    // Database not initialized yet; the app shell shows setup guidance.
  }
  return (
    <html
      lang="en"
      data-accent={accent}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme={theme} enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={400}>
            {children}
            <Toaster position="bottom-right" closeButton richColors={false} offset={{ bottom: 16 }} mobileOffset={{ bottom: 80 }} />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
