import "~/styles/globals.css";

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
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
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {clerkConfigured ? (
            <ClerkProvider
              signInUrl="/sign-in"
              signUpUrl="/sign-up"
              signInFallbackRedirectUrl="/dashboard"
              signUpFallbackRedirectUrl="/dashboard"
            >
              {children}
            </ClerkProvider>
          ) : children}
        </ThemeProvider>
      </body>
    </html>
  );
}
