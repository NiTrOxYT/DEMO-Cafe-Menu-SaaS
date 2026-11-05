import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import cookie from "cookie";
import { verifyAdminToken } from "./lib/auth.js";
import { query } from "./db/index.js";
import { verifyOrderAccessToken } from "./lib/tokens.js";

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*", // LAN access
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io/",
  });

  io.on("connection", (socket: Socket) => {
    // 1. Join Admin Room (requires verified admin session cookie)
    socket.on("join:admin", () => {
      const rawCookie = socket.handshake.headers.cookie;
      if (rawCookie) {
        const parsed = cookie.parse(rawCookie);
        const adminToken = parsed.admin_session;
        if (adminToken && verifyAdminToken(adminToken)) {
          socket.join("admin");
          socket.emit("joined:admin", { success: true });
          return;
        }
      }
      socket.emit("error", { message: "Unauthorized admin session for realtime updates" });
    });

    // 2. Join Order Room (requires matching 256-bit order capability token)
    socket.on("join:order", async (data: { orderId: number; token: string }) => {
      try {
        const { orderId, token } = data || {};
        if (!orderId || !token) {
          socket.emit("error", { message: "orderId and token are required to join order room" });
          return;
        }

        const res = await query("SELECT id, order_access_token_hash FROM orders WHERE id = $1", [orderId]);
        if (res.rows.length === 0) {
          socket.emit("error", { message: "Order not found" });
          return;
        }

        const order = res.rows[0];
        if (verifyOrderAccessToken(token, order.order_access_token_hash)) {
          socket.join(`order:${orderId}`);
          socket.emit("joined:order", { orderId, success: true });
        } else {
          socket.emit("error", { message: "Invalid order capability access token" });
        }
      } catch (err) {
        socket.emit("error", { message: "Failed to join order room" });
      }
    });

    socket.on("disconnect", () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO not initialized!");
  }
  return io;
}

export function broadcastOrderCreated(order: any) {
  if (!io) return;
  // Broadcast to admin room for kitchen display and sound notifications
  io.to("admin").emit("order:created", order);
}

export function broadcastOrderUpdated(order: any) {
  if (!io) return;
  io.to("admin").emit("order:updated", order);
  io.to(`order:${order.id}`).emit("order:updated", order);
}

export function broadcastOrderStatusChanged(id: number, status: string, isActive: boolean, isPaid: boolean) {
  if (!io) return;
  const payload = { id, status, is_active: isActive, is_paid: isPaid };
  io.to("admin").emit("order:status_changed", payload);
  io.to(`order:${id}`).emit("order:status_changed", payload);
}

export function broadcastOrderDeleted(id: number) {
  if (!io) return;
  io.to("admin").emit("order:deleted", { id });
  io.to(`order:${id}`).emit("order:deleted", { id });
}

