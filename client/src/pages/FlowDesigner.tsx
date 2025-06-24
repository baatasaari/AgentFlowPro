import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Zap, Settings, Play, Code, MousePointer, Puzzle, BarChart } from "lucide-react";

const FlowDesigner = () => {
  const features = [
    {
      icon: MousePointer,
      title: "Drag & Drop Interface",
      description: "Intuitive visual builder for creating conversation flows without coding"
    },
    {
      icon: GitBranch,
      title: "Conditional Logic",
      description: "Create smart branching paths based on user responses and data"
    },
    {
      icon: Puzzle,
      title: "Pre-built Templates",
      description: "Start with proven templates for common use cases and industries"
    },
    {
      icon: BarChart,
      title: "A/B Testing",
      description: "Test different conversation paths to optimize performance"
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
                Visual Flow Designer
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Create sophisticated conversation flows with our intuitive drag-and-drop interface. 
                No coding required - build complex logic visually.
              </p>
              <Button className="btn-primary">
                Try Flow Designer
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
      </div>
      <Footer />
    </div>
  );
};

export default FlowDesigner;