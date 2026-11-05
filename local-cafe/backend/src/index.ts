import http from "http";
import { validateEnvironment } from "./lib/envCheck.js";
import { createApp } from "./app.js";
import { initSocket } from "./socket.js";
import { runMigrations } from "./db/migrate.js";

const PORT = parseInt(process.env.PORT || "5000", 10);

async function startServer() {
  try {
    // 0. Enforce safe environment configuration (reject default/placeholder secrets)
    validateEnvironment();

    // 1. Ensure database schema is provisioned
    await runMigrations();

    // 2. Create Express app and HTTP server
    const app = createApp();
    const server = http.createServer(app);

    // 3. Initialize Socket.IO
    initSocket(server);

    // 4. Start listening
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`[Local Cafe API] Server running on http://0.0.0.0:${PORT}`);
      console.log(`[Local Cafe API] Realtime updates active via Socket.IO at /socket.io/`);
    });
  } catch (err: any) {
    console.error("[Local Cafe API] Fatal startup error:", err?.message || err);
    process.exit(1);
  }
}

startServer();
