import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const app = await buildServer();
  const host = process.env["MODELHARBOR_HOST"] ?? "0.0.0.0";
  const port = Number(process.env["MODELHARBOR_PORT"] ?? 3000);
  try {
    await app.listen({ host, port });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();