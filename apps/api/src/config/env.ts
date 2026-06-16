export interface Env {
  NODE_ENV: "development" | "production" | "test";
  HOST: string;
  PORT: number;
  LOG_LEVEL: string;
  DATABASE_URL: string;
  SECRET_KEY: string;
}

const DEFAULTS: Env = {
  NODE_ENV: "development",
  HOST: "0.0.0.0",
  PORT: 3000,
  LOG_LEVEL: "info",
  DATABASE_URL: "file:./data/modelharbor.sqlite",
  SECRET_KEY: "dev-secret-change-me",
};

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number for env ${name}: ${raw}`);
  }
  return n;
}

export function createEnv(): Env {
  const nodeEnv = (process.env["NODE_ENV"] ?? DEFAULTS.NODE_ENV) as Env["NODE_ENV"];
  return {
    NODE_ENV: nodeEnv,
    HOST: process.env["MODELHARBOR_HOST"] ?? DEFAULTS.HOST,
    PORT: readNumber("MODELHARBOR_PORT", DEFAULTS.PORT),
    LOG_LEVEL: process.env["MODELHARBOR_LOG_LEVEL"] ?? DEFAULTS.LOG_LEVEL,
    DATABASE_URL: process.env["MODELHARBOR_DATABASE_URL"] ?? DEFAULTS.DATABASE_URL,
    SECRET_KEY: process.env["MODELHARBOR_SECRET_KEY"] ?? DEFAULTS.SECRET_KEY,
  };
}