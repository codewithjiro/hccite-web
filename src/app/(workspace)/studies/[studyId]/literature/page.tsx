import { notFound } from "next/navigation";
import { LiteratureWorkspace } from "~/components/literature-workspace";
import { deriveLiteratureQueries } from "~/server/literature/core";
import { listStudyRelatedSources } from "~/server/repositories/literature";
import { getOwnedStudyProfile } from "~/server/repositories/studies";

export default async function Page({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  try {
    const data = await getOwnedStudyProfile(studyId);
    if (data.study.status !== "ready" || !data.profile) return <section className="mt-7 rounded-2xl border border-border bg-card p-6 sm:p-8"><h2 className="text-xl font-semibold">Related literature</h2><p className="mt-3 text-muted-foreground">Complete Study analysis before searching for related literature.</p></section>;
    return <LiteratureWorkspace study={{ id: data.study.id, title: data.study.title }} initialQueries={deriveLiteratureQueries(data.profile)} initialAssociated={await listStudyRelatedSources(studyId)} />;
  } catch { notFound(); }
}
