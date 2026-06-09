import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ArrowLeft, Gift, Leaf, Coffee, ChevronRight } from "lucide-react";

const DARK = "#080706";
const DARK_CARD = "#141210";
const DARK_ELEVATED = "#1c1916";
const CREAM = "#f5f0e8";
const MUTED = "#8a8278";
const AMBER = "#c9a96e";
const AMBER_LIGHT = "#e8d4a8";
const BORDER = "rgba(255,255,255,0.07)";
const GOLD_GRADIENT = "linear-gradient(135deg, #b8924f 0%, #e8d4a8 45%, #c9a96e 100%)";

const PERKS = [
  { icon: <Star size={14} />, text: "Earn a star for every ₹500 spent" },
  { icon: <Gift size={14} />, text: "5 stars = 10% off your next order" },
  { icon: <Coffee size={14} />, text: "Exclusive member offers & early access" },
];

const MAX_STARS = 5;

export default function RewardsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (joined) {
      const timer = setTimeout(() => {
        window.location.href = "/rewards-dashboard";
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [joined]);

  const sendOtp = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Please fill in your name and email.");
      return;
    }
    setError("");
    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (otpError) { setError(otpError.message); return; }
    setOtpSent(true);
  };

  const verifyOtp = async () => {
    if (!otp.trim()) { setError("Enter your OTP."); return; }
    setError("");
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email, token: otp, type: "email",
    });
    if (verifyError) { setError(verifyError.message); setLoading(false); return; }

    const { data: existingUser } = await supabase
      .from("rewards_users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (!existingUser) {
      const { error: insertError } = await supabase
        .from("rewards_users")
        .insert({ name, email, stars: 0, total_visits: 0 })
        .select()
        .single();

      if (insertError) { setError(insertError.message); setLoading(false); return; }
    }

    localStorage.setItem("rewardEmail", email);
    setLoading(false);
    setJoined(true);
  };

  if (joined) {
    return (
      <div
        style={{ background: DARK, minHeight: "100dvh" }}
        className="flex items-center justify-center px-6"
      >
        <div
          className="pointer-events-none fixed inset-0"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(201,169,110,0.18), transparent 70%)" }}
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 20 }}
          className="relative w-full max-w-sm text-center rounded-3xl p-10"
          style={{
            background: DARK_CARD,
            border: `1px solid rgba(201,169,110,0.25)`,
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 80px rgba(201,169,110,0.15)",
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl" style={{ background: GOLD_GRADIENT }} />
          <motion.div
            initial={{ rotate: -15, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 280 }}
            className="text-6xl mb-5"
          >
            🎉
          </motion.div>
          <h2 className="font-serif text-3xl font-bold mb-2" style={{ color: CREAM }}>
            Welcome, {name.split(" ")[0]}!
          </h2>
          <p className="text-sm mb-6" style={{ color: MUTED }}>
            You're now part of the Rewards Club. Start earning stars on every visit.
          </p>
          <div className="flex justify-center gap-2 mb-6">
            {Array.from({ length: MAX_STARS }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4 + i * 0.1, type: "spring" }}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: i === 0 ? GOLD_GRADIENT : "rgba(255,255,255,0.04)",
                  border: `1px solid ${i === 0 ? AMBER : BORDER}`,
                }}
              >
                <Star size={15} style={{ color: i === 0 ? DARK : "rgba(255,255,255,0.2)" }} fill={i === 0 ? DARK : "none"} />
              </motion.div>
            ))}
          </div>
          <p className="text-xs" style={{ color: MUTED }}>Redirecting to your dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ background: DARK, minHeight: "100dvh", color: CREAM }} className="pb-12">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(201,169,110,0.09), transparent 60%)" }}
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
          <h1 className="font-serif text-base font-bold" style={{ color: CREAM }}>
            Rewards Club
          </h1>
        </div>
      </header>

      <div className="relative z-10 max-w-sm mx-auto px-5 pt-8 space-y-5">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-2"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{
              background: "rgba(201,169,110,0.12)",
              border: `1px solid rgba(201,169,110,0.25)`,
              boxShadow: "0 8px 32px rgba(201,169,110,0.2)",
            }}
          >
            <Gift size={26} style={{ color: AMBER }} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-2" style={{ color: AMBER }}>
            Member Benefits
          </p>
          <h1 className="font-serif text-3xl font-bold mb-2" style={{ color: CREAM }}>
            Earn. Redeem.<br />Repeat.
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
            Collect stars and unlock discounts on every visit.
          </p>
        </motion.div>

        {/* Perks */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: DARK_CARD, border: `1px solid ${BORDER}` }}
        >
          {PERKS.map((perk, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-4 border-b last:border-0"
              style={{ borderColor: BORDER }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(201,169,110,0.12)", color: AMBER }}
              >
                {perk.icon}
              </div>
              <p className="text-sm" style={{ color: CREAM }}>{perk.text}</p>
            </div>
          ))}
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-5 space-y-4"
          style={{ background: DARK_CARD, border: `1px solid ${BORDER}` }}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: MUTED }}>
            {otpSent ? "Verify your email" : "Create your account"}
          </p>

          <AnimatePresence mode="wait">
            {!otpSent ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>
                    Your Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 rounded-xl outline-none text-sm transition-all focus:ring-1"
                    style={{
                      background: DARK_ELEVATED,
                      color: CREAM,
                      border: `1px solid ${BORDER}`,
                      caretColor: AMBER,
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>
                    Email Address
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    type="email"
                    className="w-full px-4 py-3 rounded-xl outline-none text-sm transition-all"
                    style={{
                      background: DARK_ELEVATED,
                      color: CREAM,
                      border: `1px solid ${BORDER}`,
                      caretColor: AMBER,
                    }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <p className="text-xs" style={{ color: MUTED }}>
                  We sent a code to <span style={{ color: CREAM }}>{email}</span>
                </p>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm tracking-[0.3em] text-center"
                  style={{
                    background: DARK_ELEVATED,
                    color: CREAM,
                    border: `1px solid ${BORDER}`,
                    caretColor: AMBER,
                  }}
                />
                <button
                  onClick={() => setOtpSent(false)}
                  className="text-xs"
                  style={{ color: MUTED }}
                >
                  ← Change email
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "#f87171", background: "rgba(248,113,113,0.1)" }}>
              {error}
            </p>
          )}

          <button
            onClick={otpSent ? verifyOtp : sendOtp}
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            style={{
              background: GOLD_GRADIENT,
              color: DARK,
              boxShadow: "0 8px 24px rgba(201,169,110,0.3)",
            }}
          >
            {loading
              ? "Please wait..."
              : otpSent
                ? "Verify & Join"
                : "Send Verification Code"}
            {!loading && <ChevronRight size={16} />}
          </button>
        </motion.div>

        {/* Already enrolled? */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <button
            onClick={() => (window.location.href = "/rewards-dashboard")}
            className="text-xs underline underline-offset-4"
            style={{ color: MUTED }}
          >
            Already a member? View my rewards →
          </button>
        </motion.div>
      </div>
    </div>
  );
}