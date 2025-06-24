import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Network, TrendingUp, GitBranch, Database, Shield, Rocket, ArrowRight } from "lucide-react";

const Platform = () => {
  const platformFeatures = [
    {
      icon: Brain,
      title: "Advanced AI Engine",
      description: "Powered by GPT-4, Claude, and Gemini models with custom training capabilities",
      details: [
        "Multi-model LLM support",
        "Custom knowledge base integration",
        "Real-time learning and adaptation",
        "Context-aware conversations"
      ]
    },
    {
      icon: Network,
      title: "Universal Deployment",
      description: "Deploy across 15+ messaging platforms with unified management",
      details: [
        "WhatsApp Business API",
        "Telegram, Discord, Messenger",
        "Instagram, LinkedIn messaging",
        "Custom API integrations"
      ]
    },
    {
      icon: GitBranch,
      title: "Visual Flow Designer",
      description: "Drag-and-drop conversation builder with conditional logic",
      details: [
        "No-code flow creation",
        "Conditional branching",
        "Variable management",
        "A/B testing support"
      ]
    },
    {
      icon: TrendingUp,
      title: "Real-time Analytics",
      description: "Comprehensive insights into agent performance and user interactions",
      details: [
        "Conversation analytics",
        "Conversion tracking",
        "Performance metrics",
        "Custom dashboards"
      ]
    },
    {
      icon: Database,
      title: "Data Integration Hub",
      description: "Connect with CRMs, databases, and external services seamlessly",
      details: [
        "Salesforce, HubSpot, Zendesk",
        "MySQL, PostgreSQL, MongoDB",
        "REST API webhooks",
        "Real-time data sync"
      ]
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "SOC 2 compliant with role-based access and audit logging",
      details: [
        "End-to-end encryption",
        "RBAC permissions",
        "Audit trails",
        "GDPR compliance"
      ]
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
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                The Complete AI Agent Platform
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Build, train, and deploy intelligent conversational agents across any platform. 
                AgentFlow provides everything you need to create sophisticated AI-powered customer experiences.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="btn-primary flex items-center">
                  <Rocket className="w-5 h-5 mr-2" />
                  Start Building Now
                </Button>
                <Button variant="outline" className="btn-secondary">
                  View Live Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Features */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Enterprise-Grade Platform Components
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Every tool you need to create, manage, and scale intelligent conversational agents
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {platformFeatures.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <Card key={index} className="card-hover h-full">
                    <CardHeader>
                      <div className="feature-icon mb-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-text-muted mb-4">{feature.description}</p>
                      <ul className="space-y-2">
                        {feature.details.map((detail, detailIndex) => (
                          <li key={detailIndex} className="flex items-center text-sm text-text-muted">
                            <ArrowRight className="w-4 h-4 text-accent mr-2" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Architecture Overview */}
        <section className="py-20 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-6">
                  Built for Scale and Performance
                </h2>
                <p className="text-xl text-text-muted mb-8">
                  Our platform architecture is designed to handle millions of conversations 
                  while maintaining sub-second response times and 99.99% uptime.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mr-4">
                      <span className="text-accent font-bold">99.99%</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Guaranteed Uptime</h4>
                      <p className="text-text-muted text-sm">Enterprise SLA with redundant infrastructure</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mr-4">
                      <span className="text-accent font-bold">&lt;200ms</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Response Time</h4>
                      <p className="text-text-muted text-sm">Lightning-fast AI responses globally</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mr-4">
                      <span className="text-accent font-bold">10M+</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Daily Conversations</h4>
                      <p className="text-text-muted text-sm">Proven scale for enterprise workloads</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <img 
                  src="https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=600" 
                  alt="Cloud infrastructure and data centers" 
                  className="rounded-2xl shadow-xl w-full h-auto" 
                />
                <div className="absolute -bottom-6 -right-6 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Global Infrastructure</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 gradient-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Ready to Build Your AI Agent?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Join thousands of businesses using AgentFlow to automate customer interactions 
              and drive growth through intelligent conversations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-white text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors duration-200">
                Start Free Trial
              </Button>
              <Button 
                variant="outline" 
                className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors duration-200"
              >
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

export default Platform;