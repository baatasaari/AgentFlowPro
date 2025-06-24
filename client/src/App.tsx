import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Platform from "@/pages/Platform";
import FeaturesPage from "@/pages/Features";
import IntegrationsPage from "@/pages/Integrations";
import AITraining from "@/pages/AITraining";
import FlowDesigner from "@/pages/FlowDesigner";
import Analytics from "@/pages/Analytics";
import Solutions from "@/pages/Solutions";
import PricingPage from "@/pages/Pricing";
import ResourcesPage from "@/pages/Resources";
import Documentation from "@/pages/Documentation";
import Blog from "@/pages/Blog";
import CaseStudies from "@/pages/CaseStudies";
import About from "@/pages/About";
import Security from "@/pages/Security";
import Contact from "@/pages/Contact";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      
      {/* Platform Pages */}
      <Route path="/platform" component={Platform} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/ai-training" component={AITraining} />
      <Route path="/flow-designer" component={FlowDesigner} />
      <Route path="/analytics" component={Analytics} />
      
      {/* Solutions Pages */}
      <Route path="/solutions" component={Solutions} />
      <Route path="/solutions/:industry" component={Solutions} />
      
      {/* Pricing */}
      <Route path="/pricing" component={PricingPage} />
      
      {/* Resources Pages */}
      <Route path="/resources" component={ResourcesPage} />
      <Route path="/docs" component={Documentation} />
      <Route path="/api" component={Documentation} />
      <Route path="/case-studies" component={CaseStudies} />
      <Route path="/blog" component={Blog} />
      <Route path="/community" component={ResourcesPage} />
      
      {/* Company Pages */}
      <Route path="/company" component={About} />
      <Route path="/about" component={About} />
      <Route path="/careers" component={About} />
      <Route path="/partners" component={About} />
      <Route path="/security" component={Security} />
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
