export const featureGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", phase: "12", description: "Research activity and next steps." },
      { label: "Research articles", href: "/research-articles", phase: "04", description: "Discover scholarly articles and review source details." },
      { label: "DOI & citation lookup", href: "/doi-lookup", phase: "04", description: "Check a DOI and inspect citation metadata." },
      { label: "Books", href: "/books", phase: "04", description: "Find books for your research." },
    ],
  },
  {
    label: "Your research",
    items: [
      { label: "AI analyzer", href: "/ai-analyzer", phase: "07", description: "Analyze a study with a persistent profile." },
      { label: "My studies", href: "/studies", phase: "06", description: "Upload and manage study documents." },
      { label: "Collections", href: "/collections", phase: "05", description: "Organize saved sources and notes." },
    ],
  },
] as const;

export type Feature = { label: string; href: string; phase: string; description: string };
export const features: Feature[] = featureGroups.flatMap((group): Feature[] => [...group.items]);

export function findFeature(pathname: string) {
  return features.find((item) => item.href === pathname);
}
