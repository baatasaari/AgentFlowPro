import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Pricing from "@/components/Pricing";
import { useABTest } from "@/lib/abTesting";
import CTA from "@/components/CTA";

const PricingPage = () => {
  const pricingTest = useABTest('pricing_display_test');

  const handlePricingConversion = () => {
    pricingTest.trackConversion('pricing_page_conversion');
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-text-primary mb-6">
              Choose Your Plan
            </h1>
            <p className="text-xl text-text-muted max-w-3xl mx-auto">
              Start with our free trial and scale as you grow. All plans include 
              enterprise-grade security, 24/7 support, and unlimited platform integrations.
            </p>
          </div>
        </div>
        <Pricing 
          showMonthlyDefault={pricingTest.variant?.metadata?.showMonthly ?? true}
          onConversion={handlePricingConversion}
        />
        <CTA />
      </div>
      <Footer />
    </div>
  );
};

export default PricingPage;
