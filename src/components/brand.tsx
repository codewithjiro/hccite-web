import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" aria-label="HCCite home">
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-0.5 ring-1 ring-border">
        <Image src="/assets/app_logo.jpg" width={88} height={88} alt="Holy Cross College seal" className="size-full object-contain" priority />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-tight tracking-tight text-foreground">HCCite</span>
        {!compact && <span className="block text-[11px] font-medium leading-tight text-muted-foreground">Holy Cross College research</span>}
      </span>
    </Link>
  );
}
