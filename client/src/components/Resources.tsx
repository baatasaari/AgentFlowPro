import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import { RESOURCES } from "@/lib/constants";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const Resources = () => {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const newsletterMutation = useMutation({
    mutationFn: (data: { email: string }) => 
      apiRequest("POST", "/api/newsletter", data),
    onSuccess: () => {
      toast({
        title: "Subscribed successfully!",
        description: "Thank you for subscribing to our newsletter.",
      });
      setEmail("");
    },
    onError: () => {
      toast({
        title: "Subscription failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      newsletterMutation.mutate({ email });
    }
  };

  return (
    <section className="py-20 bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
            Resources to Get You Started
          </h2>
          <p className="text-xl text-text-muted max-w-3xl mx-auto">
            Learn best practices, implementation guides, and industry insights to maximize your AI agent success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {RESOURCES.map((resource, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm card-hover overflow-hidden">
              <img 
                src={resource.image} 
                alt={resource.title} 
                className="w-full h-48 object-cover" 
              />
              <div className="p-6">
                <div className="text-sm text-primary font-semibold mb-2">{resource.type}</div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">
                  {resource.title}
                </h3>
                <p className="text-text-muted mb-4">{resource.description}</p>
                <a 
                  href={resource.link} 
                  className="text-primary font-semibold hover:text-blue-700 flex items-center"
                >
                  {resource.type === "WEBINAR" ? "Register Now" : "Read More"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Newsletter Signup */}
        <div className="mt-16 bg-white rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-text-primary mb-4">Stay Updated with AI Trends</h3>
          <p className="text-text-muted mb-6">Get weekly insights on conversational AI, best practices, and industry news.</p>
          <form onSubmit={handleNewsletterSubmit} className="max-w-md mx-auto flex gap-4">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1"
            />
            <Button 
              type="submit" 
              className="btn-primary"
              disabled={newsletterMutation.isPending}
            >
              {newsletterMutation.isPending ? "Subscribing..." : "Subscribe"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Resources;
