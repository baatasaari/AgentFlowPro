import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Facebook, Users, ShoppingBag, Target, MessageSquare, BarChart3, Zap, Shield } from "lucide-react";

const FacebookIntegration = () => {
  const facebookCapabilities = [
    {
      icon: Target,
      title: "Autonomous Ad Campaign Management",
      description: "AI agents that independently create, optimize, and manage Facebook ad campaigns based on performance data",
      features: ["Campaign creation", "Budget optimization", "Audience targeting", "Creative testing"]
    },
    {
      icon: MessageSquare,
      title: "Messenger Commerce Agent",
      description: "Intelligent agents that handle sales conversations, product recommendations, and order processing through Messenger",
      features: ["Product discovery", "Order management", "Payment processing", "Customer support"]
    },
    {
      icon: Users,
      title: "Community Management AI",
      description: "Agents that autonomously manage Facebook groups, moderate discussions, and engage with community members",
      features: ["Content moderation", "Member engagement", "Discussion facilitation", "Community growth"]
    },
    {
      icon: BarChart3,
      title: "Social Listening & Response",
      description: "Intelligent monitoring and autonomous response to brand mentions, comments, and social conversations",
      features: ["Brand monitoring", "Sentiment analysis", "Automated responses", "Crisis management"]
    }
  ];

  const platformFeatures = [
    {
      icon: MessageSquare,
      title: "Messenger API Integration",
      description: "Full integration with Facebook Messenger for automated customer conversations"
    },
    {
      icon: ShoppingBag,
      title: "Facebook Shop Integration",
      description: "Seamless integration with Facebook Shop for automated product management"
    },
    {
      icon: Target,
      title: "Facebook Ads API",
      description: "Direct integration with Facebook Ads API for autonomous campaign management"
    },
    {
      icon: Shield,
      title: "Privacy & Compliance",
      description: "Built-in privacy controls and compliance with Facebook's platform policies"
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
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
                  <Facebook className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                Facebook Business Agentic AI
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Deploy autonomous AI agents that leverage Facebook's massive reach to drive sales, 
                manage communities, and execute sophisticated marketing strategies across the platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="btn-primary">
                  Start Facebook Integration
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
                Autonomous Facebook Capabilities
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                AI agents that independently manage your entire Facebook business ecosystem
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {facebookCapabilities.map((capability, index) => {
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
                            <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
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
                Facebook Platform Integration Features
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Leverage Facebook's full business suite with intelligent automation
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
              Ready to Deploy Facebook Agents?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Start your 7-day free trial and transform your Facebook business operations with autonomous AI agents.
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

export default FacebookIntegration;