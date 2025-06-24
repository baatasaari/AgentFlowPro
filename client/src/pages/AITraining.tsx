import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Database, Target, Zap, FileText, Settings, Upload, BarChart } from "lucide-react";

const AITraining = () => {
  const trainingFeatures = [
    {
      icon: Brain,
      title: "Custom Knowledge Base",
      description: "Upload your company's knowledge and train AI agents with domain-specific expertise",
      features: ["Document ingestion", "Semantic search", "Knowledge validation", "Version control"]
    },
    {
      icon: Target,
      title: "Conversation Examples",
      description: "Train with real conversation examples to ensure natural, brand-aligned responses",
      features: ["Example conversations", "Response templates", "Tone adjustment", "Context learning"]
    },
    {
      icon: Settings,
      title: "Brand Voice Configuration",
      description: "Configure personality, tone, and communication style to match your brand",
      features: ["Personality traits", "Communication style", "Response patterns", "Brand guidelines"]
    },
    {
      icon: BarChart,
      title: "Performance Analytics",
      description: "Monitor training progress and optimize agent performance with detailed metrics",
      features: ["Training metrics", "Response quality", "User satisfaction", "Improvement suggestions"]
    }
  ];

  const trainingProcess = [
    {
      step: "01",
      title: "Data Upload",
      description: "Upload your knowledge base, FAQs, and conversation examples",
      icon: Upload
    },
    {
      step: "02", 
      title: "AI Processing",
      description: "Our AI analyzes and processes your data for optimal learning",
      icon: Brain
    },
    {
      step: "03",
      title: "Training Validation",
      description: "Test and validate agent responses with your training data",
      icon: Target
    },
    {
      step: "04",
      title: "Deployment",
      description: "Deploy your trained agent across all connected platforms",
      icon: Zap
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
                Custom AI Training
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Train your AI agents with your business knowledge, brand voice, and industry expertise. 
                Create agents that truly understand your customers and represent your brand perfectly.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="btn-primary">
                  Start Training
                </Button>
                <Button variant="outline" className="btn-secondary">
                  View Training Examples
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Training Features */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Advanced Training Capabilities
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Powerful tools to create agents that understand your business and speak your language
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {trainingFeatures.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <Card key={index} className="card-hover">
                    <CardHeader>
                      <div className="feature-icon mb-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-text-muted mb-4">{feature.description}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {feature.features.map((item, itemIndex) => (
                          <div key={itemIndex} className="flex items-center text-sm text-text-muted">
                            <div className="w-2 h-2 bg-accent rounded-full mr-2"></div>
                            {item}
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

        {/* Training Process */}
        <section className="py-20 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Simple Training Process
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Get your AI agent trained and deployed in just four simple steps
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {trainingProcess.map((process, index) => {
                const IconComponent = process.icon;
                return (
                  <div key={index} className="text-center">
                    <div className="relative mb-6">
                      <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{process.step}</span>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-text-primary mb-2">{process.title}</h3>
                    <p className="text-text-muted">{process.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Knowledge Base Integration */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-6">
                  Intelligent Knowledge Management
                </h2>
                <p className="text-xl text-text-muted mb-8">
                  Upload documents, websites, and data sources. Our AI automatically processes 
                  and organizes your knowledge for optimal agent training.
                </p>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <FileText className="w-6 h-6 text-primary mt-1" />
                    <div>
                      <h4 className="font-semibold mb-2">Document Processing</h4>
                      <p className="text-text-muted">PDF, Word, Excel, and web content automatically processed and indexed</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <Database className="w-6 h-6 text-primary mt-1" />
                    <div>
                      <h4 className="font-semibold mb-2">Semantic Search</h4>
                      <p className="text-text-muted">AI-powered search finds relevant information based on context and meaning</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <Settings className="w-6 h-6 text-primary mt-1" />
                    <div>
                      <h4 className="font-semibold mb-2">Version Control</h4>
                      <p className="text-text-muted">Track changes and manage different versions of your knowledge base</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=600" 
                  alt="AI knowledge processing and data organization" 
                  className="rounded-2xl shadow-xl w-full h-auto" 
                />
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 gradient-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Start Training Your AI Agent Today
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Upload your knowledge base and create an intelligent agent that understands 
              your business inside and out.
            </p>
            <Button className="bg-white text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors duration-200">
              Begin Training Process
            </Button>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default AITraining;