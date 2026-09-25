"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { processStudyAction } from "~/app/(workspace)/studies/actions";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

export function StudyProcessButton({ studyId, retry = false }: { studyId: string; retry?: boolean }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, startTransition] = useTransition();
  const [inlineError, setInlineError] = useState("");

  function runAnalysis() {
    if (inFlight.current) return;
    inFlight.current = true;
    setInlineError("");
    startTransition(async () => {
      try {
        const result = await processStudyAction(studyId);
        if (result.status === "failed") {
          const message = result.error ?? "Analysis failed. Please retry later.";
          if (!result.persisted) setInlineError(message);
          toast.error(message);
        } else if (result.status === "ready") {
          if (result.alreadyComplete) toast.info("This study analysis is already complete.");
          else toast.success("Study analysis completed successfully.");
        } else if (result.status === "processing") {
          toast.info("Study analysis is already in progress.");
        } else {
          toast.info("Study analysis is queued. Refresh the page to check its status.");
        }
        router.refresh();
      } catch {
        const message = "Analysis could not be completed. Refresh the page and retry.";
        setInlineError(message);
        toast.error(message);
        router.refresh();
      } finally {
        inFlight.current = false;
      }
    });
  }

  return <div className="space-y-2">
    <Button disabled={pending} onClick={runAnalysis}>
      {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      {pending ? "Analyzing…" : retry ? "Retry analysis" : "Analyze study"}
    </Button>
    {pending && <p role="status" className="text-sm text-muted-foreground">Processing can take a few minutes. Keep this page open.</p>}
    {inlineError && <p role="alert" className="max-w-xl break-words text-sm text-destructive">{inlineError}</p>}
  </div>;
}
