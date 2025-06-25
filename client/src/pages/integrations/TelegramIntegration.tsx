import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Users, ShoppingBag, Bot, MessageSquare, Shield, Zap, Database } from "lucide-react";

const TelegramIntegration = () => {
  const telegramCapabilities = [
    {
      icon: Bot,
      title: "Autonomous Bot Management",
      description: "AI agents that independently create, configure, and manage sophisticated Telegram bots with advanced conversational abilities",
      features: ["Bot deployment", "Command management", "User interaction", "Performance optimization"]
    },
    {
      icon: Users,
      title: "Channel & Group Orchestration",
      description: "Intelligent agents that autonomously manage Telegram channels and groups, moderate content, and engage communities",
      features: ["Content moderation", "Member management", "Engagement automation", "Growth strategies"]
    },
    {
      icon: ShoppingBag,
      title: "Telegram Commerce Agent",
      description: "Agents that handle product sales, process payments, and manage customer support directly within Telegram conversations",
      features: ["Product catalog", "Payment processing", "Order tracking", "Customer support"]
    },
    {
      icon: MessageSquare,
      title: "Multi-Chat Coordination",
      description: "Agents that simultaneously manage multiple Telegram conversations while maintaining context and personalization",
      features: ["Context preservation", "Multi-chat handling", "Personalization", "Conversation routing"]
    }
  ];

  const platformFeatures = [
    {
      icon: Bot,
      title: "Telegram Bot API",
      description: "Full integration with Telegram Bot API for comprehensive bot functionality"
    },
    {
      icon: Shield,
      title: "End-to-End Encryption",
      description: "Secure messaging with Telegram's built-in encryption and privacy features"
    },
    {
      icon: Database,
      title: "Inline Keyboard Support",
      description: "Rich interactive experiences with custom keyboards and inline buttons"
    },
    {
      icon: Zap,
      title: "File & Media Handling",
      description: "Intelligent processing and management of files, images, and media content"
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
                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center">
                  <Send className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                Telegram Bot Agentic AI
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Deploy autonomous AI agents that leverage Telegram's powerful bot ecosystem to create 
                sophisticated conversational experiences, manage communities, and drive business growth.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="btn-primary">
                  Start Telegram Integration
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
                Autonomous Telegram Capabilities
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                AI agents that independently manage your entire Telegram bot ecosystem
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {telegramCapabilities.map((capability, index) => {
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
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
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
                Telegram Platform Integration Features
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Leverage Telegram's full bot capabilities with intelligent automation
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
              Ready to Deploy Telegram Agents?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Start your 7-day free trial and transform your Telegram presence with autonomous bot agents.
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

export default TelegramIntegration;