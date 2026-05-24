import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import Register from "@/pages/Register";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";

// Platform-specific integration pages
import WhatsAppIntegration from "@/pages/integrations/WhatsAppIntegration";
import InstagramIntegration from "@/pages/integrations/InstagramIntegration";
import FacebookIntegration from "@/pages/integrations/FacebookIntegration";
import TelegramIntegration from "@/pages/integrations/TelegramIntegration";
import DiscordIntegration from "@/pages/integrations/DiscordIntegration";
import LinkedInIntegration from "@/pages/integrations/LinkedInIntegration";
import CustomIntegration from "@/pages/integrations/CustomIntegration";
import ABTestDashboard from "@/components/ABTestDashboard";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />

      {/* Auth */}
      <Route path="/signup" component={() => <GuestRoute component={Register} />} />
      <Route path="/register" component={() => <GuestRoute component={Register} />} />
      <Route path="/login" component={() => <GuestRoute component={Login} />} />

      {/* Protected app */}
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard/:rest*" component={() => <ProtectedRoute component={Dashboard} />} />

      {/* Platform Pages */}
      <Route path="/platform" component={Platform} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/ai-training" component={AITraining} />
      <Route path="/flow-designer" component={FlowDesigner} />
      <Route path="/analytics" component={Analytics} />

      {/* Platform-Specific Integration Pages */}
      <Route path="/integrations/whatsapp" component={WhatsAppIntegration} />
      <Route path="/integrations/instagram" component={InstagramIntegration} />
      <Route path="/integrations/facebook" component={FacebookIntegration} />
      <Route path="/integrations/telegram" component={TelegramIntegration} />
      <Route path="/integrations/discord" component={DiscordIntegration} />
      <Route path="/integrations/linkedin" component={LinkedInIntegration} />
      <Route path="/integrations/custom" component={CustomIntegration} />

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

      {/* Admin */}
      <Route path="/admin/ab-testing" component={ABTestDashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <Toaster />
            <Router />
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
