import { z } from "zod";

const short = z.string().trim().min(1).max(1000);
const list = (max: number) => z.array(short).max(max);
export const studyProfileSchema = z.object({
  title: z.string().trim().min(1).max(500).nullable(),
  summary: z.string().trim().min(1).max(100000),
  researchProblem: z.string().trim().min(1).max(50000).nullable(),
  objectives: list(30), keywords: list(40),
  methodology: z.string().trim().min(1).max(50000).nullable(),
  variablesOrConcepts: list(40),
  populationOrSample: z.string().trim().min(1).max(50000).nullable().optional(),
  majorFindings: list(30).optional(),
  conclusion: z.string().trim().min(1).max(50000).nullable().optional(),
  suggestedQueries: list(20),
  importantPageRanges: z.array(z.object({
    label: z.string().trim().min(1).max(160),
    startPage: z.number().int().positive(), endPage: z.number().int().positive(),
  }).strict().refine((range) => range.endPage >= range.startPage)).max(30).optional(),
}).strict();
export type StudyProfile = z.infer<typeof studyProfileSchema>;

// A small JSON Schema supported by Gemini's structured response format. Zod remains authoritative.
const str = { type: "string" };
const nullable = { type: ["string", "null"] };
const strings = { type: "array", items: str };
export const geminiProfileJsonSchema = {
  type: "object",
  properties: {
    title: nullable, summary: str, researchProblem: nullable, objectives: strings,
    keywords: strings, methodology: nullable, variablesOrConcepts: strings,
    populationOrSample: nullable, majorFindings: strings, conclusion: nullable,
    suggestedQueries: strings,
    importantPageRanges: { type: "array", items: { type: "object", properties: {
      label: str, startPage: { type: "integer" }, endPage: { type: "integer" },
    }, required: ["label", "startPage", "endPage"] } },
  },
  required: ["title", "summary", "researchProblem", "objectives", "keywords", "methodology", "variablesOrConcepts", "suggestedQueries"],
};

export function parseStudyProfile(output: string, fileType: "pdf" | "docx") {
  const profile = studyProfileSchema.parse(JSON.parse(output) as unknown);
  if (fileType === "docx" && profile.importantPageRanges?.length) throw new Error("DOCX page ranges are not verifiable.");
  return profile;
}
