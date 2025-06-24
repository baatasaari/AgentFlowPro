import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Features from "@/components/Features";
import CTA from "@/components/CTA";

const FeaturesPage = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-text-primary mb-6">
              Powerful Features for Enterprise AI
            </h1>
            <p className="text-xl text-text-muted max-w-3xl mx-auto">
              Discover how AgentFlow's comprehensive feature set empowers businesses to create, 
              deploy, and optimize intelligent conversational agents at scale.
            </p>
          </div>
        </div>
        <Features />
        <CTA />
      </div>
      <Footer />
    </div>
  );
};

export default FeaturesPage;
