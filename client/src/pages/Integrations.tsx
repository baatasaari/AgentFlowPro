import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Integrations from "@/components/Integrations";
import CTA from "@/components/CTA";

const IntegrationsPage = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-text-primary mb-6">
              Connect with Every Platform
            </h1>
            <p className="text-xl text-text-muted max-w-3xl mx-auto">
              Seamlessly integrate AgentFlow with your existing tools and deploy across 
              all major messaging platforms to reach customers wherever they are.
            </p>
          </div>
        </div>
        <Integrations />
        <CTA />
      </div>
      <Footer />
    </div>
  );
};

export default IntegrationsPage;
