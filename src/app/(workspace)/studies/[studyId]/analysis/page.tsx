import { notFound } from "next/navigation";
import { StudyProcessButton } from "~/components/study-process-button";
import { getOwnedStudyProfile } from "~/server/repositories/studies";

export default async function Page({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  let data;
  try { data = await getOwnedStudyProfile(studyId); } catch { notFound(); }
  const { study, profile, sections, analysisVersion } = data;
  return <section className="mt-7 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
    <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Analysis</p><h2 className="mt-2 text-2xl font-bold">AI-generated Study Profile</h2><p className="mt-2 text-sm text-muted-foreground">Review this analysis before relying on it. Do not upload confidential, sensitive, or unpublished research documents. Use this build only with non-confidential/demo study files. Gemini Free Tier content may be used by Google to improve its products.</p></div>
    {study.status === "uploaded" && <div className="space-y-3"><p>Analysis has not started.</p><StudyProcessButton studyId={study.id} /></div>}
    {study.status === "processing" && <div className="space-y-3"><p role="status">Analysis is in progress. Refresh this page in a few minutes.</p>{Date.now() - study.updatedAt.getTime() > 30 * 60_000 && <><p>The earlier attempt may have stopped. You can restart it safely.</p><StudyProcessButton studyId={study.id} retry /></>}</div>}
    {study.status === "failed" && <div className="space-y-3"><p role="alert" className="text-destructive">{study.processingError ?? "Analysis failed. You can retry."}</p><StudyProcessButton studyId={study.id} retry /></div>}
    {study.status === "ready" && profile && <div className="space-y-5 text-sm leading-7">
      <p className="text-muted-foreground">Analysis version {analysisVersion}</p>
      <Field label="Title" value={profile.title} /><Field label="Summary" value={profile.summary} /><Field label="Research problem" value={profile.researchProblem} />
      <List label="Objectives" values={profile.objectives} /><List label="Keywords" values={profile.keywords} /><Field label="Methodology" value={profile.methodology} /><List label="Variables or concepts" values={profile.variablesOrConcepts} />
      <Field label="Population or sample" value={profile.populationOrSample} /><List label="Major findings" values={profile.majorFindings} /><Field label="Conclusion" value={profile.conclusion} /><List label="Suggested literature queries" values={profile.suggestedQueries} />
      {profile.importantPageRanges?.length ? <div><h3 className="font-semibold">PDF page references</h3><ul className="list-inside list-disc">{profile.importantPageRanges.map((r, i) => <li key={i}>{r.label}: pages {r.startPage}–{r.endPage}</li>)}</ul></div> : null}
      {sections.length ? <div><h3 className="font-semibold">Document sections</h3><ol className="list-inside list-decimal">{sections.map((s) => <li key={s.id}>{s.label}{s.startPage ? `, pages ${s.startPage}–${s.endPage}` : ""}<p className="ml-5 whitespace-pre-wrap text-muted-foreground">{s.normalizedTextReference}</p></li>)}</ol></div> : null}
    </div>}
  </section>;
}

function Field({ label, value }: { label: string; value?: string | null }) { return value ? <div><h3 className="font-semibold">{label}</h3><p className="whitespace-pre-wrap">{value}</p></div> : null; }
function List({ label, values }: { label: string; values?: string[] }) { return values?.length ? <div><h3 className="font-semibold">{label}</h3><ul className="list-inside list-disc">{values.map((value, i) => <li key={i}>{value}</li>)}</ul></div> : null; }
