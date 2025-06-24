import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import TrustIndicators from "@/components/TrustIndicators";
import Features from "@/components/Features";
import Integrations from "@/components/Integrations";
import InteractiveDemo from "@/components/InteractiveDemo";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Resources from "@/components/Resources";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Home = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <TrustIndicators />
      <Features />
      <Integrations />
      <InteractiveDemo />
      <Pricing />
      <Testimonials />
      <Resources />
      <CTA />
      <Footer />
    </div>
  );
};

export default Home;
