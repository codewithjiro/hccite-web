let clerkUserId = "hccite-test-user-a";

export function setTestIdentity(value) {
  clerkUserId = value;
}

export async function fakeAuth() {
  return { userId: clerkUserId };
}

export async function fakeCurrentUser() {
  return { id: clerkUserId, firstName: "Synthetic", lastName: "User", username: null };
}
