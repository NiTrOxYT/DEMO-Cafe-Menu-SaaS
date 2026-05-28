import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const DARK = "#0f0e0c";
const CARD = "#1c1a17";
const CREAM = "#f0ebe2";
const MUTED = "#7a7265";
const AMBER = "#c9a96e";

export default function CurrentOrder() {
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    fetchLatestOrder();

    const channel = supabase
      .channel("live-order")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchLatestOrder();
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchLatestOrder() {
    const tableNumber = new URLSearchParams(window.location.search).get(
      "table",
    );

    const orderId = localStorage.getItem(`activeOrderId_${tableNumber}`);

    if (!orderId) {
      setOrder(null);
      return;
    }

    const { data } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (*)
      `,
      )
      .eq("id", orderId)
      .single();

    if (!data) {
      setOrder(null);
      return;
    }

    if (data.is_paid || data.is_active === false) {
      localStorage.removeItem(`activeOrderId_${tableNumber}`);

      setOrder(null);

      return;
    }

    setOrder(data);
  }

  if (!order) {
    return (
      <div
        style={{
          background: DARK,
          minHeight: "100vh",
          color: CREAM,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        No Active Order
      </div>
    );
  }

  return (
    <div
      style={{
        background: DARK,
        minHeight: "100vh",
        padding: 24,
        color: CREAM,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          margin: "0 auto",
          background: CARD,
          borderRadius: 24,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          style={{
            marginBottom: 20,
            background: "transparent",
            border: "none",
            color: "#c9a96e",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ← Back to Menu
        </button>

        <p
          style={{
            color: AMBER,
            textTransform: "uppercase",
            letterSpacing: 2,
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          Live Order
        </p>

        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 24,
          }}
        >
          Current Order
        </h1>

        <div style={{ marginBottom: 20 }}>
          <p style={{ color: MUTED, fontSize: 14 }}>Status</p>

          <div
            style={{
              marginTop: 6,
              display: "inline-block",
              background: "#3b2f14",
              color: "#f6c453",
              padding: "8px 14px",
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            {order.status}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {order.order_items?.map((item: any) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p
                  style={{
                    color: "#f0ebe2",
                    fontWeight: 600,
                    marginBottom: 2,
                  }}
                >
                  {item.item_name}
                </p>

                <p
                  style={{
                    color: "#7a7265",
                    fontSize: 13,
                  }}
                >
                  Qty: {item.quantity}
                </p>
              </div>

              <p
                style={{
                  color: "#f0ebe2",
                  fontWeight: 700,
                }}
              >
                ₹{item.price * item.quantity}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <Row label="Subtotal" value={`₹${order.subtotal}`} />

          <Row label="Tax" value={`₹${order.tax}`} />

          <Row label="Total" value={`₹${order.total}`} big />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span
        style={{
          color: "#7a7265",
          fontSize: big ? 18 : 15,
        }}
      >
        {label}
      </span>

      <span
        style={{
          color: "#f0ebe2",
          fontWeight: 700,
          fontSize: big ? 24 : 16,
        }}
      >
        {value}
      </span>
    </div>
  );
}
