export function isRecordOwner(record: { userId: string } | null | undefined, ownerId: string): boolean {
  return Boolean(record && ownerId && record.userId === ownerId);
}
