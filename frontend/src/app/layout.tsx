import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/state/auth-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { ThemeProvider } from "@/state/theme-provider";
import { BackgroundProvider } from "@/state/background-provider";
import { AccentProvider } from "@/state/accent-provider";
import { OnlineProvider } from "@/state/online-provider";
import { LayoutModeProvider } from "@/state/layout-mode-provider";
import { IdShellPrecache } from "@/components/id/id-shell-precache";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Design brief §4: "Noto Serif Armenian for headings, Noto Sans Armenian
// for body, JetBrains Mono for marks" — every `font-mono` in this app
// resolves through this, not Geist Mono (globals.css's `--font-mono`).
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tessera",
  description: "Tessera — academic records and student ID",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col">
        <IdShellPrecache />
        <ThemeProvider>
          <BackgroundProvider>
            <AccentProvider>
              <LocaleProvider>
                <OnlineProvider>
                  <LayoutModeProvider>
                    <AuthProvider>{children}</AuthProvider>
                  </LayoutModeProvider>
                </OnlineProvider>
              </LocaleProvider>
            </AccentProvider>
          </BackgroundProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
