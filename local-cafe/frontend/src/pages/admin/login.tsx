import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { adminLogin, firstRunSetup, getAuthStatus } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("The Golden Brew");

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (!status.initialized) {
          setIsFirstRun(true);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingSetup(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await adminLogin(email, password);
      toast({
        title: "Welcome back",
        description: "Signed in successfully.",
      });
      setLocation("/admin");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: err.message || "Invalid credentials.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFirstRunSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Email and password are required.",
      });
      return;
    }
    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords mismatch",
        description: "Passwords do not match.",
      });
      return;
    }

    setLoading(true);
    try {
      await firstRunSetup({ email, password, restaurantName });
      toast({
        title: "System Initialized",
        description: "Administrator account created. Welcome to your café!",
      });
      setLocation("/admin");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Setup failed",
        description: err.message || "Could not complete setup.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <p className="font-manrope text-[12px] uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
          Checking local system status...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-5">
      <div className="noise-overlay" />
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="font-manrope text-[11px] uppercase tracking-[0.18em] font-semibold text-secondary mb-3">
            {isFirstRun ? "Initial First-Run Setup" : "Admin Portal"}
          </p>
          <h1 className="font-garamond text-[40px] leading-tight text-foreground">
            {isFirstRun ? "Setup Café Admin" : "The Golden Brew"}
          </h1>
          {isFirstRun && (
            <p className="text-xs text-muted-foreground mt-2">
              Create your local master administrator account. No default passwords are used.
            </p>
          )}
        </div>

        {isFirstRun ? (
          /* First-Run Setup Form */
          <form onSubmit={handleFirstRunSetup} className="space-y-4">
            <div>
              <label className="block font-manrope text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-1">
                Café / Restaurant Name
              </label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="The Golden Brew"
                required
                className="w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-2.5 font-manrope text-[15px] outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="block font-manrope text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-1">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@yourcafe.com"
                required
                className="w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-2.5 font-manrope text-[15px] outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="block font-manrope text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-1">
                Master Password (min 6 chars)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-2.5 font-manrope text-[15px] outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="block font-manrope text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-2.5 font-manrope text-[15px] outline-none focus:border-foreground"
              />
            </div>
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-foreground text-background font-manrope text-[11px] uppercase tracking-[0.18em] font-semibold py-3.5 hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {loading ? "INITIALIZING SYSTEM..." : "CREATE MASTER ADMIN & INITIALIZE"}
              </button>
            </div>
          </form>
        ) : (
          /* Standard Login Form */
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block font-manrope text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@yourcafe.com"
                required
                className="w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-3 font-manrope text-[15px] outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="block font-manrope text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-3 font-manrope text-[15px] outline-none focus:border-foreground"
              />
            </div>
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-foreground text-background font-manrope text-[11px] uppercase tracking-[0.18em] font-semibold py-4 hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {loading ? "SIGNING IN..." : "ENTER PORTAL"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

