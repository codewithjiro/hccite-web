"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteStudyAction } from "~/app/(workspace)/studies/actions";
import { Button } from "~/components/ui/button";

export function StudyDeleteButton({ studyId }: { studyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function remove() {
    if (!window.confirm("Delete this Study and its associated HCCite records? The stored UploadThing file will also be deleted. This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStudyAction(studyId);
      if (!result.ok) { setError(result.error); return; }
      router.push("/studies"); router.refresh();
    });
  }
  return <div className="space-y-2"><Button type="button" variant="destructive" onClick={remove} disabled={pending}><Trash2 aria-hidden="true" />{pending ? "Deleting…" : "Delete study"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
