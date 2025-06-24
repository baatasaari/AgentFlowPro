import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, Award, Globe, Rocket, Heart } from "lucide-react";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Customer-First",
      description: "Every decision we make is guided by what's best for our customers and their success"
    },
    {
      icon: Rocket,
      title: "Innovation",
      description: "We push the boundaries of AI technology to create solutions that didn't exist before"
    },
    {
      icon: Heart,
      title: "Empathy",
      description: "We build technology that understands and responds to human emotions and needs"
    },
    {
      icon: Globe,
      title: "Global Impact",
      description: "Our mission is to democratize AI and make it accessible to businesses worldwide"
    }
  ];

  const team = [
    {
      name: "Sarah Chen",
      role: "CEO & Co-Founder",
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=300&h=300",
      bio: "Former OpenAI researcher with 10+ years in conversational AI"
    },
    {
      name: "Michael Rodriguez",
      role: "CTO & Co-Founder", 
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=300&h=300",
      bio: "Ex-Google engineer specializing in scalable AI infrastructure"
    },
    {
      name: "Emma Thompson",
      role: "VP of Product",
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=300&h=300",
      bio: "Product leader with deep expertise in enterprise software"
    },
    {
      name: "David Kim",
      role: "Head of AI Research",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=300&h=300",
      bio: "PhD in Machine Learning, published researcher in NLP"
    }
  ];

  const milestones = [
    { year: "2021", event: "AgentFlow founded by AI researchers" },
    { year: "2022", event: "First enterprise customer deployment" },
    { year: "2023", event: "Series A funding, 100+ customers" },
    { year: "2024", event: "10M+ conversations processed monthly" },
    { year: "2025", event: "Global expansion, 500+ enterprise customers" }
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        {/* Hero Section */}
        <section className="py-20 gradient-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl lg:text-6xl font-bold text-text-primary mb-6">
                Democratizing AI for Business
              </h1>
              <p className="text-xl text-text-muted max-w-4xl mx-auto mb-8">
                We're on a mission to make intelligent conversational AI accessible to every business, 
                regardless of size or technical expertise. Founded by AI researchers and enterprise veterans.
              </p>
              <Button className="btn-primary">
                Join Our Mission
              </Button>
            </div>
          </div>
        </section>

        {/* Our Story */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-6">
                  Our Story
                </h2>
                <p className="text-xl text-text-muted mb-8">
                  AgentFlow was born from a simple observation: while AI technology advanced rapidly, 
                  most businesses couldn't access or implement sophisticated conversational AI due to 
                  complexity and cost barriers.
                </p>
                <p className="text-lg text-text-muted mb-8">
                  Our founders, with backgrounds from OpenAI, Google, and enterprise software companies, 
                  set out to change this. We built AgentFlow to be the bridge between cutting-edge AI 
                  research and practical business applications.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Users className="w-6 h-6 text-primary mr-3" />
                    <span className="text-text-muted">Founded by AI researchers and enterprise veterans</span>
                  </div>
                  <div className="flex items-center">
                    <Globe className="w-6 h-6 text-primary mr-3" />
                    <span className="text-text-muted">Serving 500+ businesses across 50+ countries</span>
                  </div>
                  <div className="flex items-center">
                    <Award className="w-6 h-6 text-primary mr-3" />
                    <span className="text-text-muted">Recognized as a leader in conversational AI</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <img 
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=600" 
                  alt="AgentFlow team collaborating in modern office" 
                  className="rounded-2xl shadow-xl w-full h-auto" 
                />
                <div className="absolute -bottom-6 -right-6 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Building the Future</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Values */}
        <section className="py-20 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Our Values
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                The principles that guide everything we do at AgentFlow
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => {
                const IconComponent = value.icon;
                return (
                  <Card key={index} className="text-center card-hover">
                    <CardHeader>
                      <div className="feature-icon mx-auto mb-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl">{value.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-text-muted">{value.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Leadership Team */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Leadership Team
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Meet the experts leading AgentFlow's mission to democratize AI
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <Card key={index} className="text-center card-hover">
                  <CardHeader>
                    <img 
                      src={member.image} 
                      alt={member.name} 
                      className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" 
                    />
                    <CardTitle className="text-xl">{member.name}</CardTitle>
                    <p className="text-primary font-medium">{member.role}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-text-muted text-sm">{member.bio}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Company Timeline */}
        <section className="py-20 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                Our Journey
              </h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                Key milestones in AgentFlow's growth and evolution
              </p>
            </div>

            <div className="relative">
              <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-primary"></div>
              <div className="space-y-12">
                {milestones.map((milestone, index) => (
                  <div key={index} className={`flex items-center ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                    <div className={`w-1/2 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8'}`}>
                      <div className="bg-white rounded-lg p-6 shadow-lg card-hover">
                        <div className="text-2xl font-bold text-primary mb-2">{milestone.year}</div>
                        <p className="text-text-muted">{milestone.event}</p>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="w-4 h-4 bg-primary rounded-full border-4 border-white"></div>
                    </div>
                    <div className="w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 gradient-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Join Us in Shaping the Future
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Whether you're a customer, partner, or potential team member, 
              we'd love to have you be part of the AgentFlow story.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-white text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors duration-200">
                View Open Positions
              </Button>
              <Button 
                variant="outline" 
                className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors duration-200"
              >
                Become a Partner
              </Button>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default About;