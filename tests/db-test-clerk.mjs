import { fakeAuth, fakeCurrentUser } from "./db-test-auth.mjs";

export const auth = { protect: fakeAuth };
export const currentUser = fakeCurrentUser;
