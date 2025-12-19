import { Geist, Geist_Mono, Fira_Code, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { STORED_THEME_IDS, THEME_STORAGE_KEY } from "@/lib/editor-theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

function getThemeBootstrapScript(): string {
  return `(() => {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!('localStorage' in window)) return;

    var theme = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var allowed = ${JSON.stringify(STORED_THEME_IDS)};
    if (theme && allowed.indexOf(theme) !== -1) {
      document.documentElement.dataset.theme = theme;
    } else if (theme) {
      window.localStorage.removeItem(${JSON.stringify(THEME_STORAGE_KEY)});
    }
  } catch (e) {
    // Ignore storage access errors (e.g. blocked in some privacy modes)
  }
})();`;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {getThemeBootstrapScript()}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${firaCode.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
