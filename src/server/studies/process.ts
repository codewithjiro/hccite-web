import "server-only";
import { env } from "~/env";
import { claimStudyProcessing, completeStudyProcessing, failStudyProcessing } from "~/server/repositories/studies";
import { extractDocx } from "./docx";
import { validateStudyFile, STUDY_DOCX_MIME } from "./file-validation";
import { analyzeWithGemini, GeminiFailure, safeGeminiError, TARGET_STUDY_SECTIONS } from "./gemini";

export async function processOwnedStudy(studyId: string, dependencies: { fetcher?: typeof fetch; analyze?: typeof analyzeWithGemini } = {}) {
  const result = await claimStudyProcessing(studyId);
  if (result.kind !== "claimed") return { status: result.kind };
  try {
    const study = result.study;
    if (!study.fileStorageKey || !["pdf", "docx"].includes(study.fileType)) throw new Error("Unsupported study source.");
    const url = new URL(study.fileUrl);
    if (url.protocol !== "https:" || !["ufs.sh", "utfs.io", "uploadthing.com"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new Error("Invalid stored file source.");
    const response = await (dependencies.fetcher ?? fetch)(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
    if (!response.ok) throw new Error("Stored file could not be fetched.");
    const length = Number(response.headers.get("content-length") ?? 0);
    const maxBytes = Math.floor(env.MAX_STUDY_FILE_MB * 1024 * 1024);
    if (length > maxBytes) throw new Error("Stored file is too large.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const validated = validateStudyFile({ name: study.originalFileName, mimeType: study.fileType === "pdf" ? "application/pdf" : STUDY_DOCX_MIME, bytes, maxBytes });
    if (!validated.ok || validated.fileType !== study.fileType) throw new Error("Stored file is invalid.");
    const docx = study.fileType === "docx" ? await extractDocx(bytes) : null;
    const analyze = dependencies.analyze ?? analyzeWithGemini;
    let profile;
    try { profile = await analyze(docx ? { fileType: "docx", text: docx.text } : { fileType: "pdf", bytes }); }
    catch (error) {
      if (error instanceof GeminiFailure && !["invalid", "document"].includes(error.kind)) throw error;
      if (!docx) profile = await analyze({ fileType: "pdf", bytes, targetedSections: TARGET_STUDY_SECTIONS });
      else {
        if (!docx.sections.length) throw error;
        const preferred = docx.sections.filter((s) => /abstract|intro|problem|objectiv|method|result|discussion|conclusion/i.test(s.label));
        if (!preferred.length) throw error;
        const targeted = preferred.map((s) => `${s.label}\n${s.normalizedTextReference}`).join("\n\n").slice(0, 120_000);
        profile = await analyze({ fileType: "docx", text: targeted });
      }
    }
    const pdfSections = study.fileType === "pdf" ? (profile.importantPageRanges ?? [])
      .filter((range) => !study.pageCount || range.endPage <= study.pageCount)
      .map((range) => ({
      label: range.label, startPage: range.startPage, endPage: range.endPage, normalizedTextReference: null,
    })) : [];
    await completeStudyProcessing(study.id, profile, env.GEMINI_MODEL, docx?.sections ?? pdfSections);
    return { status: "ready" as const };
  } catch (error) {
    await failStudyProcessing(result.study.id, safeGeminiError(error));
    return { status: "failed" as const, error: safeGeminiError(error) };
  }
}
