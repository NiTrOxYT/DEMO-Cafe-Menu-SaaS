import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function TestRealtime() {
  useEffect(() => {
    const channel = supabase
      .channel("orders-listener")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("Realtime Order Update:", payload);
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <h1>Orders Realtime Active</h1>
    </div>
  );
}
