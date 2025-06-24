import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, TrendingUp, Users, MessageSquare, Target, Clock } from "lucide-react";

const Analytics = () => {
  const metrics = [
    {
      icon: MessageSquare,
      title: "Conversation Analytics",
      description: "Track message volume, response times, and user engagement patterns",
      value: "10M+",
      label: "Messages Analyzed"
    },
    {
      icon: TrendingUp,
      title: "Performance Metrics",
      description: "Monitor agent performance with detailed accuracy and satisfaction scores",
      value: "94%",
      label: "Accuracy Rate"
    },
    {
      icon: Target,
      title: "Conversion Tracking",
      description: "Measure how conversations drive business outcomes and revenue",
      value: "3.2x",
      label: "Conversion Lift"
    },
    {
      icon: Clock,
      title: "Real-time Monitoring",
      description: "Live dashboards showing current agent status and performance",
      value: "<200ms",
      label: "Response Time"
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
                Advanced Analytics
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Comprehensive insights into your AI agent performance with real-time monitoring 
                and detailed reporting capabilities.
              </p>
              <Button className="btn-primary">
                View Demo Dashboard
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {metrics.map((metric, index) => {
                const IconComponent = metric.icon;
                return (
                  <Card key={index} className="text-center card-hover">
                    <CardHeader>
                      <div className="feature-icon mx-auto mb-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-lg">{metric.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-primary mb-2">{metric.value}</div>
                      <div className="text-sm text-text-muted mb-3">{metric.label}</div>
                      <p className="text-text-muted text-sm">{metric.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Analytics;