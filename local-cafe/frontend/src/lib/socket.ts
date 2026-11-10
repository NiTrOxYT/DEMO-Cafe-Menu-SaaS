import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let activeAdminSubscription = false;
const activeOrderSubscriptions = new Map<number, string>();
const activeSessionSubscriptions = new Map<number, string>();
const connectListeners = new Set<() => void>();

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      path: "/socket.io/",
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: true,
    });

    socket.on("connect", () => {
      // Re-join admin room if registered
      if (activeAdminSubscription) {
        socket?.emit("join:admin");
      }

      // Re-join all active order rooms
      activeOrderSubscriptions.forEach((token, orderId) => {
        socket?.emit("join:order", { orderId, token });
      });

      // Re-join all active session rooms
      activeSessionSubscriptions.forEach((guestToken, sessionId) => {
        socket?.emit("join:session", { sessionId, guestToken });
      });

      // Notify any registered connect/reconnect listeners
      connectListeners.forEach((listener) => {
        try {
          listener();
        } catch (err) {
          console.error("Socket connect listener error:", err);
        }
      });
    });
  }
  return socket;
}

export function onSocketConnect(callback: () => void): () => void {
  connectListeners.add(callback);
  const s = getSocket();
  if (s.connected) {
    try {
      callback();
    } catch (err) {
      console.error(err);
    }
  }
  return () => {
    connectListeners.delete(callback);
  };
}

export function joinAdminRoom(): void {
  activeAdminSubscription = true;
  const s = getSocket();
  if (s.connected) {
    s.emit("join:admin");
  }
}

export function leaveAdminRoom(): void {
  activeAdminSubscription = false;
}

export function joinOrderRoom(orderId: number, token: string): void {
  if (!orderId) return;
  activeOrderSubscriptions.set(orderId, token);
  const s = getSocket();
  if (s.connected) {
    s.emit("join:order", { orderId, token });
  }
}

export function leaveOrderRoom(orderId: number): void {
  activeOrderSubscriptions.delete(orderId);
}

export function joinSessionRoom(sessionId: number, guestToken: string): void {
  if (!sessionId) return;
  activeSessionSubscriptions.set(sessionId, guestToken);
  const s = getSocket();
  if (s.connected) {
    s.emit("join:session", { sessionId, guestToken });
  }
}

export function leaveSessionRoom(sessionId: number): void {
  activeSessionSubscriptions.delete(sessionId);
}

export function onOrderCreated(callback: (order: any) => void): () => void {
  const s = getSocket();
  s.on("order:created", callback);
  return () => { s.off("order:created", callback); };
}

export function onOrderUpdated(callback: (order: any) => void): () => void {
  const s = getSocket();
  s.on("order:updated", callback);
  return () => { s.off("order:updated", callback); };
}

export function onOrderStatusChanged(callback: (data: { id: number; status: string; is_active: boolean; is_paid: boolean; session_id?: number }) => void): () => void {
  const s = getSocket();
  s.on("order:status_changed", callback);
  return () => { s.off("order:status_changed", callback); };
}

export function onOrderDeleted(callback: (data: { id: number }) => void): () => void {
  const s = getSocket();
  s.on("order:deleted", callback);
  return () => { s.off("order:deleted", callback); };
}

export function onSessionCreated(callback: (session: any) => void): () => void {
  const s = getSocket();
  s.on("session:created", callback);
  return () => { s.off("session:created", callback); };
}

export function onSessionUpdated(callback: (session: any) => void): () => void {
  const s = getSocket();
  s.on("session:updated", callback);
  return () => { s.off("session:updated", callback); };
}

export function onSessionFinished(callback: (data: { sessionId: number; tableNumber: string }) => void): () => void {
  const s = getSocket();
  s.on("session:finished", callback);
  return () => { s.off("session:finished", callback); };
}
