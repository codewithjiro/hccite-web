import "server-only";

import { env } from "~/env";
import { claimStudyProcessing, completeStudyProcessing, failStudyProcessing } from "~/server/repositories/studies";
import { extractDocx } from "./docx";
import { validateStudyFile, STUDY_DOCX_MIME } from "./file-validation";
import { analyzeWithGemini, GeminiFailure, safeGeminiError, TARGET_STUDY_SECTIONS } from "./gemini";

export type StudyProcessingFailureKind = "missing_file" | "invalid_source" | "file_unavailable" | "file_timeout" | "file_network" | "validation" | "extraction";

export class StudyProcessingFailure extends Error {
  readonly kind: StudyProcessingFailureKind;
  constructor(kind: StudyProcessingFailureKind) {
    super(kind);
    this.kind = kind;
    this.name = "StudyProcessingFailure";
  }
}

function safeProcessingError(error: unknown) {
  if (error instanceof GeminiFailure) return safeGeminiError(error);
  if (!(error instanceof StudyProcessingFailure)) return safeGeminiError(error);
  return ({
    missing_file: "The uploaded study file is unavailable. Re-upload it before retrying analysis.",
    invalid_source: "This study file reference is invalid. Re-upload the study and retry.",
    file_unavailable: "The uploaded study file could not be retrieved. Try again, or re-upload the file.",
    file_timeout: "Retrieving the uploaded study file took too long. Please retry.",
    file_network: "Could not retrieve the uploaded study file. Check the connection and retry.",
    validation: "The uploaded file did not pass validation. Use a readable PDF or DOCX within the configured size limit.",
    extraction: "Text could not be extracted from this DOCX. Re-save the document as DOCX and retry.",
  })[error.kind];
}

function diagnosticCode(error: unknown) {
  if (error instanceof GeminiFailure) return `gemini_${error.kind}`;
  if (error instanceof StudyProcessingFailure) return `study_${error.kind}`;
  return "unexpected_server_error";
}

function logFailure(studyId: string, stage: string, error: unknown) {
  console.error("[study-processing] failed", { studyId, stage, code: diagnosticCode(error) });
}

function fileRequestFailure(error: unknown): StudyProcessingFailure {
  return new StudyProcessingFailure(error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "file_timeout" : "file_network");
}

export async function processOwnedStudy(studyId: string, dependencies: { fetcher?: typeof fetch; analyze?: typeof analyzeWithGemini } = {}) {
  const result = await claimStudyProcessing(studyId);
  if (result.kind !== "claimed") return { status: result.kind, alreadyComplete: result.kind === "ready" };
  let stage = "validate_source";
  try {
    const study = result.study;
    if (!study.fileStorageKey || !["pdf", "docx"].includes(study.fileType)) throw new StudyProcessingFailure("missing_file");
    let url: URL;
    try { url = new URL(study.fileUrl); }
    catch { throw new StudyProcessingFailure("invalid_source"); }
    if (url.protocol !== "https:" || !["ufs.sh", "utfs.io", "uploadthing.com"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new StudyProcessingFailure("invalid_source");

    stage = "download_file";
    let response: Response;
    try { response = await (dependencies.fetcher ?? fetch)(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" }); }
    catch (error) { throw fileRequestFailure(error); }
    if (!response.ok) throw new StudyProcessingFailure("file_unavailable");
    const length = Number(response.headers.get("content-length") ?? 0);
    const maxBytes = Math.floor(env.MAX_STUDY_FILE_MB * 1024 * 1024);
    if (Number.isFinite(length) && length > maxBytes) throw new StudyProcessingFailure("validation");
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await response.arrayBuffer()); }
    catch (error) { throw fileRequestFailure(error); }

    stage = "validate_file";
    const validated = validateStudyFile({ name: study.originalFileName, mimeType: study.fileType === "pdf" ? "application/pdf" : STUDY_DOCX_MIME, bytes, maxBytes });
    if (!validated.ok || validated.fileType !== study.fileType) throw new StudyProcessingFailure("validation");

    stage = "extract_docx";
    let docx: Awaited<ReturnType<typeof extractDocx>> | null = null;
    if (study.fileType === "docx") {
      try { docx = await extractDocx(bytes); }
      catch { throw new StudyProcessingFailure("extraction"); }
    }

    stage = "gemini_analysis";
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
      .map((range) => ({ label: range.label, startPage: range.startPage, endPage: range.endPage, normalizedTextReference: null })) : [];
    stage = "save_analysis";
    await completeStudyProcessing(study.id, profile, env.GEMINI_MODEL, docx?.sections ?? pdfSections);
    return { status: "ready" as const, alreadyComplete: false };
  } catch (error) {
    const safeError = safeProcessingError(error);
    logFailure(result.study.id, stage, error);
    let persisted = false;
    try { await failStudyProcessing(result.study.id, safeError); persisted = true; }
    catch (persistError) { logFailure(result.study.id, "save_failure_state", persistError); }
    return { status: "failed" as const, error: safeError, persisted };
  }
}
