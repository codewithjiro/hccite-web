"use client";

import { useState } from "react";
import { UploadDropzone } from "~/lib/uploadthing";

export function StudyUpload({ maxFileMb }: { maxFileMb: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const maxBytes = Math.floor(maxFileMb * 1024 * 1024);
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Upload a study</p>
    <h2 className="mt-2 text-xl font-semibold">PDF or DOCX, up to {maxFileMb} MB</h2>
    <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6 text-foreground">
      <p className="font-semibold">Do not upload confidential, sensitive, or unpublished research documents. Use this build only with non-confidential/demo study files.</p>
      <p className="mt-2 text-muted-foreground">Clerk protects your HCCite study metadata and routes. UploadThing free-tier file URLs may be publicly accessible by URL; Clerk does not make the underlying UploadThing URL private.</p>
    </div>
    <p className="mt-4 text-sm text-muted-foreground">The server checks extension, MIME type, size, and actual PDF/DOCX structure before creating a Study record.</p>
    <div className="mx-auto mt-5 w-full max-w-2xl">
      <UploadDropzone
        endpoint="studyDocument"
        config={{ mode: "auto" }}
        onBeforeUploadBegin={(files) => {
          setMessage(null);
          const rejected = files.find((file) => !/\.(pdf|docx)$/i.test(file.name) || file.size > maxBytes);
          if (rejected) { setMessage(`Choose one PDF or DOCX no larger than ${maxFileMb} MB.`); return []; }
          return files.slice(0, 1);
        }}
        onClientUploadComplete={() => { setMessage("Study uploaded and validated. It now appears in My Studies."); window.location.reload(); }}
        onUploadError={(error) => setMessage(error.message || "Upload failed. Please correct the file and retry.")}
        appearance={{
          container: "min-h-[210px] border-border bg-background px-5 py-6 sm:min-h-[230px] sm:px-7 sm:py-8 ut-readying:bg-muted",
          uploadIcon: "h-14 w-14 sm:h-16 sm:w-16",
          label: "text-sm font-semibold sm:text-base",
          allowedContent: "text-xs sm:text-sm",
          button: "bg-primary text-primary-foreground hover:bg-primary/80",
        }}
        content={{ label: "Drop one PDF or DOCX here", allowedContent: `Maximum ${maxFileMb} MB` }}
      />
    </div>
    {message && <p role="status" className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{message}</p>}
  </section>;
}
