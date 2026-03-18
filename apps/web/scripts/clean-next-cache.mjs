import fs from "node:fs";
import path from "node:path";

const nextDir = path.resolve(process.cwd(), ".next");

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("[cache-guard] Cleared .next cache");
} catch (error) {
  console.error("[cache-guard] Failed to clear .next cache:", error);
  process.exitCode = 1;
}
