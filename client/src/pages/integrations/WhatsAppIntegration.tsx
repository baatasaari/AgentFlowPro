import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Users, ShoppingCart, Calendar, CreditCard, FileText, Shield, Zap } from "lucide-react";

const WhatsAppIntegration = () => {
  const whatsappCapabilities = [
    {
      icon: MessageCircle,
      title: "Autonomous Customer Service",
      description: "AI agents that independently handle customer inquiries, complaints, and support requests with WhatsApp's rich messaging features",
      features: ["Auto-ticket creation", "Escalation management", "Multi-language support", "24/7 availability"]
    },
    {
      icon: ShoppingCart,
      title: "Intelligent Commerce Agent",
      description: "Autonomous sales agents that showcase products, handle orders, and process payments directly within WhatsApp conversations",
      features: ["Product catalog integration", "Order processing", "Payment collection", "Inventory management"]
    },
    {
      icon: Users,
      title: "Lead Qualification System",
      description: "Agents that autonomously qualify leads, collect contact information, and route prospects to appropriate sales teams",
      features: ["Smart lead scoring", "Contact enrichment", "CRM integration", "Automated follow-ups"]
    },
    {
      icon: Calendar,
      title: "Appointment Orchestration",
      description: "Intelligent scheduling agents that manage calendars, book appointments, and handle rescheduling automatically",
      features: ["Calendar integration", "Availability management", "Reminder automation", "Conflict resolution"]
    }
  ];

  const businessFeatures = [
    {
      icon: Shield,
      title: "WhatsApp Business API",
      description: "Full integration with WhatsApp Business API for enterprise-grade messaging capabilities"
    },
    {
      icon: Zap,
      title: "Rich Media Support",
      description: "Send images, videos, documents, and interactive buttons with autonomous decision-making"
    },
    {
      icon: FileText,
      title: "Message Templates",
      description: "Pre-approved message templates that agents use intelligently based on conversation context"
    },
    {
      icon: CreditCard,
      title: "Payment Integration",
      description: "Secure payment processing directly within WhatsApp conversations"
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
                <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                WhatsApp Business Agentic AI
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Deploy autonomous AI agents that leverage WhatsApp's 2 billion users to deliver intelligent customer experiences, 
                autonomous sales processes, and self-managing support operations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="btn-primary">
                  Start WhatsApp Integration
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
                Autonomous WhatsApp Capabilities
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                AI agents that independently manage your entire WhatsApp business operations
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {whatsappCapabilities.map((capability, index) => {
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
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
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

        {/* WhatsApp Business Features */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                WhatsApp Business Integration Features
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Leverage WhatsApp's full feature set with intelligent automation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {businessFeatures.map((feature, index) => {
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
              Ready to Deploy WhatsApp Agents?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Start your 7-day free trial and see how autonomous agents transform your WhatsApp business operations.
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

export default WhatsAppIntegration;