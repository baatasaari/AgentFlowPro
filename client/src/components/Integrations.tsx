import { MessageCircle, Send, Hash, MessageSquare, Instagram, Cloud, BarChart3, Headphones, FileSpreadsheet, ShoppingBag, Plus } from "lucide-react";
import { INTEGRATIONS } from "@/lib/constants";

const iconMap = {
  MessageCircle,
  Send,
  Hash,
  MessageSquare,
  Instagram,
  Cloud,
  BarChart3,
  Headphones,
  FileSpreadsheet,
  ShoppingBag,
  Plus,
};

const Integrations = () => {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
            Deploy Everywhere Your Customers Are
          </h2>
          <p className="text-xl text-text-muted max-w-3xl mx-auto">
            One platform, multiple touchpoints. Reach customers across all major messaging platforms 
            with consistent, intelligent conversations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <img 
              src="https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=600" 
              alt="Business professionals using AI chatbots on multiple devices" 
              className="rounded-2xl shadow-xl w-full h-auto" 
            />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-text-primary mb-6">Seamless Multi-Platform Experience</h3>
            <p className="text-text-muted mb-8">
              Your customers communicate across different platforms. AgentFlow ensures they receive 
              consistent, intelligent responses whether they're on WhatsApp, Telegram, or any other channel.
            </p>
            
            <div className="grid grid-cols-2 gap-6">
              {INTEGRATIONS.slice(0, 4).map((integration, index) => {
                const IconComponent = iconMap[integration.icon as keyof typeof iconMap];
                
                return (
                  <div key={index} className="flex items-center space-x-3">
                    <IconComponent className={`w-8 h-8 ${integration.color}`} />
                    <div>
                      <h4 className="font-semibold">{integration.name}</h4>
                      <p className="text-sm text-text-muted">
                        {integration.name === "WhatsApp Business" && "Interactive buttons & media"}
                        {integration.name === "Telegram" && "Inline keyboards & bots"}
                        {integration.name === "Discord" && "Rich embeds & servers"}
                        {integration.name === "Messenger" && "Quick replies & templates"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Integration Partners */}
        <div className="bg-secondary rounded-2xl p-8">
          <h3 className="text-xl font-bold text-text-primary text-center mb-8">Integrate with Your Existing Stack</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center">
            {INTEGRATIONS.slice(5).map((integration, index) => {
              const IconComponent = iconMap[integration.icon as keyof typeof iconMap];
              
              return (
                <div key={index} className="flex flex-col items-center space-y-2">
                  <IconComponent className={`w-8 h-8 ${integration.color}`} />
                  <span className="text-sm text-text-muted">{integration.name}</span>
                </div>
              );
            })}
            <div className="flex flex-col items-center space-y-2">
              <Plus className="w-8 h-8 text-text-muted" />
              <span className="text-sm text-text-muted">50+ More</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Integrations;
