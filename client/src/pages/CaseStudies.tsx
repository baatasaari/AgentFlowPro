import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Clock, DollarSign, Users } from "lucide-react";

const CaseStudies = () => {
  const studies = [
    {
      company: "RetailCorp",
      industry: "E-commerce",
      challenge: "High cart abandonment and poor customer support response times",
      solution: "AI agents for product recommendations and instant customer support",
      results: [
        { metric: "Sales Increase", value: "45%", icon: TrendingUp },
        { metric: "Response Time", value: "75% faster", icon: Clock },
        { metric: "Cost Savings", value: "$2.3M annually", icon: DollarSign },
        { metric: "Customer Satisfaction", value: "92%", icon: Users }
      ],
      image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
    },
    {
      company: "HealthSystem",
      industry: "Healthcare",
      challenge: "Overwhelming patient inquiries and appointment scheduling bottlenecks",
      solution: "HIPAA-compliant AI agents for appointment booking and patient support",
      results: [
        { metric: "Wait Time Reduction", value: "60%", icon: Clock },
        { metric: "Booking Efficiency", value: "85% automated", icon: TrendingUp },
        { metric: "Staff Cost Savings", value: "$1.8M annually", icon: DollarSign },
        { metric: "Patient Satisfaction", value: "96%", icon: Users }
      ],
      image: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
    }
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <section className="py-20 gradient-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                Customer Success Stories
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Real results from businesses that transformed their customer experience 
                with AgentFlow's intelligent conversational agents.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-20">
              {studies.map((study, index) => (
                <div key={index} className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                    <img 
                      src={study.image} 
                      alt={`${study.company} case study`}
                      className="rounded-2xl shadow-xl w-full h-auto"
                    />
                  </div>
                  <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                    <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
                      {study.industry}
                    </div>
                    <h2 className="text-3xl font-bold text-text-primary mb-4">{study.company}</h2>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary mb-2">Challenge</h3>
                        <p className="text-text-muted">{study.challenge}</p>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary mb-2">Solution</h3>
                        <p className="text-text-muted">{study.solution}</p>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary mb-4">Results</h3>
                        <div className="grid grid-cols-2 gap-4">
                          {study.results.map((result, resultIndex) => {
                            const IconComponent = result.icon;
                            return (
                              <div key={resultIndex} className="text-center">
                                <div className="feature-icon mx-auto mb-2">
                                  <IconComponent className="w-5 h-5" />
                                </div>
                                <div className="text-2xl font-bold text-primary">{result.value}</div>
                                <div className="text-sm text-text-muted">{result.metric}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default CaseStudies;