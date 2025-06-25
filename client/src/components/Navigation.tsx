import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Bot, Menu, X, ChevronDown } from "lucide-react";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [location] = useLocation();

  const navItems = [
    { 
      name: "Platform", 
      href: "/platform",
      submenu: [
        { name: "Core Features", href: "/features" },
        { name: "AI Training Studio", href: "/ai-training" },
        { name: "Flow Designer", href: "/flow-designer" },
        { name: "Analytics Dashboard", href: "/analytics" }
      ]
    },
    { 
      name: "Integrations", 
      href: "/integrations",
      submenu: [
        { name: "WhatsApp Business", href: "/integrations/whatsapp" },
        { name: "Instagram Messaging", href: "/integrations/instagram" },
        { name: "Facebook Messenger", href: "/integrations/facebook" },
        { name: "Telegram Bots", href: "/integrations/telegram" },
        { name: "Discord Communities", href: "/integrations/discord" },
        { name: "LinkedIn Messaging", href: "/integrations/linkedin" },
        { name: "Custom API", href: "/integrations/custom" }
      ]
    },
    { 
      name: "Solutions", 
      href: "/solutions",
      submenu: [
        { name: "E-commerce", href: "/solutions/ecommerce" },
        { name: "Healthcare", href: "/solutions/healthcare" },
        { name: "Financial Services", href: "/solutions/finance" },
        { name: "Real Estate", href: "/solutions/realestate" },
        { name: "Customer Support", href: "/solutions/support" }
      ]
    },
    { name: "Pricing", href: "/pricing" },
    { 
      name: "Resources", 
      href: "/resources",
      submenu: [
        { name: "Documentation", href: "/docs" },
        { name: "API Reference", href: "/api" },
        { name: "Case Studies", href: "/case-studies" },
        { name: "Blog", href: "/blog" },
        { name: "Community", href: "/community" }
      ]
    },
    { 
      name: "Company", 
      href: "/company",
      submenu: [
        { name: "About Us", href: "/about" },
        { name: "Careers", href: "/careers" },
        { name: "Partners", href: "/partners" },
        { name: "Security", href: "/security" },
        { name: "Contact", href: "/contact" }
      ]
    }
  ];

  const isActive = (href: string) => location === href;

  return (
    <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Bot className="h-8 w-8 text-primary mr-2" />
              <span className="text-xl font-bold text-text-primary">AgentFlow</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              {navItems.map((item) => (
                <div 
                  key={item.name} 
                  className="relative"
                  onMouseEnter={() => item.submenu && setActiveDropdown(item.name)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  {item.submenu ? (
                    <div className="flex items-center cursor-pointer text-text-muted hover:text-primary transition-colors duration-200">
                      <span>{item.name}</span>
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className={`transition-colors duration-200 ${
                        isActive(item.href)
                          ? "text-primary font-medium"
                          : "text-text-muted hover:text-primary"
                      }`}
                    >
                      {item.name}
                    </Link>
                  )}
                  
                  {/* Dropdown Menu */}
                  {item.submenu && activeDropdown === item.name && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      {item.submenu.map((subItem) => (
                        <Link
                          key={subItem.name}
                          href={subItem.href}
                          className="block px-4 py-2 text-text-muted hover:text-primary hover:bg-gray-50 transition-colors duration-200"
                        >
                          {subItem.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" className="text-text-muted hover:text-primary">
              Sign In
            </Button>
            <Button className="btn-primary">
              Start Free Trial
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t max-h-96 overflow-y-auto">
              {navItems.map((item) => (
                <div key={item.name}>
                  {item.submenu ? (
                    <div>
                      <div className="px-3 py-2 text-base font-medium text-text-primary border-b border-gray-100">
                        {item.name}
                      </div>
                      {item.submenu.map((subItem) => (
                        <Link
                          key={subItem.name}
                          href={subItem.href}
                          className="block pl-6 pr-3 py-2 text-sm text-text-muted hover:text-primary hover:bg-gray-50 transition-colors duration-200"
                          onClick={() => setIsOpen(false)}
                        >
                          {subItem.name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                        isActive(item.href)
                          ? "text-primary bg-primary/10"
                          : "text-text-muted hover:text-primary hover:bg-gray-50"
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
              <div className="pt-4 pb-3 border-t border-gray-200">
                <div className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start">
                    Sign In
                  </Button>
                  <Button className="w-full btn-primary">
                    Start Free Trial
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
