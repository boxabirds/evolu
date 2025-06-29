import { createConsole } from "@evolu/common";
import { createNodeJsRelay } from "@evolu/nodejs";
import { mkdirSync } from "fs";

const deps = {
  console: createConsole(),
};

// Ensure data directory exists
mkdirSync("data", { recursive: true });

// Change to data directory so database file is created there
process.chdir("data");

// Note: The relay server currently doesn't have group-specific functionality.
// Group support is handled at the client level through the groups extension.
// The relay works with the existing protocol for syncing encrypted messages.
const relay = await createNodeJsRelay(deps)({
  port: 4000,
  enableLogging: false,
});

process.on("SIGINT", relay[Symbol.dispose]);
process.on("SIGTERM", relay[Symbol.dispose]);