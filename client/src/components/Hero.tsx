import { Button } from "@/components/ui/button";
import { Rocket, Play, CheckCircle } from "lucide-react";

const Hero = () => {
  return (
    <section className="pt-20 pb-16 gradient-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="max-w-xl">
            <h1 className="text-4xl lg:text-5xl font-bold text-text-primary leading-tight mb-6">
              Deploy Autonomous AI Agents That{" "}
              <span className="text-primary">Think, Decide & Act</span>
            </h1>
            <p className="text-xl text-text-muted mb-8 leading-relaxed">
              Revolutionary agentic AI that goes beyond conversations. Our autonomous agents analyze situations, 
              make intelligent decisions, execute complex workflows, and drive business outcomes—all without human intervention.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button className="btn-primary flex items-center justify-center">
                <Rocket className="w-4 h-4 mr-2" />
                Start Free 14-Day Trial
              </Button>
              <Button variant="outline" className="btn-secondary flex items-center justify-center">
                <Play className="w-4 h-4 mr-2" />
                Watch Demo
              </Button>
            </div>
            <div className="flex items-center text-sm text-text-muted">
              <CheckCircle className="w-4 h-4 text-accent mr-2" />
              <span>No credit card required • Setup in minutes • Enterprise-grade security</span>
            </div>
          </div>
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=600" 
              alt="Modern office with AI technology setup" 
              className="rounded-2xl shadow-2xl w-full h-auto" 
            />
            <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Autonomous Agent Executing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
