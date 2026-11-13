import React from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Navigation,
  RefreshCw,
  Compass,
  AlertTriangle,
  Lock,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LocationGateProps {
  status: "idle" | "checking" | "denied" | "out_of_range" | "accuracy_too_low" | "not_configured" | "error";
  distance?: number | null;
  accuracy?: number | null;
  restaurantName?: string;
  directionsUrl?: string | null;
  errorMessage?: string | null;
  onRetry: () => void;
  isAdmin?: boolean;
}

export const LocationGate: React.FC<LocationGateProps> = ({
  status,
  distance,
  accuracy,
  restaurantName = "The Golden Brew Café",
  directionsUrl,
  errorMessage,
  onRetry,
}) => {
  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#29231F] flex flex-col justify-between items-center px-6 py-10 relative overflow-hidden select-none">
      {/* Decorative background botanical accents */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#264332]/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#C9A96E]/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* Top Header / Brand */}
      <header className="w-full max-w-md flex flex-col items-center text-center z-10 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#264332]/10 border border-[#264332]/20 text-[#264332] text-xs font-medium tracking-wider uppercase mb-3">
          <MapPin size={12} className="text-[#264332]" />
          <span>In-Café Dining Only</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#1F2D24] tracking-tight">
          {restaurantName}
        </h1>
        <p className="text-xs text-[#766B61] mt-1">
          Exclusive table dining & fresh orders
        </p>
      </header>

      {/* Center Stage Card */}
      <main className="w-full max-w-md my-auto z-10 py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="bg-[#FFFDF9] border border-[#E8E2D5] rounded-3xl p-7 md:p-8 shadow-[0_8px_30px_rgb(38,67,50,0.06)] flex flex-col items-center text-center relative"
        >
          {/* Status Icon */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-[#F4EFE6] border border-[#E0D7C6] flex items-center justify-center text-[#264332] shadow-inner">
              {status === "checking" ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                >
                  <Compass size={36} className="text-[#264332]" />
                </motion.div>
              ) : status === "not_configured" ? (
                <AlertTriangle size={36} className="text-[#A86E4D]" />
              ) : status === "out_of_range" ? (
                <MapPin size={36} className="text-[#264332]" />
              ) : (
                <Lock size={36} className="text-[#766B61]" />
              )}
            </div>

            {status === "checking" && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#264332] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-[#264332]"></span>
              </span>
            )}
          </div>

          {/* Heading */}
          {status === "checking" && (
            <>
              <h2 className="text-xl font-serif font-semibold text-[#1F2D24] mb-2">
                Verifying Café Proximity
              </h2>
              <p className="text-sm text-[#766B61] leading-relaxed max-w-xs">
                Confirming you are seated at {restaurantName} to display our live menu and table ordering.
              </p>
            </>
          )}

          {status === "out_of_range" && (
            <>
              <h2 className="text-2xl font-serif font-semibold text-[#1F2D24] mb-2">
                Please visit our café to see the menu
              </h2>
              <p className="text-sm text-[#766B61] leading-relaxed mb-4">
                Our interactive menu and table ordering are exclusively available while seated inside the café (within 50 metres).
              </p>

              {typeof distance === "number" && (
                <div className="w-full bg-[#F4EFE6] border border-[#E0D7C6] rounded-xl px-4 py-3 mb-6 flex items-center justify-between text-xs">
                  <span className="text-[#766B61]">Distance from café:</span>
                  <span className="font-semibold text-[#264332]">
                    {distance > 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} metres`}
                  </span>
                </div>
              )}
            </>
          )}

          {status === "accuracy_too_low" && (
            <>
              <h2 className="text-xl font-serif font-semibold text-[#1F2D24] mb-2">
                Location Signal Too Weak
              </h2>
              <p className="text-sm text-[#766B61] leading-relaxed mb-4">
                Your device location accuracy is ±{accuracy ? Math.round(accuracy) : "?"}m. To ensure you are at the table, high accuracy within 65m is required.
              </p>
              <p className="text-xs text-[#8C8075] bg-[#F7F3EB] rounded-lg p-3 mb-6">
                Tip: Step away from thick walls or turn on high accuracy / Wi-Fi on your device to improve GPS signal.
              </p>
            </>
          )}

          {status === "denied" && (
            <>
              <h2 className="text-xl font-serif font-semibold text-[#1F2D24] mb-2">
                Location Permission Required
              </h2>
              <p className="text-sm text-[#766B61] leading-relaxed mb-4">
                To access the table menu and place orders, please allow location access in your browser settings when prompted.
              </p>
              <div className="w-full text-left bg-[#F7F3EB] border border-[#E5DDD1] rounded-xl p-3.5 mb-6 text-xs text-[#6B6157] space-y-1.5">
                <p className="font-medium text-[#29231F]">How to enable:</p>
                <p>1. Tap the lock/tune icon in your browser address bar.</p>
                <p>2. Set <strong>Location</strong> to <strong>Allow</strong>.</p>
                <p>3. Tap <strong>Try Again</strong> below.</p>
              </div>
            </>
          )}

          {status === "not_configured" && (
            <>
              <h2 className="text-xl font-serif font-semibold text-[#1F2D24] mb-2">
                Café Setup Required
              </h2>
              <p className="text-sm text-[#766B61] leading-relaxed mb-6">
                Café coordinates are not yet configured in the admin dashboard. Customer access remains safely protected. Please ask café staff to set café location.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h2 className="text-xl font-serif font-semibold text-[#1F2D24] mb-2">
                Proximity Check Unavailable
              </h2>
              <p className="text-sm text-[#766B61] leading-relaxed mb-6">
                {errorMessage || "Unable to confirm device proximity. Please check your network and GPS connection."}
              </p>
            </>
          )}

          {/* Action CTAs */}
          <div className="w-full flex flex-col gap-3">
            {directionsUrl && (status === "out_of_range" || status === "idle") && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button className="w-full h-12 bg-[#264332] hover:bg-[#1C3325] text-[#FFFDF9] font-medium rounded-xl shadow-md flex items-center justify-center gap-2">
                  <Navigation size={16} />
                  <span>Get Directions</span>
                  <ExternalLink size={14} className="opacity-70 ml-0.5" />
                </Button>
              </a>
            )}

            <Button
              variant={directionsUrl && status === "out_of_range" ? "outline" : "default"}
              onClick={onRetry}
              disabled={status === "checking"}
              className={`w-full h-12 font-medium rounded-xl flex items-center justify-center gap-2 ${
                directionsUrl && status === "out_of_range"
                  ? "border-[#D6CCC0] hover:bg-[#F2ECE1] text-[#29231F]"
                  : "bg-[#264332] hover:bg-[#1C3325] text-[#FFFDF9] shadow-md"
              }`}
            >
              <RefreshCw
                size={16}
                className={status === "checking" ? "animate-spin" : ""}
              />
              <span>{status === "checking" ? "Checking location…" : "Try Again"}</span>
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Footer Privacy Guarantee */}
      <footer className="w-full max-w-md text-center z-10 pt-4">
        <div className="inline-flex items-center gap-1.5 text-xs text-[#8C8075]">
          <ShieldCheck size={14} className="text-[#264332]" />
          <span>Location is only used to verify table proximity and is never stored.</span>
        </div>
      </footer>
    </div>
  );
};
export default LocationGate;

