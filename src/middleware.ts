import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { isPrivatePath } from "~/lib/auth-routes";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const withClerk = clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      if (!isPrivatePath(request.nextUrl.pathname)) return;

      if (request.nextUrl.pathname.startsWith("/api/")) {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        return;
      }

      const { userId, redirectToSignIn } = await auth();
      if (!userId) return redirectToSignIn({ returnBackUrl: request.url });
    })
  : null;

export default function middleware(request: NextRequest, event: Parameters<NonNullable<typeof withClerk>>[1]) {
  if (!withClerk) {
    if (isPrivatePath(request.nextUrl.pathname)) {
      if (request.nextUrl.pathname === "/api" || request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
      }
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
    return NextResponse.next();
  }
  return withClerk(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
