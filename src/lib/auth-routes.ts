const privateRoots = [
  "/dashboard",
  "/research-articles",
  "/doi-lookup",
  "/books",
  "/ai-analyzer",
  "/studies",
  "/collections",
  "/profile",
  "/api",
];

// Match complete path segments so a public path such as /studies-guide stays public.
export function isPrivatePath(pathname: string): boolean {
  return privateRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

// UploadThing verifies its server callbacks with the SDK's signature handling in
// createRouteHandler. Keep the exception limited to that exact endpoint.
export function isUploadThingCallbackPath(pathname: string): boolean {
  return pathname === "/api/uploadthing";
}

export function apiAuthDecision(pathname: string, userId: string | null): "bypass" | "allow" | "deny" {
  if (isUploadThingCallbackPath(pathname)) return "bypass";
  if (!isPrivatePath(pathname)) return "bypass";
  return userId ? "allow" : "deny";
}

export function isUploadInitiationAuthenticated(userId: string | null | undefined): userId is string {
  return Boolean(userId);
}
