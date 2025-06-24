import { Brain, Network, TrendingUp, GitBranch, Database, Shield, CheckCircle } from "lucide-react";
import { FEATURES } from "@/lib/constants";

const iconMap = {
  Brain,
  Network,
  TrendingUp,
  GitBranch,
  Database,
  Shield,
};

const Features = () => {
  return (
    <section className="py-20 bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
            Everything You Need to Scale Customer Conversations
          </h2>
          <p className="text-xl text-text-muted max-w-3xl mx-auto">
            From AI training to multi-platform deployment, AgentFlow provides enterprise-grade tools 
            to create, manage, and optimize intelligent conversational agents.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, index) => {
            const IconComponent = iconMap[feature.icon as keyof typeof iconMap];
            
            return (
              <div key={index} className="bg-white rounded-xl p-8 shadow-sm card-hover">
                <div className="feature-icon mb-6">
                  <IconComponent className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-4">{feature.title}</h3>
                <p className="text-text-muted mb-4">{feature.description}</p>
                <ul className="space-y-2 text-sm text-text-muted">
                  {feature.benefits.map((benefit, benefitIndex) => (
                    <li key={benefitIndex} className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-accent mr-2" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
