import assert from "node:assert/strict";
import test from "node:test";
import { isPrivatePath } from "../src/lib/auth-routes.ts";
import { isRecordOwner } from "../src/lib/ownership.ts";

test("private route matching includes nested study and API paths", () => {
  for (const path of [
    "/dashboard", "/studies/abc/analysis", "/studies/abc/literature",
    "/studies/abc/rrl", "/collections", "/profile/security", "/api/private-action",
  ]) assert.equal(isPrivatePath(path), true, path);
});

test("landing, auth, assets, and lookalike path segments stay public", () => {
  for (const path of ["/", "/sign-in", "/sign-in/factor-one", "/sign-up", "/assets/hero.png", "/studies-guide"]) {
    assert.equal(isPrivatePath(path), false, path);
  }
});

test("ownership requires a real row and exact owner ID", () => {
  assert.equal(isRecordOwner({ userId: "owner-A" }, "owner-A"), true);
  assert.equal(isRecordOwner({ userId: "owner-A" }, "owner-B"), false);
  assert.equal(isRecordOwner({ userId: "owner-A" }, ""), false);
  assert.equal(isRecordOwner(null, "owner-A"), false);
});
