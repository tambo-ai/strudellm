import { Geist, Geist_Mono, Fira_Code, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

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

const THEME_STORAGE_KEY = "strudel-editor-theme";

function getThemeBootstrapScript(): string {
  return `(() => {
  try {
    var theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});

    // Guard against corrupted values.
    if (theme && /^[a-z0-9-]+$/.test(theme)) {
      document.documentElement.dataset.theme = theme;
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
