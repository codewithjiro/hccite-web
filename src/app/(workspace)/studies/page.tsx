import Link from "next/link";
import { FileText } from "lucide-react";
import { env } from "~/env";
import { StudyUpload } from "~/components/study-upload";
import { listStudies } from "~/server/repositories/studies";

export default async function Page() {
  const studies = await listStudies();
  return <div className="mx-auto max-w-5xl py-2 sm:py-6">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Your research</p><h1 className="mt-2 text-3xl font-bold tracking-tight">My Studies</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Upload and manage the study documents attached to your HCCite workspace. Analysis begins in a later phase.</p></div>
    <StudyUpload maxFileMb={env.MAX_STUDY_FILE_MB} />
    <section className="mt-8"><h2 className="text-xl font-semibold">Uploaded studies</h2>{studies.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">No studies yet. Upload a non-confidential demo PDF or DOCX to begin.</div> : <div className="mt-4 grid gap-4 sm:grid-cols-2">{studies.map((study) => <Link key={study.id} href={`/studies/${study.id}`} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted"><div className="flex gap-3"><FileText className="mt-1 size-5 text-primary" aria-hidden="true" /><div className="min-w-0"><h3 className="truncate font-semibold">{study.originalFileName}</h3><p className="mt-1 text-sm text-muted-foreground">{study.fileType.toUpperCase()} · <Status status={study.status} /></p><p className="mt-3 text-xs text-muted-foreground">Uploaded {study.createdAt.toLocaleDateString()} · Updated {study.updatedAt.toLocaleDateString()}</p></div></div></Link>)}</div>}</section>
  </div>;
}

function Status({ status }: { status: "uploaded" | "processing" | "ready" | "failed" }) { return <span className="font-medium capitalize">{status}</span>; }
