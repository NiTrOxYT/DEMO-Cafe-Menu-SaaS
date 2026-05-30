import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

const DARK = "#0f0e0c";
const DARK_CARD = "#1c1a17";
const CREAM = "#f0ebe2";
const MUTED = "#7a7265";
const AMBER = "#c9a96e";

export default function RewardsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (joined) {
      const timer = setTimeout(() => {
        window.location.href = "/";
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [joined]);

  const sendOtp = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    setOtpSent(true);
    alert("OTP sent to your email");
  };

  const verifyOtp = async () => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      alert(error.message);
      return;
    }

    const { data: existingUser } = await supabase
      .from("rewards_users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (!existingUser) {
      const { data, error: insertError } = await supabase
        .from("rewards_users")
        .insert({
          name,
          email,
          stars: 0,
          total_visits: 0,
        })
        .select()
        .single();

      console.log("Inserted User:", data);
      console.log("Insert Error:", insertError);

      if (insertError) {
        alert(insertError.message);
        return;
      }
    }

    localStorage.setItem("rewardEmail", email);

    console.log("Stored Email:", email);

    window.location.href = "/rewards-dashboard";
  };

  const handleJoin = () => {
    alert("OTP integration coming next");
  };

  if (joined) {
    return (
      <div
        className="flex items-center justify-center min-h-screen p-6"
        style={{
          background:
            "radial-gradient(circle at center, rgba(201,169,110,0.15), #0f0e0c)",
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full rounded-3xl p-10 text-center"
          style={{
            background: "#1c1a17",
            border: "1px solid rgba(201,169,110,0.25)",
            boxShadow: "0 0 80px rgba(201,169,110,0.25)",
          }}
        >
          <motion.div
            initial={{ rotate: -15, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-7xl mb-6"
          >
            🎉
          </motion.div>

          <h1 className="text-3xl font-bold mb-3" style={{ color: "#f0ebe2" }}>
            Welcome to Rewards Club
          </h1>

          <p className="mb-6" style={{ color: "#c9a96e" }}>
            Congratulations! Your account has been created successfully.
          </p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-4xl mb-6"
          >
            ⭐ ⭐ ⭐ ⭐ ⭐
          </motion.div>

          <p className="text-sm" style={{ color: "#7a7265" }}>
            Start collecting stars on every dine-in visit.
          </p>

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="mt-8 px-6 py-3 rounded-xl font-bold"
            style={{
              background: "#c9a96e",
              color: "#0f0e0c",
            }}
          >
            Continue Ordering →
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        padding: "24px",
      }}
      className="flex items-center justify-center"
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: DARK_CARD,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="p-8 text-center"
          style={{
            background:
              "linear-gradient(180deg, rgba(201,169,110,0.15), rgba(201,169,110,0.02))",
          }}
        >
          <div
            className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center text-4xl"
            style={{
              background: "rgba(201,169,110,0.15)",
              border: "1px solid rgba(201,169,110,0.25)",
            }}
          >
            ⭐
          </div>

          <h1 className="text-3xl font-bold mb-2" style={{ color: CREAM }}>
            Rewards Club
          </h1>

          <p className="text-sm" style={{ color: MUTED }}>
            Collect 5 Stars and get 10% OFF
          </p>
        </div>

        {/* Body */}
        <div className="p-8">
          {/* Progress Preview */}
          <div className="mb-8 text-center">
            <p className="text-sm mb-3" style={{ color: MUTED }}>
              Your Progress
            </p>

            <div className="text-3xl tracking-widest">⭐ ☆ ☆ ☆ ☆</div>

            <p className="text-xs mt-3" style={{ color: MUTED }}>
              Earn 5 stars to unlock your reward
            </p>
          </div>

          {/* Name */}
          <div className="mb-4">
            <label className="block mb-2 text-sm" style={{ color: CREAM }}>
              Your Name
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{
                background: "#25211d",
                color: CREAM,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>

          {/* Email */}
          <div className="mb-6">
            <label className="block mb-2 text-sm" style={{ color: CREAM }}>
              Email Address
            </label>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{
                background: "#25211d",
                color: CREAM,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>

          {otpSent && (
            <div className="mb-6">
              <label className="block mb-2 text-sm" style={{ color: CREAM }}>
                Enter OTP
              </label>

              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP"
                className="w-full px-4 py-3 rounded-xl outline-none"
                style={{
                  background: "#25211d",
                  color: CREAM,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
            </div>
          )}

          {/* Benefits */}
          <div
            className="rounded-2xl p-4 mb-6"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <h3 className="font-semibold mb-3" style={{ color: CREAM }}>
              Benefits
            </h3>

            <ul className="space-y-2 text-sm" style={{ color: MUTED }}>
              <li>⭐ Earn stars on every dine-in</li>
              <li>🎁 Redeem rewards after 5 stars</li>
              <li>☕ Exclusive member offers</li>
            </ul>
          </div>

          {/* Button */}
          <motion.button
            whileHover={{
              scale: 1.02,
              boxShadow: "0 0 30px rgba(201,169,110,0.35)",
            }}
            whileTap={{
              scale: 0.96,
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 15,
            }}
            onClick={otpSent ? verifyOtp : sendOtp}
            className="w-full py-4 rounded-xl font-bold"
            style={{
              background: AMBER,
              color: DARK,
            }}
          >
            {otpSent ? "Verify OTP" : "Send OTP"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
