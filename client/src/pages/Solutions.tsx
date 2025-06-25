import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Heart, DollarSign, Home, Headphones, ArrowRight } from "lucide-react";

const Solutions = () => {
  const industries = [
    {
      icon: ShoppingCart,
      title: "E-commerce & Retail",
      description: "Boost sales with AI agents that provide product recommendations and order support",
      benefits: ["Product discovery", "Order tracking", "Return processing", "Inventory updates"],
      caseStudy: "RetailCorp increased sales by 45% with AgentFlow",
      href: "/solutions/ecommerce"
    },
    {
      icon: Heart,
      title: "Healthcare",
      description: "Streamline patient interactions with HIPAA-compliant AI assistants",
      benefits: ["Appointment scheduling", "Symptom assessment", "Insurance verification", "Patient support"],
      caseStudy: "HealthSystem reduced wait times by 60%",
      href: "/solutions/healthcare"
    },
    {
      icon: DollarSign,
      title: "Financial Services",
      description: "Secure financial AI agents for banking, insurance, and investment services",
      benefits: ["Account inquiries", "Transaction support", "Loan applications", "Investment guidance"],
      caseStudy: "FinBank improved customer satisfaction by 70%",
      href: "/solutions/finance"
    },
    {
      icon: Home,
      title: "Real Estate",
      description: "AI agents that qualify leads and schedule property viewings 24/7",
      benefits: ["Lead qualification", "Property search", "Viewing scheduling", "Market insights"],
      caseStudy: "RealtyPro increased lead conversion by 55%",
      href: "/solutions/realestate"
    },
    {
      icon: Headphones,
      title: "Customer Support",
      description: "Intelligent support agents that resolve issues faster than human agents",
      benefits: ["Issue resolution", "Ticket routing", "Knowledge base", "Escalation management"],
      caseStudy: "TechSupport reduced resolution time by 75%",
      href: "/solutions/support"
    }
  ];

  const commonUseCases = [
    {
      title: "Lead Qualification",
      description: "Automatically qualify prospects and route high-value leads to sales teams",
      metrics: "3x faster qualification"
    },
    {
      title: "Customer Onboarding", 
      description: "Guide new customers through setup processes with personalized assistance",
      metrics: "90% completion rate"
    },
    {
      title: "Order Management",
      description: "Handle order inquiries, modifications, and tracking across all channels",
      metrics: "24/7 availability"
    },
    {
      title: "Appointment Booking",
      description: "Schedule appointments, send reminders, and manage calendar integrations",
      metrics: "Zero double-bookings"
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
                Industry-Specific Agentic Solutions
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Autonomous AI agents designed for your industry's complex workflows and decision-making requirements. 
                From autonomous healthcare diagnostics to intelligent e-commerce operations, our agents deliver strategic results.
              </p>
              <Button className="btn-primary">
                Explore Solutions
              </Button>
            </div>
          </div>
        </section>

        {/* Industry Solutions */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Autonomous Agents Transforming Industries
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Each agentic solution operates independently with industry-specific reasoning and autonomous compliance management
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {industries.slice(0, 3).map((industry, index) => {
                const IconComponent = industry.icon;
                return (
                  <Card key={index} className="card-hover h-full">
                    <CardHeader>
                      <div className="feature-icon mb-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl">{industry.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-text-muted mb-4">{industry.description}</p>
                      <ul className="space-y-2 mb-6">
                        {industry.benefits.map((benefit, benefitIndex) => (
                          <li key={benefitIndex} className="flex items-center text-sm text-text-muted">
                            <ArrowRight className="w-4 h-4 text-accent mr-2" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                      <div className="bg-secondary rounded-lg p-3 mb-4">
                        <p className="text-sm text-primary font-medium">{industry.caseStudy}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => window.location.href = industry.href}
                      >
                        Learn More
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              {industries.slice(3).map((industry, index) => {
                const IconComponent = industry.icon;
                return (
                  <Card key={index + 3} className="card-hover h-full">
                    <CardHeader>
                      <div className="feature-icon mb-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl">{industry.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-text-muted mb-4">{industry.description}</p>
                      <ul className="space-y-2 mb-6">
                        {industry.benefits.map((benefit, benefitIndex) => (
                          <li key={benefitIndex} className="flex items-center text-sm text-text-muted">
                            <ArrowRight className="w-4 h-4 text-accent mr-2" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                      <div className="bg-secondary rounded-lg p-3 mb-4">
                        <p className="text-sm text-primary font-medium">{industry.caseStudy}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => window.location.href = industry.href}
                      >
                        Learn More
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Common Use Cases */}
        <section className="py-20 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Common Use Cases Across Industries
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Versatile AI agents that can be customized for any business need
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {commonUseCases.map((useCase, index) => (
                <div key={index} className="bg-white rounded-xl p-8 card-hover">
                  <h3 className="text-xl font-semibold text-text-primary mb-3">{useCase.title}</h3>
                  <p className="text-text-muted mb-4">{useCase.description}</p>
                  <div className="inline-block bg-accent/10 text-accent px-3 py-1 rounded-full text-sm font-medium">
                    {useCase.metrics}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Success Metrics */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Proven Results Across All Industries
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-primary mb-2">75%</div>
                <div className="text-text-muted">Faster Response Times</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">60%</div>
                <div className="text-text-muted">Cost Reduction</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">90%</div>
                <div className="text-text-muted">Customer Satisfaction</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">24/7</div>
                <div className="text-text-muted">Availability</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 gradient-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Find Your Industry Solution
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Don't see your industry? We create custom solutions for any business vertical. 
              Let's discuss your specific needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-white text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors duration-200">
                Schedule Consultation
              </Button>
              <Button 
                variant="outline" 
                className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors duration-200"
              >
                Request Custom Demo
              </Button>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Solutions;