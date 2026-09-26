export const featureGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", description: "Research activity and next steps." },
      { label: "Research articles", href: "/research-articles", description: "Discover scholarly articles and review source details." },
      { label: "DOI & citation lookup", href: "/doi-lookup", description: "Check a DOI and inspect citation metadata." },
      { label: "Books", href: "/books", description: "Find books for your research." },
    ],
  },
  {
    label: "Your research",
    items: [
      { label: "AI analyzer", href: "/ai-analyzer", description: "Analyze a study with a persistent profile." },
      { label: "My studies", href: "/studies", description: "Upload and manage study documents." },
      { label: "Collections", href: "/collections", description: "Organize saved sources and notes." },
    ],
  },
] as const;

export type Feature = { label: string; href: string; description: string };
export const features: Feature[] = featureGroups.flatMap((group): Feature[] => [...group.items]);

export function findFeature(pathname: string) {
  return features.find((item) => item.href === pathname);
}
