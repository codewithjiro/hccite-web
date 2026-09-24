"use server";

import { z } from "zod";
import { deleteStudy } from "~/server/repositories/studies";
import { studyDeletionFailureResult } from "~/server/studies/deletion-result";
import { deleteStoredStudyFile } from "~/server/studies/uploadthing";

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
