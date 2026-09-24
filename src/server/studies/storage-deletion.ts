export type StorageDeleteResult = { success: boolean; deletedCount: number };

/** A successful single-key deletion with zero deletions means the object was already absent. */
export async function deleteStorageObject(
  storageKey: string,
  deleteFiles: (key: string) => Promise<StorageDeleteResult>,
) {
  const result = await deleteFiles(storageKey);
  if (result.success && (result.deletedCount === 0 || result.deletedCount === 1)) return;
  throw new Error("UploadThing did not confirm deletion of the study file.");
}
