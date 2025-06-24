import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Resources from "@/components/Resources";
import CTA from "@/components/CTA";

const ResourcesPage = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-text-primary mb-6">
              Learn & Grow with AgentFlow
            </h1>
            <p className="text-xl text-text-muted max-w-3xl mx-auto">
              Access our comprehensive library of guides, case studies, and resources 
              to maximize your success with conversational AI.
            </p>
          </div>
        </div>
        <Resources />
        <CTA />
      </div>
      <Footer />
    </div>
  );
};

export default ResourcesPage;
