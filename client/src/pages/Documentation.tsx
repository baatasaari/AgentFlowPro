import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Book, Search, Code, Rocket, Zap, Settings, FileText, Video } from "lucide-react";

const Documentation = () => {
  const docSections = [
    {
      icon: Rocket,
      title: "Getting Started",
      description: "Quick setup guide to get your first AI agent running in minutes",
      links: [
        "Installation & Setup",
        "Creating Your First Agent", 
        "Basic Configuration",
        "Testing & Deployment"
      ]
    },
    {
      icon: Code,
      title: "API Reference",
      description: "Complete API documentation with examples and code samples",
      links: [
        "Authentication",
        "Agent Management",
        "Conversation APIs",
        "Webhook Integration"
      ]
    },
    {
      icon: Settings,
      title: "Configuration",
      description: "Detailed guides for configuring agents, platforms, and integrations",
      links: [
        "Platform Setup",
        "AI Model Configuration",
        "Custom Training",
        "Security Settings"
      ]
    },
    {
      icon: Zap,
      title: "Advanced Features",
      description: "Deep dives into advanced capabilities and customization options",
      links: [
        "Flow Designer",
        "Custom Integrations",
        "Analytics & Reporting",
        "Multi-tenant Setup"
      ]
    }
  ];

  const quickLinks = [
    { title: "5-Minute Quickstart", icon: Rocket, type: "Guide" },
    { title: "API Authentication", icon: Code, type: "Reference" },
    { title: "WhatsApp Integration", icon: FileText, type: "Tutorial" },
    { title: "Training Your Agent", icon: Video, type: "Video" },
    { title: "Troubleshooting", icon: Settings, type: "Guide" },
    { title: "Best Practices", icon: Book, type: "Guide" }
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
                Documentation
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Everything you need to build, deploy, and scale intelligent conversational agents. 
                From quick starts to advanced customization guides.
              </p>
              
              {/* Search Bar */}
              <div className="max-w-2xl mx-auto relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search documentation..."
                  className="pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-primary"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Popular Resources
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Jump straight to the most commonly used guides and references
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quickLinks.map((link, index) => {
                const IconComponent = link.icon;
                return (
                  <Card key={index} className="card-hover cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-4">
                        <div className="feature-icon">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-text-primary">{link.title}</h3>
                          <p className="text-sm text-text-muted">{link.type}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Documentation Sections */}
        <section className="py-20 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Complete Documentation
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Comprehensive guides organized by topic and skill level
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {docSections.map((section, index) => {
                const IconComponent = section.icon;
                return (
                  <Card key={index} className="card-hover h-full">
                    <CardHeader>
                      <div className="feature-icon mb-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-text-muted mb-6">{section.description}</p>
                      <ul className="space-y-3">
                        {section.links.map((link, linkIndex) => (
                          <li key={linkIndex}>
                            <a 
                              href="#" 
                              className="text-primary hover:text-blue-700 font-medium flex items-center group"
                            >
                              {link}
                              <svg 
                                className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </a>
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

        {/* Code Example */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-6">
                  Developer-Friendly APIs
                </h2>
                <p className="text-xl text-text-muted mb-8">
                  Clean, well-documented APIs with comprehensive examples in multiple programming languages. 
                  Get up and running quickly with our SDKs and detailed guides.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Code className="w-6 h-6 text-primary mr-3" />
                    <span className="text-text-muted">RESTful APIs with JSON responses</span>
                  </div>
                  <div className="flex items-center">
                    <Book className="w-6 h-6 text-primary mr-3" />
                    <span className="text-text-muted">SDKs for Python, Node.js, and more</span>
                  </div>
                  <div className="flex items-center">
                    <FileText className="w-6 h-6 text-primary mr-3" />
                    <span className="text-text-muted">Interactive API explorer</span>
                  </div>
                </div>
                <div className="mt-8">
                  <Button className="btn-primary mr-4">
                    View API Docs
                  </Button>
                  <Button variant="outline" className="btn-secondary">
                    Try API Explorer
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="bg-gray-900 rounded-xl p-6 text-white font-mono text-sm">
                  <div className="text-gray-400 mb-4">// Create a new AI agent</div>
                  <div className="text-blue-400">const</div>
                  <span className="text-white"> agent = </span>
                  <div className="text-green-400">await</div>
                  <span className="text-white"> agentflow.</span>
                  <span className="text-yellow-400">createAgent</span>
                  <span className="text-white">({`{`}</span>
                  <div className="ml-4 text-white">
                    <div>name: <span className="text-green-300">"Customer Support"</span>,</div>
                    <div>model: <span className="text-green-300">"gpt-4"</span>,</div>
                    <div>platforms: [<span className="text-green-300">"whatsapp"</span>, <span className="text-green-300">"telegram"</span>],</div>
                    <div>systemPrompt: <span className="text-green-300">"You are a helpful..."</span></div>
                  </div>
                  <span className="text-white">{`});`}</span>
                  <div className="mt-4 text-gray-400">// Agent deployed across platforms!</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Community & Support */}
        <section className="py-20 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Need Help?
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Our community and support team are here to help you succeed
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center card-hover">
                <CardContent className="p-8">
                  <div className="feature-icon mx-auto mb-4">
                    <Book className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">Community Forum</h3>
                  <p className="text-text-muted mb-6">Join discussions, ask questions, and share solutions with other developers</p>
                  <Button variant="outline" className="w-full">Visit Forum</Button>
                </CardContent>
              </Card>

              <Card className="text-center card-hover">
                <CardContent className="p-8">
                  <div className="feature-icon mx-auto mb-4">
                    <Video className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">Video Tutorials</h3>
                  <p className="text-text-muted mb-6">Step-by-step video guides for common tasks and advanced features</p>
                  <Button variant="outline" className="w-full">Watch Videos</Button>
                </CardContent>
              </Card>

              <Card className="text-center card-hover">
                <CardContent className="p-8">
                  <div className="feature-icon mx-auto mb-4">
                    <Settings className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">Support Center</h3>
                  <p className="text-text-muted mb-6">Get direct help from our technical support team</p>
                  <Button variant="outline" className="w-full">Contact Support</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Documentation;