import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram, Heart, ShoppingBag, Users, Camera, MessageSquare, TrendingUp, Zap } from "lucide-react";

const InstagramIntegration = () => {
  const instagramCapabilities = [
    {
      icon: ShoppingBag,
      title: "Autonomous Social Commerce",
      description: "AI agents that independently manage Instagram Shopping, handle product inquiries, and process orders through DMs",
      features: ["Product catalog sync", "Order management", "Payment processing", "Inventory updates"]
    },
    {
      icon: Users,
      title: "Influencer Outreach Automation",
      description: "Agents that identify, contact, and manage relationships with potential brand ambassadors and influencers",
      features: ["Influencer discovery", "Outreach campaigns", "Contract negotiation", "Performance tracking"]
    },
    {
      icon: Heart,
      title: "Community Engagement Agent",
      description: "Intelligent agents that autonomously respond to comments, manage community interactions, and moderate content",
      features: ["Comment moderation", "Engagement automation", "Community building", "Brand protection"]
    },
    {
      icon: Camera,
      title: "Content Strategy Orchestration",
      description: "Agents that analyze performance data and autonomously adjust content strategies and posting schedules",
      features: ["Content optimization", "Posting automation", "Performance analysis", "Trend adaptation"]
    }
  ];

  const socialFeatures = [
    {
      icon: MessageSquare,
      title: "Direct Message Automation",
      description: "Intelligent DM management with automated responses and customer service capabilities"
    },
    {
      icon: TrendingUp,
      title: "Hashtag Intelligence",
      description: "AI-powered hashtag optimization and trending topic identification for maximum reach"
    },
    {
      icon: Zap,
      title: "Story Engagement",
      description: "Automated story interactions and intelligent story content suggestions"
    },
    {
      icon: Users,
      title: "Audience Analytics",
      description: "Deep audience insights and autonomous audience targeting optimization"
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
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                  <Instagram className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                Instagram Business Agentic AI
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Deploy autonomous AI agents that leverage Instagram's visual platform to drive sales, 
                manage communities, and execute sophisticated social commerce strategies.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="btn-primary">
                  Start Instagram Integration
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
                Autonomous Instagram Capabilities
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                AI agents that independently manage your entire Instagram business presence
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {instagramCapabilities.map((capability, index) => {
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
                            <div className="w-2 h-2 bg-pink-500 rounded-full mr-2"></div>
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

        {/* Instagram Features */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Instagram Business Integration Features
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Leverage Instagram's full feature set with intelligent automation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {socialFeatures.map((feature, index) => {
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
              Ready to Deploy Instagram Agents?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Start your 7-day free trial and transform your Instagram presence with autonomous AI agents.
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

export default InstagramIntegration;