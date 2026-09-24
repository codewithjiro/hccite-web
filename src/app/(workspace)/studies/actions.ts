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
  if (!id.success) return { status: "failed" as const, error: "The study identifier is invalid." };
  try { return await processOwnedStudy(id.data); }
  catch { return { status: "failed" as const, error: "Study processing could not start." }; }
}
