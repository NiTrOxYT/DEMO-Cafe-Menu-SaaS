import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

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
  }
  return socket;
}

export function joinAdminRoom(): void {
  const s = getSocket();
  s.emit("join:admin");
}

export function joinOrderRoom(orderId: number, token: string): void {
  const s = getSocket();
  s.emit("join:order", { orderId, token });
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

export function onOrderStatusChanged(callback: (data: { id: number; status: string; is_active: boolean; is_paid: boolean }) => void): () => void {
  const s = getSocket();
  s.on("order:status_changed", callback);
  return () => { s.off("order:status_changed", callback); };
}

export function onOrderDeleted(callback: (data: { id: number }) => void): () => void {
  const s = getSocket();
  s.on("order:deleted", callback);
  return () => { s.off("order:deleted", callback); };
}

