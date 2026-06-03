import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Menu from "@/pages/menu";
import AnalyticsPage from "./pages/admin/analytics";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import { supabase } from "./lib/supabase";
import TestRealtime from "@/pages/test-realtime";
import RewardsPage from "@/pages/rewards";
import CurrentOrder from "@/pages/current-order";
import RewardsDashboard from "@/pages/rewards-dashboard";
import BillPage from "@/pages/bill";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Menu} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/analytics" component={AnalyticsPage} />
      <Route path="/test" component={TestRealtime} />
      <Route path="/current-order" component={CurrentOrder} />
      <Route path="/rewards" component={RewardsPage} />
      <Route path="/rewards-dashboard" component={RewardsDashboard} />
      <Route path="/bill" component={BillPage} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
