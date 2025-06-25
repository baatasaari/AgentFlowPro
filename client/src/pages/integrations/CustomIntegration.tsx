import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Puzzle, Zap, Database, Globe, Shield, Bot, Settings } from "lucide-react";

const CustomIntegration = () => {
  const customCapabilities = [
    {
      icon: Code,
      title: "API-First Architecture",
      description: "Autonomous agents that adapt to any custom API or webhook system, learning and optimizing integration patterns",
      features: ["REST API integration", "GraphQL support", "Webhook management", "Custom protocols"]
    },
    {
      icon: Database,
      title: "Data Source Orchestration",
      description: "Intelligent agents that connect to any database, CRM, or data source, creating unified data workflows",
      features: ["Multi-database support", "Real-time sync", "Data transformation", "Schema adaptation"]
    },
    {
      icon: Bot,
      title: "Custom Platform Agents",
      description: "Agents that autonomously learn and adapt to proprietary platforms, internal tools, and custom business systems",
      features: ["Platform learning", "Custom protocols", "Workflow adaptation", "System integration"]
    },
    {
      icon: Puzzle,
      title: "Legacy System Integration",
      description: "Specialized agents that bridge modern AI capabilities with legacy systems and outdated platforms",
      features: ["Legacy protocol support", "Data migration", "System modernization", "Compatibility layers"]
    }
  ];

  const technicalFeatures = [
    {
      icon: Settings,
      title: "SDK & Libraries",
      description: "Comprehensive SDKs for popular programming languages and frameworks"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Advanced security protocols for custom enterprise integrations"
    },
    {
      icon: Globe,
      title: "Cloud & On-Premise",
      description: "Flexible deployment options for any infrastructure requirement"
    },
    {
      icon: Zap,
      title: "Real-Time Processing",
      description: "High-performance real-time data processing and response capabilities"
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
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
                  <Code className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                Custom API Agentic Integration
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Deploy autonomous AI agents that seamlessly integrate with any custom API, proprietary system, 
                or internal tool. Our agents learn, adapt, and optimize integrations automatically.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="btn-primary">
                  Start Custom Integration
                </Button>
                <Button variant="outline" className="btn-secondary">
                  View Documentation
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
                Autonomous Custom Integration Capabilities
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                AI agents that independently connect and optimize any custom system or API
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {customCapabilities.map((capability, index) => {
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
                            <div className="w-2 h-2 bg-gray-800 rounded-full mr-2"></div>
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

        {/* Technical Features */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Technical Integration Features
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Enterprise-grade tools and capabilities for any integration requirement
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {technicalFeatures.map((feature, index) => {
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

        {/* Code Example Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Simple Integration Example
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Get started with custom integrations in minutes
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <Card className="p-6">
                <pre className="bg-gray-900 text-green-400 p-6 rounded-lg overflow-x-auto">
                  <code>{`// Initialize AgentFlow with custom API
const agentflow = new AgentFlow({
  apiKey: 'your-api-key',
  customEndpoint: 'https://your-api.com/v1'
});

// Create autonomous agent with custom integration
const agent = await agentflow.createAgent({
  name: 'CustomSystemAgent',
  integrations: [{
    type: 'custom',
    endpoint: 'https://your-system.com/api',
    authentication: {
      type: 'bearer',
      token: 'your-token'
    },
    capabilities: [
      'data_retrieval',
      'workflow_execution',
      'autonomous_optimization'
    ]
  }]
});

// Agent automatically learns and optimizes
await agent.deploy();`}</code>
                </pre>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 gradient-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Ready to Build Custom Integrations?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Start your 7-day free trial and connect AgentFlow to any system or API.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-white text-primary hover:bg-blue-50">
                Start Free 7-Day Trial
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                Contact Engineering
              </Button>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default CustomIntegration;