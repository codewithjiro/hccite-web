export class StudyDeletionPartialFailure extends Error {
  constructor(options?: ErrorOptions) {
    super("The study file was deleted from storage, but database cleanup failed.", options);
    this.name = "StudyDeletionPartialFailure";
  }
}

export function studyDeletionFailureResult(error: unknown) {
  if (error instanceof Error && /NEXT_NOT_FOUND/.test(error.message)) return { ok: false as const, error: "Study not found." };
  if (error instanceof StudyDeletionPartialFailure) {
    return { ok: false as const, partialFailure: true as const, error: "The file was deleted from storage, but Study cleanup failed. The remaining metadata is available for a safe retry." };
  }
  return { ok: false as const, error: "The study could not be deleted. Its record was kept so you can safely retry." };
}
