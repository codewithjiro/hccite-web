import assert from "node:assert/strict";
import test from "node:test";
import { deleteStorageObject } from "../src/server/studies/storage-deletion.ts";
import { StudyDeletionPartialFailure, studyDeletionFailureResult } from "../src/server/studies/deletion-result.ts";

test("accepts an UploadThing-confirmed already-absent single object", async () => {
  const calls = [];
  await deleteStorageObject("demo-file-key", async (key) => {
    calls.push(key);
    return { success: true, deletedCount: 0 };
  });
  assert.deepEqual(calls, ["demo-file-key"]);
});

test("does not convert unrelated or unconfirmed storage failures into success", async () => {
  await assert.rejects(deleteStorageObject("demo-file-key", async () => ({ success: false, deletedCount: 0 })));
  await assert.rejects(deleteStorageObject("demo-file-key", async () => ({ success: true, deletedCount: 2 })));
  await assert.rejects(deleteStorageObject("demo-file-key", async () => { throw new Error("provider unavailable"); }), /provider unavailable/);
});

test("reports post-storage database failure as an explicit retryable partial failure", () => {
  const result = studyDeletionFailureResult(new StudyDeletionPartialFailure());
  assert.equal(result.ok, false);
  assert.equal(result.partialFailure, true);
  assert.match(result.error, /deleted from storage.*cleanup failed.*safe retry/i);
});
