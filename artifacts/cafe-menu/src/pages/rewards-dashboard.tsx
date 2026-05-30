import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const DARK = "#0f0e0c";
const CARD = "#1c1a17";
const CREAM = "#f0ebe2";
const AMBER = "#c9a96e";

export default function RewardsDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const claimReward = async () => {
    await supabase
      .from("rewards_users")
      .update({
        stars: 0,
        reward_available: false,
        rewards_claimed: (user.rewards_claimed || 0) + 1,
      })
      .eq("id", user.id);

    loadUser();
  };

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const email = localStorage.getItem("rewardEmail");

      console.log("Reward Email:", email);

      if (!email) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("rewards_users")
        .select("*")
        .eq("email", email)
        .single();

      console.log(data);
      console.log(error);

      setUser(data);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: DARK, color: CREAM }}
      >
        Loading Rewards...
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ background: DARK, color: CREAM }}
      >
        <h1 className="text-3xl font-bold mb-4">Rewards Account Not Found</h1>

        <button
          onClick={() => (window.location.href = "/rewards")}
          className="px-5 py-3 rounded-xl font-bold"
          style={{
            background: AMBER,
            color: DARK,
          }}
        >
          Join Rewards Program
        </button>
      </div>
    );
  }

  const stars = user.stars || 0;

  console.log(user);

  return (
    <div
      className="min-h-screen p-6"
      style={{
        background: "#0f0e0c",
        color: "#f0ebe2",
      }}
    >
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => (window.location.href = "/")}
            className="px-4 py-2 rounded-xl"
            style={{
              background: "#1c1a17",
              border: "1px solid rgba(201,169,110,0.15)",
            }}
          >
            ← Home
          </button>

          <div
            className="px-4 py-2 rounded-xl"
            style={{
              background: "rgba(201,169,110,0.12)",
              color: "#c9a96e",
            }}
          >
            Rewards Club
          </div>
        </div>

        {/* Main Card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: "#1c1a17",
            border: "1px solid rgba(201,169,110,0.15)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">⭐</div>

            <h1 className="text-3xl font-bold" style={{ color: "#c9a96e" }}>
              Welcome Back
            </h1>

            <p className="mt-2 text-lg">{user.name}</p>
          </div>

          {/* Progress */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">
              {"⭐".repeat(Math.min(stars, 5))}
              {"☆".repeat(Math.max(0, 5 - stars))}
            </div>

            <div
              className="h-3 rounded-full overflow-hidden"
              style={{
                background: "#25211d",
              }}
            >
              <div
                style={{
                  width: `${(stars / 5) * 100}%`,
                  background: "#c9a96e",
                  height: "100%",
                }}
              />
            </div>

            <p className="mt-3" style={{ color: "#7a7265" }}>
              {stars}/5 Stars Collected
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className="rounded-2xl p-4 text-center"
              style={{
                background: "#25211d",
              }}
            >
              <div className="text-2xl font-bold">{user.total_visits || 0}</div>

              <div className="text-sm" style={{ color: "#7a7265" }}>
                Visits
              </div>
            </div>

            <div
              className="rounded-2xl p-4 text-center"
              style={{
                background: "#25211d",
              }}
            >
              <div className="text-2xl font-bold" style={{ color: "#c9a96e" }}>
                {stars}
              </div>

              <div className="text-sm" style={{ color: "#7a7265" }}>
                Stars
              </div>
            </div>
          </div>

          {/* Reward Status */}
          {stars >= 5 ? (
            <div
              className="mb-6 p-5 rounded-2xl text-center"
              style={{
                background: "rgba(76,175,80,0.15)",
                border: "1px solid rgba(76,175,80,0.3)",
              }}
            >
              <div className="text-2xl mb-2">🎉</div>

              <div className="font-bold mb-2">Reward Unlocked</div>

              <div className="text-sm mb-4">Claim your 10% OFF reward</div>

              <button
                onClick={claimReward}
                className="w-full py-3 rounded-xl font-bold"
                style={{
                  background: "#c9a96e",
                  color: "#0f0e0c",
                }}
              >
                🎁 Claim Reward
              </button>
            </div>
          ) : (
            <div
              className="mb-6 p-5 rounded-2xl text-center"
              style={{
                background: "rgba(201,169,110,0.12)",
              }}
            >
              ⭐ {5 - stars} More Stars To Unlock Reward
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
