import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  for (const file of [".env.local", ".env", ".env.vercel.local"]) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (match) {
        let value = match[1].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        if (value) { process.env.DATABASE_URL = value; return; }
      }
    }
  }
}

loadLocalEnv();
process.env.NODE_ENV = "test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export%20{}", shortCircuit: true };
    if (specifier === "@clerk/nextjs/server") return { url: pathToFileURL(resolve(root, "tests/db-test-clerk.mjs")).href, shortCircuit: true };
    if (specifier === "next/navigation") return { url: pathToFileURL(resolve(root, "tests/db-test-navigation.mjs")).href, shortCircuit: true };
    // Node's strip-types runner does not apply Next's extensionless subpath
    // resolution, while route-handler integration tests import this module.
    if (specifier === "next/server") return { url: pathToFileURL(resolve(root, "node_modules/next/server.js")).href, shortCircuit: true };
    let target = specifier.startsWith("~/") ? resolve(root, "src", specifier.slice(2)) : null;
    if (target) {
      if (!extname(target) && existsSync(`${target}.ts`)) target += ".ts";
      else if (!extname(target) && existsSync(resolve(target, "index.ts"))) target = resolve(target, "index.ts");
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const parent = dirname(fileURLToPath(context.parentURL));
      target = resolve(parent, specifier);
      if (!extname(target) && existsSync(`${target}.ts`)) target += ".ts";
      if (!extname(target) && existsSync(`${target}.mjs`)) target += ".mjs";
      if (!extname(target) && existsSync(resolve(target, "index.ts"))) target = resolve(target, "index.ts");
      if (target !== resolve(parent, specifier)) return { url: pathToFileURL(target).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
