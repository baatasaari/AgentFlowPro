import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, FileCheck, Globe, Users } from "lucide-react";

const Security = () => {
  const features = [
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "All data encrypted in transit and at rest using AES-256 encryption"
    },
    {
      icon: Users,
      title: "Role-Based Access Control",
      description: "Granular permissions system with multi-factor authentication"
    },
    {
      icon: Eye,
      title: "Audit Logging",
      description: "Comprehensive activity logs for compliance and monitoring"
    },
    {
      icon: FileCheck,
      title: "Compliance Certifications",
      description: "SOC 2 Type II, GDPR, HIPAA, and ISO 27001 compliant"
    }
  ];

  const certifications = [
    "SOC 2 Type II",
    "GDPR Compliant", 
    "HIPAA Compliant",
    "ISO 27001",
    "PCI DSS",
    "FedRAMP Ready"
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <section className="py-20 gradient-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                Enterprise-Grade Security
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Your data security is our top priority. AgentFlow is built with enterprise-grade 
                security controls and compliance certifications.
              </p>
              <Button className="btn-primary">
                View Security Documentation
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => {
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

        <section className="py-20 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Compliance Certifications
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {certifications.map((cert, index) => (
                <div key={index} className="bg-white rounded-lg p-6 text-center card-hover">
                  <Shield className="w-8 h-8 text-primary mx-auto mb-3" />
                  <div className="font-semibold text-text-primary text-sm">{cert}</div>
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

export default Security;