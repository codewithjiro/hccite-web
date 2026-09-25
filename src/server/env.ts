import "server-only";

import { env } from "~/env";

export class ServerConfigurationError extends Error {
  readonly key: string;
  readonly code = "missing_configuration";

  constructor(key: string) {
    super(`${key} is required for this feature but is not configured.`);
    this.name = "ServerConfigurationError";
    this.key = key;
  }
}

/** Read request-time server configuration so dev .env.local and Vercel runtime values work. */
export function getServerEnv<K extends keyof typeof env>(key: K): (typeof env)[K] {
  const hasRuntimeValue = Object.prototype.hasOwnProperty.call(process.env, key);
  const value = hasRuntimeValue ? process.env[key as string] : env[key];
  return value as (typeof env)[K];
}

export function requireServerEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = getServerEnv(key);
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
    throw new ServerConfigurationError(String(key));
  }
  return (typeof value === "string" ? value.trim() : value) as NonNullable<(typeof env)[K]>;
}
