import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnedStudyProfile } from "~/server/repositories/studies";
import { associateLiteratureSource, listStudyRelatedSources, refreshStudyRelatedSourceIntegrity, setLiteratureSelection } from "~/server/repositories/literature";
import { deriveLiteratureQueries, literatureQuerySchema } from "~/server/literature/core";
import { searchLiterature } from "~/server/literature/search";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("search"), query: literatureQuerySchema }).strict(),
  z.object({ action: z.literal("associate"), locator: z.unknown() }).strict(),
  z.object({ action: z.literal("select"), associationId: z.string().uuid(), selected: z.boolean() }).strict(),
  z.object({ action: z.literal("refreshIntegrity"), associationId: z.string().uuid() }).strict(),
]);
const safeError = (error: unknown) => error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid request." : error instanceof Error ? error.message : "Request failed.";

export async function GET(_: Request, context: { params: Promise<{ studyId: string }> }) {
  try {
    const { studyId } = await context.params, data = await getOwnedStudyProfile(studyId);
    if (data.study.status !== "ready" || !data.profile) return NextResponse.json({ error: "A ready saved Study Profile is required." }, { status: 409 });
    return NextResponse.json({ study: { id: data.study.id, title: data.study.title }, queries: deriveLiteratureQueries(data.profile), associated: await listStudyRelatedSources(studyId) });
  } catch { return NextResponse.json({ error: "Study not found." }, { status: 404 }); }
}

export async function POST(request: Request, context: { params: Promise<{ studyId: string }> }) {
  try {
    const { studyId } = await context.params, body = bodySchema.parse(await request.json());
    if (body.action === "search") {
      const data = await getOwnedStudyProfile(studyId);
      if (data.study.status !== "ready" || !data.profile) return NextResponse.json({ error: "A ready saved Study Profile is required." }, { status: 409 });
      return NextResponse.json(await searchLiterature(body.query));
    }
    if (body.action === "associate") return NextResponse.json(await associateLiteratureSource(studyId, body.locator));
    if (body.action === "refreshIntegrity") {
      const result = await refreshStudyRelatedSourceIntegrity(studyId, body.associationId);
      return result ? NextResponse.json(result) : NextResponse.json({ error: "Source association not found." }, { status: 404 });
    }
    const result = await setLiteratureSelection(studyId, body);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Source association not found." }, { status: 404 });
  } catch (error) {
    const status = error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 404;
    return NextResponse.json({ error: safeError(error) }, { status });
  }
}
