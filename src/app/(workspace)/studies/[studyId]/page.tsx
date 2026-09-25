import { notFound } from "next/navigation";
import { formatPhilippineDateTime } from "~/lib/dates";
import { StudyDeleteButton } from "~/components/study-delete-button";
import { getStudy } from "~/server/repositories/studies";
import StudyAnalysisPage from "./analysis/page";

export default async function Page({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  let study;
  try { study = await getStudy(studyId); } catch { notFound(); }
  return <><section className="mt-7 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Study details</p><h2 className="mt-2 break-words text-2xl font-bold">{study.originalFileName}</h2><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><Item label="File type" value={study.fileType.toUpperCase()} /><Item label="Lifecycle status" value={study.status} /><Item label="Uploaded" value={formatPhilippineDateTime(study.createdAt)} /><Item label="Last updated" value={formatPhilippineDateTime(study.updatedAt)} /></dl><div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6"><p className="font-semibold">Metadata is owner-protected in HCCite.</p><p className="mt-1 text-muted-foreground">The UploadThing free-tier stored file URL may be publicly accessible by URL. Clerk does not make that provider URL private.</p></div><div className="mt-7"><StudyDeleteButton studyId={study.id} /></div></section><StudyAnalysisPage params={params} /></>;
}

function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium capitalize">{value}</dd></div>; }
