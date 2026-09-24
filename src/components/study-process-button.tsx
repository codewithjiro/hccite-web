"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { processStudyAction } from "~/app/(workspace)/studies/actions";
import { Button } from "~/components/ui/button";

export function StudyProcessButton({ studyId, retry = false }: { studyId: string; retry?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return <div className="space-y-2"><Button disabled={pending} onClick={() => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await processStudyAction(studyId);
        if (result.status === "failed") setError(result.error ?? "Analysis failed. Please retry later.");
        router.refresh();
      } catch { setError("The request ended unexpectedly. Refresh to check the Study status."); router.refresh(); }
    });
  }}>{pending ? "Analyzing…" : retry ? "Retry analysis" : "Analyze study"}</Button>
    {pending && <p role="status" className="text-sm text-muted-foreground">Processing can take a few minutes. Keep this page open.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
