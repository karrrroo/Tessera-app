import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/state/auth-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { ThemeProvider } from "@/state/theme-provider";
import { BackgroundProvider } from "@/state/background-provider";
import { AccentProvider } from "@/state/accent-provider";
import { OnlineProvider } from "@/state/online-provider";
import { LayoutModeProvider } from "@/state/layout-mode-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
