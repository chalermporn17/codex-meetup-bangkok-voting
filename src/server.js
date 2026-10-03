import { createVotingServer } from "./app.js";

function booleanSetting(value, defaultValue) {
  if (value === undefined || value === "") return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("COOKIE_SECURE must be true or false.");
}

function portSetting(value) {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer from 1 through 65535.");
  }
  return port;
}

const port = portSetting(process.env.PORT);
const { close, server } = createVotingServer({
  adminPassword: process.env.ADMIN_PASSWORD,
  cookieSecure: booleanSetting(process.env.COOKIE_SECURE, false),
  dataDirectory: process.env.DATA_DIR ?? "/app/data",
  sessionSecret: process.env.SESSION_SECRET
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Voting service is ready on port ${port}.`);
});

function shutdown(signal) {
  console.log(`Received ${signal}. Stopping the voting service.`);
  server.close(() => {
    close();
    process.exit(0);
  });
  setTimeout(() => {
    server.closeAllConnections();
  }, 5_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
