import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Linkedin, Users, Briefcase, TrendingUp, MessageSquare, Network, Shield, Zap } from "lucide-react";

const LinkedInIntegration = () => {
  const linkedinCapabilities = [
    {
      icon: Users,
      title: "Autonomous Lead Generation",
      description: "AI agents that independently identify, qualify, and engage potential leads through LinkedIn's professional network",
      features: ["Prospect identification", "Lead qualification", "Automated outreach", "Connection management"]
    },
    {
      icon: Briefcase,
      title: "Recruitment Automation Agent",
      description: "Intelligent agents that autonomously source candidates, screen profiles, and manage recruitment workflows",
      features: ["Candidate sourcing", "Profile screening", "Interview scheduling", "Pipeline management"]
    },
    {
      icon: TrendingUp,
      title: "Content Strategy Orchestration",
      description: "Agents that analyze professional trends and autonomously create and distribute strategic content for maximum engagement",
      features: ["Content creation", "Trend analysis", "Posting optimization", "Engagement tracking"]
    },
    {
      icon: Network,
      title: "Network Expansion AI",
      description: "Agents that strategically build and manage professional networks, identifying valuable connections and opportunities",
      features: ["Connection strategy", "Relationship mapping", "Opportunity identification", "Network optimization"]
    }
  ];

  const platformFeatures = [
    {
      icon: MessageSquare,
      title: "LinkedIn Messaging API",
      description: "Direct integration with LinkedIn messaging for professional communication"
    },
    {
      icon: Users,
      title: "Sales Navigator Integration",
      description: "Advanced prospecting capabilities with Sales Navigator data and insights"
    },
    {
      icon: Shield,
      title: "Compliance & Ethics",
      description: "Built-in compliance with LinkedIn's professional standards and anti-spam policies"
    },
    {
      icon: Zap,
      title: "Company Page Management",
      description: "Automated management of LinkedIn company pages and professional branding"
    }
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        {/* Hero Section */}
        <section className="py-20 gradient-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-blue-700 rounded-2xl flex items-center justify-center">
                  <Linkedin className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                LinkedIn Professional Agentic AI
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Deploy autonomous AI agents that leverage LinkedIn's professional network to drive B2B sales, 
                automate recruitment, and build strategic business relationships at scale.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="btn-primary">
                  Start LinkedIn Integration
                </Button>
                <Button variant="outline" className="btn-secondary">
                  View Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Agentic Capabilities */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Autonomous LinkedIn Capabilities
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                AI agents that independently manage your entire LinkedIn professional strategy
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {linkedinCapabilities.map((capability, index) => {
                const IconComponent = capability.icon;
                return (
                  <Card key={index} className="card-hover">
                    <CardHeader>
                      <div className="feature-icon mb-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl">{capability.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-text-muted mb-4">{capability.description}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {capability.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className="flex items-center text-sm text-text-muted">
                            <div className="w-2 h-2 bg-blue-700 rounded-full mr-2"></div>
                            {feature}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Platform Features */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                LinkedIn Platform Integration Features
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Leverage LinkedIn's professional network with intelligent automation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {platformFeatures.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <Card key={index} className="text-center card-hover">
                    <CardHeader>
                      <div className="feature-icon mx-auto mb-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-text-muted text-sm">{feature.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 gradient-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Ready to Deploy LinkedIn Agents?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Start your 7-day free trial and transform your LinkedIn strategy with autonomous professional agents.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-white text-primary hover:bg-blue-50">
                Start Free 7-Day Trial
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                Schedule Demo
              </Button>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default LinkedInIntegration;