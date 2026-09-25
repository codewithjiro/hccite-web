"use server";

import { z } from "zod";
import { deleteStudy } from "~/server/repositories/studies";
import { studyDeletionFailureResult } from "~/server/studies/deletion-result";
import { deleteStoredStudyFile } from "~/server/studies/uploadthing";
import { processOwnedStudy } from "~/server/studies/process";

export async function deleteStudyAction(studyId: string) {
  const id = z.string().uuid().safeParse(studyId);
  if (!id.success) return { ok: false, error: "The study identifier is invalid." };
  try {
    await deleteStudy(id.data, deleteStoredStudyFile);
    return { ok: true as const };
  } catch (error) {
    // Ownership failures stay non-specific and provider/database details stay server-side.
    return studyDeletionFailureResult(error);
  }
}

export async function processStudyAction(studyId: string) {
  const id = z.string().uuid().safeParse(studyId);
  if (!id.success) return { status: "failed" as const, error: "The study identifier is invalid.", persisted: false };
  try { return await processOwnedStudy(id.data); }
  catch (error) {
    console.error("[study-processing] could not start", {
      studyId: id.data,
      stage: "claim",
      code: error instanceof Error ? error.name : "unexpected_server_error",
    });
    return { status: "failed" as const, error: "Analysis could not start. Refresh the page and retry.", persisted: false };
  }
}
