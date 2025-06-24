import { Button } from "@/components/ui/button";
import { ShoppingCart, CalendarCheck } from "lucide-react";

const InteractiveDemo = () => {
  return (
    <section className="py-20 gradient-primary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            See AgentFlow in Action
          </h2>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Experience how our AI agents handle real customer conversations across different scenarios and platforms.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 hover:bg-white/15 transition-colors duration-300">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">E-Commerce Support</h3>
                <p className="text-blue-100">Product recommendations & order assistance</p>
              </div>
            </div>
            <Button className="bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors duration-200">
              Try Demo
            </Button>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 hover:bg-white/15 transition-colors duration-300">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <CalendarCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Appointment Booking</h3>
                <p className="text-blue-100">Schedule meetings & manage calendars</p>
              </div>
            </div>
            <Button className="bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors duration-200">
              Try Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InteractiveDemo;
