import { Component, type ErrorInfo, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Menu from "@/pages/menu";
import AnalyticsPage from "./pages/admin/analytics";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import OrdersPage from "@/pages/admin/orders";
import SettingsPage from "@/pages/admin/settings";
import QRPage from "@/pages/admin/qr";
import InventoryPage from "@/pages/admin/inventory";
import RawMaterialsDashboard from "@/pages/admin/raw-materials";
import RewardsPage from "@/pages/rewards";
import CurrentOrder from "@/pages/current-order";
import RewardsDashboard from "@/pages/rewards-dashboard";
import BillPage from "@/pages/bill";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
    },
  },
});

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Café app failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-[100dvh] bg-[#F8F5EF] text-[#29231F] grid place-items-center p-6">
          <section
            className="max-w-md rounded-2xl border border-[#E5DDD1] bg-[#FFFDF9] p-6 text-center shadow-sm"
            data-startup-error={`${this.state.error.name}: ${this.state.error.message}`}
          >
            <h1 className="font-serif text-2xl font-bold">The menu couldn’t load</h1>
            <p className="mt-2 text-sm text-[#766B61]">
              Please refresh the page. If the problem continues, ask the café staff for help.
            </p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Menu} />
      <Route path="/qr-menu" component={Menu} />
      <Route path="/offers" component={Menu} />
      <Route path="/locations" component={Menu} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/orders" component={OrdersPage} />
      <Route path="/admin/settings" component={SettingsPage} />
      <Route path="/admin/inventory" component={InventoryPage} />
      <Route path="/inventory" component={RawMaterialsDashboard} />
      <Route path="/admin/raw-materials" component={RawMaterialsDashboard} />
      <Route path="/admin/qr" component={QRPage} />
      <Route path="/admin/analytics" component={AnalyticsPage} />
      <Route path="/current-order" component={CurrentOrder} />
      <Route path="/rewards" component={RewardsPage} />
      <Route path="/rewards-dashboard" component={RewardsDashboard} />
      <Route path="/bill" component={BillPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;

