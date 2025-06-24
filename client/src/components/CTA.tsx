import { Button } from "@/components/ui/button";
import { Rocket, Calendar } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-20 gradient-primary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold mb-6">
          Ready to Transform Your Customer Conversations?
        </h2>
        <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
          Join 500+ businesses that trust AgentFlow to deliver exceptional customer experiences 
          through intelligent conversational AI.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button className="bg-white text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors duration-200 flex items-center justify-center">
            <Rocket className="w-5 h-5 mr-2" />
            Start 14-Day Free Trial
          </Button>
          <Button 
            variant="outline" 
            className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors duration-200 flex items-center justify-center"
          >
            <Calendar className="w-5 h-5 mr-2" />
            Schedule Demo
          </Button>
        </div>
        <div className="mt-6 text-blue-100">
          <span>✓ No credit card required</span>
          <span className="mx-4">•</span>
          <span>✓ Setup in under 10 minutes</span>
          <span className="mx-4">•</span>
          <span>✓ Cancel anytime</span>
        </div>
      </div>
    </section>
  );
};

export default CTA;
