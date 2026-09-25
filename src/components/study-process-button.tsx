"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { processStudyAction } from "~/app/(workspace)/studies/actions";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

export function StudyProcessButton({ studyId, retry = false }: { studyId: string; retry?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="space-y-2"><Button disabled={pending} onClick={() => {
    startTransition(async () => {
      try {
        const result = await processStudyAction(studyId);
        if (result.status === "failed") toast.error(result.error ?? "Analysis failed. Please retry later.");
        else toast.success("Study analysis started.");
        router.refresh();
      } catch { toast.error("The request ended unexpectedly. Refresh to check the Study status."); router.refresh(); }
    });
  }}>{pending ? "Analyzing…" : retry ? "Retry analysis" : "Analyze study"}</Button>
    {pending && <p role="status" className="text-sm text-muted-foreground">Processing can take a few minutes. Keep this page open.</p>}
  </div>;
}
