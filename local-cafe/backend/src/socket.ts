import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import cookie from "cookie";
import { verifyAdminToken } from "./lib/auth.js";
import { query } from "./db/index.js";
import { verifyOrderAccessToken, hashGuestToken } from "./lib/tokens.js";

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

    // 2. Join Order Room (requires matching 256-bit order capability token or valid admin session)
    socket.on("join:order", async (data: { orderId: number; token?: string }) => {
      try {
        const { orderId, token } = data || {};
        if (!orderId) {
          socket.emit("error", { message: "orderId is required to join order room" });
          return;
        }

        // Allow authenticated admin to observe order room without token
        const rawCookie = socket.handshake.headers.cookie;
        if (rawCookie) {
          const parsed = cookie.parse(rawCookie);
          const adminToken = parsed.admin_session;
          if (adminToken && verifyAdminToken(adminToken)) {
            socket.join(`order:${orderId}`);
            socket.emit("joined:order", { orderId, success: true });
            return;
          }
        }

        if (!token) {
          socket.emit("error", { message: "Capability token is required to join order room" });
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

    // 3. Join Table Session Room (requires valid guest capability token or admin session)
    socket.on("join:session", async (data: { sessionId: number; guestToken?: string }) => {
      try {
        const { sessionId, guestToken } = data || {};
        if (!sessionId) {
          socket.emit("error", { message: "sessionId is required to join session room" });
          return;
        }

        // Allow authenticated admin
        const rawCookie = socket.handshake.headers.cookie;
        if (rawCookie) {
          const parsed = cookie.parse(rawCookie);
          const adminToken = parsed.admin_session;
          if (adminToken && verifyAdminToken(adminToken)) {
            socket.join(`session:${sessionId}`);
            socket.emit("joined:session", { sessionId, success: true });
            return;
          }
        }

        if (!guestToken) {
          socket.emit("error", { message: "guestToken is required to join session room" });
          return;
        }

        const hash = hashGuestToken(guestToken);
        const res = await query(`
          SELECT m.id, m.session_id, s.status, s.table_number
          FROM table_session_members m
          JOIN table_sessions s ON m.session_id = s.id
          WHERE m.session_id = $1 AND m.guest_token_hash = $2 AND s.status = 'active'
        `, [sessionId, hash]);

        if (res.rows.length === 0) {
          socket.emit("error", { message: "Invalid or expired table session membership" });
          return;
        }

        socket.join(`session:${sessionId}`);
        socket.emit("joined:session", { sessionId, success: true });
      } catch (err) {
        socket.emit("error", { message: "Failed to join session room" });
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

export function broadcastSessionCreated(session: any) {
  if (!io) return;
  io.to("admin").emit("session:created", session);
}

export function broadcastSessionUpdated(session: any) {
  if (!io) return;
  io.to("admin").emit("session:updated", session);
  io.to(`session:${session.id}`).emit("session:updated", session);
}

export function broadcastSessionFinished(sessionId: number, tableNumber: string) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit("session:finished", { sessionId, tableNumber });
  io.to("admin").emit("session:finished", { sessionId, tableNumber });
  // Disconnect / remove all sockets from the session room
  io.in(`session:${sessionId}`).socketsLeave(`session:${sessionId}`);
}

export function broadcastSessionClosed(sessionId: number, tableNumber: string) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit("session:closed", { sessionId, tableNumber });
  io.to(`session:${sessionId}`).emit("session:finished", { sessionId, tableNumber });
  io.to("admin").emit("session:closed", { sessionId, tableNumber });
  io.to("admin").emit("session:finished", { sessionId, tableNumber });
  // Disconnect / remove all sockets from the session room
  io.in(`session:${sessionId}`).socketsLeave(`session:${sessionId}`);
}

export function broadcastOrderCreated(order: any) {
  if (!io) return;
  // Broadcast to admin room for kitchen display and sound notifications
  io.to("admin").emit("order:created", order);
  if (order.session_id) {
    io.to(`session:${order.session_id}`).emit("session:order_created", order);
    io.to(`session:${order.session_id}`).emit("order:created", order);
  }
}

export function broadcastOrderUpdated(order: any) {
  if (!io) return;
  io.to("admin").emit("order:updated", order);
  io.to(`order:${order.id}`).emit("order:updated", order);
  if (order.session_id) {
    io.to(`session:${order.session_id}`).emit("session:order_updated", order);
    io.to(`session:${order.session_id}`).emit("order:updated", order);
  }
}

export function broadcastOrderStatusChanged(id: number, status: string, isActive: boolean, isPaid: boolean, sessionId?: number) {
  if (!io) return;
  const payload = { id, status, is_active: isActive, is_paid: isPaid, session_id: sessionId };
  io.to("admin").emit("order:status_changed", payload);
  io.to(`order:${id}`).emit("order:status_changed", payload);
  if (sessionId) {
    io.to(`session:${sessionId}`).emit("order:status_changed", payload);
  }
}

export function broadcastOrderDeleted(id: number, sessionId?: number) {
  if (!io) return;
  io.to("admin").emit("order:deleted", { id });
  io.to(`order:${id}`).emit("order:deleted", { id });
  if (sessionId) {
    io.to(`session:${sessionId}`).emit("order:deleted", { id });
  }
}

