import assert from "node:assert/strict";
import test from "node:test";
import { apiAuthDecision, isPrivatePath, isUploadInitiationAuthenticated, isUploadThingCallbackPath } from "../src/lib/auth-routes.ts";
import { isRecordOwner } from "../src/lib/ownership.ts";

test("private route matching includes nested study and API paths", () => {
  for (const path of [
    "/dashboard",
    "/research-articles",
    "/doi-lookup",
    "/books",
    "/ai-analyzer",
    "/studies",
    "/studies/abc/analysis",
    "/studies/abc/literature",
    "/studies/abc/rrl",
    "/collections",
    "/profile",
    "/profile/security",
    "/api",
    "/api/private-action",
  ]) assert.equal(isPrivatePath(path), true, path);
});

test("landing, auth, assets, and lookalike path segments stay public", () => {
  for (const path of [
    "/",
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-up",
    "/sign-up/verify-email-address",
    "/assets",
    "/assets/hero.png",
    "/assets/app_logo.jpg",
    "/studies-guide",
  ]) {
    assert.equal(isPrivatePath(path), false, path);
  }
});

test("unauthenticated private API requests are denied while UploadThing callback bypasses the generic API gate", () => {
  assert.equal(apiAuthDecision("/api/private-action", null), "deny");
  assert.equal(apiAuthDecision("/api/private-action", "user-1"), "allow");
  assert.equal(apiAuthDecision("/api/uploadthing", null), "bypass");
  assert.equal(isUploadThingCallbackPath("/api/uploadthing"), true);
  assert.equal(isUploadThingCallbackPath("/api/uploadthing/unexpected"), false);
  // The exception is exact: arbitrary UploadThing subpaths remain private APIs.
  assert.equal(apiAuthDecision("/api/uploadthing/unexpected", null), "deny");
});

test("UploadThing file-route initiation still requires an authenticated Clerk user", () => {
  assert.equal(isUploadInitiationAuthenticated(null), false);
  assert.equal(isUploadInitiationAuthenticated(undefined), false);
  assert.equal(isUploadInitiationAuthenticated("user-1"), true);
});

test("ownership requires a real row and exact owner ID", () => {
  assert.equal(isRecordOwner({ userId: "owner-A" }, "owner-A"), true);
  assert.equal(isRecordOwner({ userId: "owner-A" }, "owner-B"), false);
  assert.equal(isRecordOwner({ userId: "owner-A" }, ""), false);
  assert.equal(isRecordOwner(null, "owner-A"), false);
});
