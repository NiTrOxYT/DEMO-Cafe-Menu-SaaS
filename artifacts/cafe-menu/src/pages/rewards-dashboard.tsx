import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, Star, Sparkles, Trophy, Coffee } from "lucide-react";

const DARK = "#080706";
const DARK_CARD = "#141210";
const DARK_ELEVATED = "#1c1916";
const CREAM = "#f5f0e8";
const MUTED = "#8a8278";
const AMBER = "#c9a96e";
const AMBER_LIGHT = "#e8d4a8";
const BORDER = "rgba(255,255,255,0.07)";
const GOLD_GRADIENT = "linear-gradient(135deg, #b8924f 0%, #e8d4a8 45%, #c9a96e 100%)";

const MAX_STARS = 5;

export default function RewardsDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => { loadUser(); }, []);

  async function loadUser() {
    try {
      const email = localStorage.getItem("rewardEmail");
      if (!email) { setLoading(false); return; }

      const { data } = await supabase
        .from("rewards_users")
        .select("*")
        .eq("email", email)
        .single();

      setUser(data);
    } catch {}
    setLoading(false);
  }

  async function claimReward() {
    setClaiming(true);
    await supabase
      .from("rewards_users")
      .update({
        stars: 0,
        reward_available: false,
        rewards_claimed: (user.rewards_claimed || 0) + 1,
      })
      .eq("id", user.id);

    setClaimed(true);
    setTimeout(() => {
      setClaimed(false);
      loadUser();
    }, 3000);
    setClaiming(false);
  }

  if (loading) {
    return (
      <div style={{ background: DARK, minHeight: "100dvh" }} className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse"
            style={{ background: "rgba(201,169,110,0.12)", border: `1px solid rgba(201,169,110,0.25)` }}
          >
            <Star size={18} style={{ color: AMBER }} />
          </div>
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: MUTED }}>Loading rewards...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{ background: DARK, minHeight: "100dvh" }}
        className="flex flex-col items-center justify-center px-6 text-center"
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "rgba(201,169,110,0.1)", border: `1px solid rgba(201,169,110,0.2)` }}
        >
          <Gift size={28} style={{ color: AMBER }} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.25em] font-semibold mb-3" style={{ color: AMBER }}>
          Not Enrolled
        </p>
        <h1 className="font-serif text-2xl font-bold mb-3" style={{ color: CREAM }}>
          Join the Rewards Club
        </h1>
        <p className="text-sm mb-8 max-w-xs" style={{ color: MUTED }}>
          Earn stars with every visit and unlock exclusive discounts.
        </p>
        <button
          onClick={() => (window.location.href = "/rewards")}
          className="px-6 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110"
          style={{ background: GOLD_GRADIENT, color: DARK }}
        >
          Enroll Now
        </button>
      </div>
    );
  }

  const stars = user.stars || 0;
  const progress = (stars / MAX_STARS) * 100;
  const starsLeft = MAX_STARS - stars;
  const rewardReady = stars >= MAX_STARS;

  return (
    <div style={{ background: DARK, minHeight: "100dvh", color: CREAM }} className="pb-24">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse 80% 45% at 50% -5%, rgba(201,169,110,0.1), transparent 65%)`,
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center gap-4 px-5 h-16 border-b"
        style={{
          background: "rgba(8,7,6,0.85)",
          backdropFilter: "blur(20px)",
          borderColor: BORDER,
        }}
      >
        <button
          onClick={() => (window.location.href = "/")}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-all hover:opacity-70"
          style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}` }}
        >
          <ArrowLeft size={16} style={{ color: AMBER }} />
        </button>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: AMBER }}>
            Rewards Club
          </p>
          <h1 className="font-serif text-base font-bold" style={{ color: CREAM }}>
            {user.name}
          </h1>
        </div>
        <div
          className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ background: "rgba(201,169,110,0.1)", color: AMBER_LIGHT, border: `1px solid rgba(201,169,110,0.25)` }}
        >
          Member
        </div>
      </header>

      <div className="relative z-10 max-w-lg mx-auto px-5 pt-6 space-y-5">
        {/* Star card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-7"
          style={{
            background: DARK_CARD,
            border: `1px solid rgba(201,169,110,0.2)`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          {/* Top gold bar */}
          <div
            className="absolute top-0 left-0 right-0 h-0.5"
            style={{ background: GOLD_GRADIENT }}
          />
          {/* Glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(201,169,110,0.1), transparent 70%)",
            }}
          />

          <div className="relative text-center mb-7">
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold mb-1" style={{ color: AMBER }}>
              Your Stars
            </p>
            <div className="flex items-center justify-center gap-2 my-4">
              {Array.from({ length: MAX_STARS }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 300 }}
                >
                  {i < stars ? (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: GOLD_GRADIENT, boxShadow: "0 4px 16px rgba(201,169,110,0.4)" }}
                    >
                      <Star size={18} fill={DARK} style={{ color: DARK }} />
                    </div>
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}
                    >
                      <Star size={18} style={{ color: "rgba(255,255,255,0.15)" }} />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
            <p className="text-sm" style={{ color: MUTED }}>
              {rewardReady
                ? "Your reward is ready to claim!"
                : `${starsLeft} more star${starsLeft !== 1 ? "s" : ""} to unlock 10% off`}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                className="h-full rounded-full"
                style={{ background: GOLD_GRADIENT }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] font-semibold" style={{ color: MUTED }}>{stars}/{MAX_STARS} stars</span>
              <span className="text-[10px] font-semibold" style={{ color: AMBER }}>
                {rewardReady ? "Reward unlocked!" : `${Math.round(progress)}%`}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-3"
        >
          {[
            { icon: <Coffee size={16} />, label: "Visits", value: user.total_visits || 0 },
            { icon: <Trophy size={16} />, label: "Rewards claimed", value: user.rewards_claimed || 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-5 flex flex-col gap-2"
              style={{ background: DARK_CARD, border: `1px solid ${BORDER}` }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(201,169,110,0.12)", color: AMBER }}
              >
                {stat.icon}
              </div>
              <p className="text-2xl font-serif font-bold" style={{ color: CREAM }}>
                {stat.value}
              </p>
              <p className="text-xs" style={{ color: MUTED }}>{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Claim / earn more */}
        <AnimatePresence mode="wait">
          {claimed ? (
            <motion.div
              key="claimed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl p-7 text-center"
              style={{
                background: "rgba(52,211,153,0.1)",
                border: "1px solid rgba(52,211,153,0.25)",
              }}
            >
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="font-serif text-xl font-bold mb-1" style={{ color: CREAM }}>
                Reward Claimed!
              </h3>
              <p className="text-sm" style={{ color: MUTED }}>
                Show this to your server to enjoy 10% off.
              </p>
            </motion.div>
          ) : rewardReady ? (
            <motion.div
              key="reward"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl p-6"
              style={{ background: DARK_CARD, border: `1px solid rgba(201,169,110,0.3)` }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                style={{ background: GOLD_GRADIENT }}
              />
              <div className="text-center mb-5">
                <div className="text-3xl mb-2">🎁</div>
                <h3 className="font-serif text-xl font-bold mb-1" style={{ color: CREAM }}>
                  You've earned a reward
                </h3>
                <p className="text-sm" style={{ color: MUTED }}>
                  Claim your 10% discount on your next order.
                </p>
              </div>
              <button
                onClick={claimReward}
                disabled={claiming}
                className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: GOLD_GRADIENT,
                  color: DARK,
                  boxShadow: "0 8px 24px rgba(201,169,110,0.35)",
                }}
              >
                <Sparkles size={16} />
                {claiming ? "Claiming..." : "Claim Reward"}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="earn"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl p-5"
              style={{ background: "rgba(201,169,110,0.06)", border: `1px solid rgba(201,169,110,0.15)` }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(201,169,110,0.12)", color: AMBER }}
                >
                  <Star size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: CREAM }}>
                    Spend ₹500+ to earn a star
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                    {starsLeft} more star{starsLeft !== 1 ? "s" : ""} until your next reward
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          onClick={() => (window.location.href = "/")}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-80"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${BORDER}`,
            color: CREAM,
          }}
        >
          Back to Menu
        </motion.button>
      </div>
    </div>
  );
}