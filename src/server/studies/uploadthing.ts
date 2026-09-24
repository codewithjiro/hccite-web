import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi, UploadThingError } from "uploadthing/server";
import { env, requireServerEnv } from "~/env";
import { createStudyForClerkUser } from "~/server/repositories/studies";
import { STUDY_DOCX_MIME, validateStudyFile } from "./file-validation";
import { deleteStorageObject } from "./storage-deletion";
import { isUploadInitiationAuthenticated } from "~/lib/auth-routes";

const f = createUploadthing();
const maxBytes = Math.floor(env.MAX_STUDY_FILE_MB * 1024 * 1024);
const maxSize = `${env.MAX_STUDY_FILE_MB}MB` as `${number}MB`;

function titleFromFileName(name: string) {
  return (name.replace(/\.[^.]+$/, "").trim() || "Untitled study").slice(0, 500);
}

export function getUploadThingApi() {
  return new UTApi({ token: requireServerEnv("UPLOADTHING_TOKEN"), logLevel: "Error" });
}

export async function deleteStoredStudyFile(storageKey: string) {
  await deleteStorageObject(storageKey, (key) => getUploadThingApi().deleteFiles(key));
}

export const uploadRouter = {
  // UploadThing's public type union lists common size literals; its route protocol accepts this
  // configured MB value. Runtime validation below remains authoritative for the exact env limit.
  studyDocument: f({ blob: { maxFileSize: maxSize as unknown as "64MB", maxFileCount: 1 } })
    .middleware(async ({ files }) => {
      const { userId } = await auth();
      if (!isUploadInitiationAuthenticated(userId)) throw new UploadThingError("Sign in before uploading a study.");
      const file = files[0];
      if (!file || files.length !== 1 || file.size > maxBytes) throw new UploadThingError(`Upload one PDF or DOCX no larger than ${env.MAX_STUDY_FILE_MB} MB.`);
      const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
      const mime = file.type.toLowerCase();
      if (ext !== "pdf" && ext !== "docx") throw new UploadThingError("Only PDF and DOCX study files are supported.");
      if (mime && mime !== (ext === "pdf" ? "application/pdf" : STUDY_DOCX_MIME)) throw new UploadThingError(`The ${ext.toUpperCase()} file MIME type is not valid.`);
      return { clerkUserId: userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const api = getUploadThingApi();
      let persisted = false;
      try {
        const response = await fetch(file.ufsUrl);
        if (!response.ok) throw new Error("The uploaded file could not be inspected.");
        const bytes = new Uint8Array(await response.arrayBuffer());
        const validation = validateStudyFile({ name: file.name, mimeType: file.type, bytes, maxBytes });
        if (!validation.ok) throw new UploadThingError(validation.error);
        const study = await createStudyForClerkUser(metadata.clerkUserId, {
          title: titleFromFileName(file.name), originalFileName: file.name, fileType: validation.fileType,
          fileUrl: file.ufsUrl, fileStorageKey: file.key,
        });
        persisted = true;
        return { studyId: study.id };
      } catch (error) {
        if (persisted) throw error;
        try {
          const cleanup = await api.deleteFiles(file.key);
          if (!cleanup.success) throw new Error("UploadThing did not confirm validation cleanup.");
        } catch {
          throw new UploadThingError("Study validation or persistence failed and cleanup could not be confirmed. Please contact support before retrying.");
        }
        if (error instanceof UploadThingError) throw error;
        throw new UploadThingError("Study validation or persistence failed. The uploaded object was removed.");
      }
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
