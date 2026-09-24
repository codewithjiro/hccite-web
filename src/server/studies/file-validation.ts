import "server-only";

export const STUDY_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

export type StudyFileType = "pdf" | "docx";
export type StudyFileValidationInput = { name: string; mimeType?: string | null; bytes: Uint8Array; maxBytes: number };
export type StudyFileValidationResult = { ok: true; fileType: StudyFileType } | { ok: false; error: string };

function extension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

function hasPdfHeader(bytes: Uint8Array) {
  return bytes.length >= 5 && new TextDecoder("ascii").decode(bytes.slice(0, 5)) === "%PDF-";
}

/** Reads ZIP central-directory names only; it never extracts entries or expands compressed data. */
function hasDocxPackage(bytes: Uint8Array) {
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  const start = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= start; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (entries === 0 || entries > 10_000 || directoryOffset >= bytes.length) return false;
  const names = new Set<string>();
  let cursor = directoryOffset;
  const decoder = new TextDecoder("utf-8", { fatal: false });
  for (let i = 0; i < entries; i++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) return false;
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length || nameLength > 1_024) return false;
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (name.includes("\\") || name.startsWith("/") || name.split("/").includes("..")) return false;
    names.add(name);
    cursor = end;
  }
  return names.has("[Content_Types].xml") && names.has("_rels/.rels") && names.has("word/document.xml");
}

export function validateStudyFile({ name, mimeType, bytes, maxBytes }: StudyFileValidationInput): StudyFileValidationResult {
  if (!name.trim() || bytes.length === 0) return { ok: false, error: "The uploaded file is empty or malformed." };
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || bytes.length > maxBytes) return { ok: false, error: "The file exceeds the configured maximum study file size." };
  const ext = extension(name);
  const mime = mimeType?.trim().toLowerCase() ?? "";
  if (ext === "pdf") {
    if (mime && mime !== PDF_MIME) return { ok: false, error: "PDF files must use the application/pdf MIME type." };
    return hasPdfHeader(bytes) ? { ok: true, fileType: "pdf" } : { ok: false, error: "The PDF file signature is invalid." };
  }
  if (ext === "docx") {
    if (mime && mime !== STUDY_DOCX_MIME) return { ok: false, error: "DOCX files must use the Office Open XML MIME type." };
    return hasDocxPackage(bytes) ? { ok: true, fileType: "docx" } : { ok: false, error: "The DOCX package structure is invalid." };
  }
  return { ok: false, error: "Only PDF and DOCX study files are supported." };
}
