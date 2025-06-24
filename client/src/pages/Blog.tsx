import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, ArrowRight } from "lucide-react";

const Blog = () => {
  const posts = [
    {
      title: "The Future of Customer Service: AI Agents That Actually Understand",
      excerpt: "Exploring how next-generation AI agents are revolutionizing customer interactions through deeper understanding and context awareness.",
      author: "Sarah Chen",
      date: "June 20, 2025",
      category: "AI Insights",
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
    },
    {
      title: "Building Trust in AI: Enterprise Security Best Practices",
      excerpt: "A comprehensive guide to implementing secure AI systems that protect customer data while delivering exceptional experiences.",
      author: "Michael Rodriguez",
      date: "June 18, 2025", 
      category: "Security",
      image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
    },
    {
      title: "ROI of Conversational AI: Case Studies from 500+ Deployments",
      excerpt: "Real-world data showing how businesses achieve 3x ROI through intelligent automation of customer conversations.",
      author: "Emma Thompson",
      date: "June 15, 2025",
      category: "Business Impact",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
    }
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <section className="py-20 gradient-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                AgentFlow Blog
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                Insights, best practices, and the latest developments in conversational AI 
                from our team of experts and industry leaders.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {posts.map((post, index) => (
                <Card key={index} className="card-hover overflow-hidden">
                  <div className="relative">
                    <img 
                      src={post.image} 
                      alt={post.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-xl leading-tight">{post.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-text-muted mb-4">{post.excerpt}</p>
                    <div className="flex items-center justify-between text-sm text-text-muted mb-4">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-1" />
                        {post.author}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {post.date}
                      </div>
                    </div>
                    <Button variant="ghost" className="p-0 h-auto text-primary hover:text-blue-700">
                      Read More <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Blog;