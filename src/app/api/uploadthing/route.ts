import { createRouteHandler } from "uploadthing/next";
import { requireServerEnv } from "~/server/env";
import { uploadRouter } from "~/server/studies/uploadthing";

export const runtime = "nodejs";
export const { GET, POST } = createRouteHandler({ router: uploadRouter, config: { token: requireServerEnv("UPLOADTHING_TOKEN") } });
