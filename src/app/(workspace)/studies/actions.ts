"use server";

import { z } from "zod";
import { deleteStudy } from "~/server/repositories/studies";
import { deleteStoredStudyFile } from "~/server/studies/uploadthing";

export async function deleteStudyAction(studyId: string) {
  const id = z.string().uuid().safeParse(studyId);
  if (!id.success) return { ok: false, error: "The study identifier is invalid." };
  try {
    await deleteStudy(id.data, deleteStoredStudyFile);
    return { ok: true as const };
  } catch (error) {
    // Ownership failures are deliberately non-specific; provider/database details stay server-side.
    if (error instanceof Error && /NEXT_NOT_FOUND/.test(error.message)) return { ok: false, error: "Study not found." };
    return { ok: false, error: "The study could not be deleted. Its record was kept so you can safely retry." };
  }
}
