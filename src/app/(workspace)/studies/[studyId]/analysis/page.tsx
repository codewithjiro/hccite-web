import { requireUserId } from "~/server/auth";

export default async function Page() {
  await requireUserId();
  return <StudyView title="Analysis" phase="07" description="Document extraction and a persistent study profile will appear here." />;
}

function StudyView({ title, phase, description }: { title: string; phase: string; description: string }) {
  return <section className="mt-7 rounded-2xl border border-border bg-card p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Planned for phase {phase}</p><h2 className="mt-2 text-xl font-semibold">{title}</h2><p className="mt-3 leading-7 text-muted-foreground">{description} This view is a route placeholder; it contains no study data.</p></section>;
}
