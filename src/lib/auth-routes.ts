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
