import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/state/auth-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { isLocale, parseAcceptLanguage, resolveLocaleFromLanguages } from "@/i18n/resolve-locale";
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

// The one place a locale is resolved for the very first paint — a Server
// Component can read the `tessera.locale` cookie (set client-side by
// LocaleProvider whenever the user changes it) but never localStorage, so
// this cookie is the only thing that can make the server's own HTML already
// agree with what the client is about to render. Falling back to
// Accept-Language here (not to navigator.languages, which doesn't exist on
// the server) mirrors the exact same default-hy/en/ru rule the client used
// to apply on its own — see resolve-locale.ts.
async function resolveInitialLocale() {
  const cookieStore = await cookies();
  const stored = cookieStore.get("tessera.locale")?.value;
  if (isLocale(stored)) return stored;
  const acceptLanguage = (await headers()).get("accept-language");
  return resolveLocaleFromLanguages(parseAcceptLanguage(acceptLanguage));
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialLocale = await resolveInitialLocale();
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
              <LocaleProvider initialLocale={initialLocale}>
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
