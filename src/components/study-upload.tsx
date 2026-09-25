"use client";

import { UploadDropzone } from "~/lib/uploadthing";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function StudyUpload({ maxFileMb }: { maxFileMb: number }) {
  const router = useRouter();
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
          const rejected = files.find((file) => !/\.(pdf|docx)$/i.test(file.name) || file.size > maxBytes);
          if (rejected) { toast.error(`Choose one PDF or DOCX no larger than ${maxFileMb} MB.`); return []; }
          return files.slice(0, 1);
        }}
        onClientUploadComplete={() => { toast.success("Study uploaded successfully."); router.refresh(); }}
        onUploadError={() => { toast.error("Failed to upload study. Please try again."); }}
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
  </section>;
}
