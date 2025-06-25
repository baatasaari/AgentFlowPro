import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Shield, Lock, Headphones } from "lucide-react";
import { PRICING_PLANS } from "@/lib/constants";
import { useState } from "react";

interface PricingProps {
  showMonthlyDefault?: boolean;
  onConversion?: () => void;
}

const Pricing = ({ showMonthlyDefault = true, onConversion }: PricingProps) => {
  const [isMonthly, setIsMonthly] = useState(showMonthlyDefault);

  const handlePlanSelect = (planName: string) => {
    onConversion?.();
    // Track specific plan selection
    console.log(`Plan selected: ${planName}, Billing: ${isMonthly ? 'Monthly' : 'Annual'}`);
  };
  return (
    <section className="py-20 bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-text-muted max-w-3xl mx-auto mb-8">
            Choose the plan that fits your business needs. All plans include core features with scalable add-ons.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-8">
            <span className={`mr-3 ${isMonthly ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsMonthly(!isMonthly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                isMonthly ? 'bg-gray-300' : 'bg-primary'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isMonthly ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </button>
            <span className={`ml-3 ${!isMonthly ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
              Annual
            </span>
            {!isMonthly && (
              <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                Save 20%
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PRICING_PLANS.map((plan, index) => (
            <Card key={index} className={`card-hover ${plan.popular ? 'border-2 border-primary relative' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">Most Popular</span>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold text-text-primary mb-2">{plan.name}</CardTitle>
                <p className="text-text-muted mb-4">{plan.description}</p>
                <div className="text-4xl font-bold text-text-primary mb-2">
                  {plan.price ? (
                    <>
                      ${isMonthly ? plan.price : Math.round(plan.price * 12 * 0.8 / 12)}
                      <span className="text-lg text-text-muted">/month</span>
                    </>
                  ) : (
                    "Custom"
                  )}
                </div>
                {!isMonthly && plan.price && (
                  <p className="text-sm text-green-600 mb-2">
                    ${Math.round(plan.price * 12 * 0.8)} billed annually
                  </p>
                )}
                <p className="text-sm text-text-muted">
                  {plan.price ? `Up to ${plan.price === 99 ? '1,000' : '10,000'} conversations/month` : 'Unlimited conversations'}
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-accent mr-3" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full ${plan.popular ? 'btn-primary' : 'bg-gray-100 hover:bg-gray-200 text-text-primary'}`}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-text-muted mb-4">All plans include a 14-day free trial. No setup fees. Cancel anytime.</p>
          <div className="flex justify-center items-center space-x-8 text-sm text-text-muted">
            <div className="flex items-center">
              <Shield className="w-4 h-4 text-accent mr-2" />
              SOC 2 Compliant
            </div>
            <div className="flex items-center">
              <Lock className="w-4 h-4 text-accent mr-2" />
              Enterprise Security
            </div>
            <div className="flex items-center">
              <Headphones className="w-4 h-4 text-accent mr-2" />
              24/7 Support
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
