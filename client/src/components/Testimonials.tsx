import { Star } from "lucide-react";
import { TESTIMONIALS } from "@/lib/constants";

const Testimonials = () => {
  const stats = [
    { value: "500+", label: "Enterprise Customers" },
    { value: "75%", label: "Faster Response Time" },
    { value: "10M+", label: "Conversations Handled" },
    { value: "99.9%", label: "Uptime Guarantee" },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
            Trusted by Leading Companies
          </h2>
          <p className="text-xl text-text-muted max-w-3xl mx-auto">
            See how businesses across industries are transforming their customer experience with AgentFlow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {TESTIMONIALS.map((testimonial, index) => (
            <div key={index} className="bg-secondary rounded-2xl p-8">
              <div className="flex items-center mb-6">
                <img 
                  src={testimonial.avatar} 
                  alt={`${testimonial.name} - ${testimonial.role}`} 
                  className="w-12 h-12 rounded-full mr-4" 
                />
                <div>
                  <h4 className="font-semibold text-text-primary">{testimonial.name}</h4>
                  <p className="text-text-muted text-sm">{testimonial.role}, {testimonial.company}</p>
                </div>
              </div>
              <p className="text-text-primary mb-4">"{testimonial.content}"</p>
              <div className="flex text-warning">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-16 gradient-primary rounded-2xl p-8 text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-3xl font-bold mb-2">{stat.value}</div>
                <div className="text-blue-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
