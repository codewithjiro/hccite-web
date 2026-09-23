import "~/styles/globals.css";

import type { Metadata } from "next";
import { ThemeProvider } from "~/components/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "HCCite | Research workspace",
    template: "%s | HCCite",
  },
  description: "A research and citation workspace for Holy Cross College.",
  icons: [{ rel: "icon", url: "/assets/app_logo.jpg" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
