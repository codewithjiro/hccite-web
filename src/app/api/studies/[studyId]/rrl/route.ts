import { NextResponse } from "next/server";
import { z } from "zod";
import { bibliographyForSnapshot, generateOwnedRrl, getRrlWorkspace } from "~/server/rrl/service";
import { getRrlDraft, listRrlDraftsForStudy, updateRrlDraft } from "~/server/repositories/rrl";
import { safeRrlGeminiError } from "~/server/rrl/gemini";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), citationStyle: z.enum(["apa", "mla", "chicago"]), generationRequestId: z.string().uuid(), confirmRetractedSourceIds: z.array(z.string().uuid()).max(1000).default([]) }).strict(),
  z.object({ action: z.literal("saveEdit"), draftId: z.string().uuid(), content: z.string().trim().min(1).max(500000), citationStyle: z.enum(["apa", "mla", "chicago"]).optional() }).strict(),
  z.object({ action: z.literal("getDraft"), draftId: z.string().uuid() }).strict(),
]);

function safeError(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError) return "Invalid RRL request.";
  if (error instanceof Error && /Gemini|RRL generation|unmapped|citation list|ready saved|Select at least|no longer selected/.test(error.message)) return error.message;
  return "Study or RRL draft not found.";
}

function serializeDraft(data: Awaited<ReturnType<typeof getRrlDraft>>) {
  return { ...data, bibliography: bibliographyForSnapshot(data.sources.map((source) => ({ resource: source.resource, citationKey: source.membership.citationKey })), data.draft.citationStyle) };
}

export async function GET(_: Request, context: { params: Promise<{ studyId: string }> }) {
  try {
    const { studyId } = await context.params;
    const workspace = await getRrlWorkspace(studyId);
    const drafts = await listRrlDraftsForStudy(studyId);
    const latest = drafts[0] ? await getRrlDraft(drafts[0].id) : null;
    return NextResponse.json({ workspace, drafts, latest: latest ? serializeDraft(latest) : null });
  } catch { return NextResponse.json({ error: "Study not found." }, { status: 404 }); }
}

export async function POST(request: Request, context: { params: Promise<{ studyId: string }> }) {
  try {
    const { studyId } = await context.params, body = bodySchema.parse(await request.json());
    if (body.action === "generate") {
      const result = await generateOwnedRrl(studyId, body);
      if (result.requiresRetractedConfirmation) return NextResponse.json(result, { status: 409 });
      return NextResponse.json({ ...result, draft: serializeDraft(await getRrlDraft(result.draft.id)) });
    }
    if (body.action === "saveEdit") {
      const draft = await updateRrlDraft(body.draftId, { content: body.content, citationStyle: body.citationStyle });
      if (!draft || draft.studyId !== studyId) return NextResponse.json({ error: "RRL draft not found." }, { status: 404 });
      return NextResponse.json({ draft: serializeDraft(await getRrlDraft(draft.id)) });
    }
    const draft = await getRrlDraft(body.draftId);
    if (draft.draft.studyId !== studyId) return NextResponse.json({ error: "RRL draft not found." }, { status: 404 });
    return NextResponse.json({ draft: serializeDraft(draft) });
  } catch (error) {
    const message = safeRrlGeminiError(error);
    const safe = message === "RRL generation failed. Please retry." ? safeError(error) : message;
    return NextResponse.json({ error: safe }, { status: safe === "Study or RRL draft not found." ? 404 : 400 });
  }
}
