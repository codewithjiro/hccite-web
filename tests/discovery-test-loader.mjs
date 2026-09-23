import { existsSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export%20{}", shortCircuit: true };
    let target = specifier.startsWith("~/") ? resolve(root, "src", specifier.slice(2)) : null;
    if (target) {
      if (!extname(target) && existsSync(`${target}.ts`)) target += ".ts";
      else if (!extname(target) && existsSync(resolve(target, "index.ts"))) target = resolve(target, "index.ts");
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      target = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      if (!extname(target) && existsSync(`${target}.ts`)) target += ".ts";
      if (!extname(target) && existsSync(`${target}.mjs`)) target += ".mjs";
      if (target !== resolve(dirname(fileURLToPath(context.parentURL)), specifier)) return { url: pathToFileURL(target).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
