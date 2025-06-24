import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import FeaturesPage from "@/pages/Features";
import IntegrationsPage from "@/pages/Integrations";
import PricingPage from "@/pages/Pricing";
import ResourcesPage from "@/pages/Resources";
import Contact from "@/pages/Contact";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/resources" component={ResourcesPage} />
      <Route path="/contact" component={Contact} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
