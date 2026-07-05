import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { academicImportMiddleware } from "./admin-api.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const apiMiddleware = academicImportMiddleware();
const apiServer = http.createServer((req, res) => {
  apiMiddleware(req, res, () => {
    res.statusCode = 404;
    res.end("Not found");
  });
});

apiServer.listen(8787, "127.0.0.1", () => {
  console.log("Admin API: http://127.0.0.1:8787/admin-api");
});

const viteBin = path.resolve(rootDir, "node_modules/vite/bin/vite.js");
const vite = spawn(
  process.execPath,
  [viteBin, "--host", "127.0.0.1", "--port", "5173"],
  {
    cwd: rootDir,
    shell: false,
    stdio: "inherit",
  },
);

function shutdown() {
  vite.kill();
  apiServer.close(() => process.exit(0));
}

vite.on("exit", (code) => {
  apiServer.close(() => process.exit(code ?? 0));
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
