import { notFound } from "next/navigation";
import { RrlWorkspace } from "~/components/rrl-workspace";
import { getOwnedStudyProfile } from "~/server/repositories/studies";

export default async function Page({ params }: { params: Promise<{ studyId: string }> }) {
  try {
    const { studyId } = await params;
    const { study } = await getOwnedStudyProfile(studyId);
    return <RrlWorkspace studyId={study.id} studyTitle={study.title} />;
  } catch { notFound(); }
}
