"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteStudyAction } from "~/app/(workspace)/studies/actions";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

export function StudyDeleteButton({ studyId }: { studyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove() {
    if (!window.confirm("Delete this Study and its associated HCCite records? The stored UploadThing file will also be deleted. This cannot be undone.")) return;
    startTransition(async () => {
      try {
        const result = await deleteStudyAction(studyId);
        if (!result.ok) { toast.error("Failed to delete study. Please try again."); return; }
        toast.success("Study deleted successfully.");
      } catch { toast.error("Failed to delete study. Please try again."); return; }
      router.push("/studies"); router.refresh();
    });
  }
  return <div><Button type="button" variant="destructive" onClick={remove} disabled={pending}><Trash2 aria-hidden="true" />{pending ? "Deleting…" : "Delete study"}</Button></div>;
}
