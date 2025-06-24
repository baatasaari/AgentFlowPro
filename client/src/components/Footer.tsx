import { Bot, Twitter, Linkedin, Github } from "lucide-react";
import { COMPANY_INFO, SOCIAL_LINKS } from "@/lib/constants";

const Footer = () => {
  const footerSections = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "/features" },
        { name: "Integrations", href: "/integrations" },
        { name: "Pricing", href: "/pricing" },
        { name: "Security", href: "/security" },
        { name: "API Docs", href: "/api-docs" },
      ],
    },
    {
      title: "Company",
      links: [
        { name: "About", href: "/about" },
        { name: "Careers", href: "/careers" },
        { name: "Blog", href: "/blog" },
        { name: "Contact", href: "/contact" },
        { name: "Partners", href: "/partners" },
      ],
    },
    {
      title: "Support",
      links: [
        { name: "Help Center", href: "/help" },
        { name: "Documentation", href: "/docs" },
        { name: "Community", href: "/community" },
        { name: "Status Page", href: "/status" },
        { name: "Contact Support", href: "/support" },
      ],
    },
  ];

  return (
    <footer className="bg-text-primary text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center mb-6">
              <Bot className="h-8 w-8 text-primary mr-2" />
              <span className="text-xl font-bold">{COMPANY_INFO.name}</span>
            </div>
            <p className="text-gray-400 mb-6">
              {COMPANY_INFO.description}
            </p>
            <div className="flex space-x-4">
              <a 
                href={SOCIAL_LINKS.twitter} 
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a 
                href={SOCIAL_LINKS.linkedin} 
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a 
                href={SOCIAL_LINKS.github} 
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          {footerSections.map((section, index) => (
            <div key={index}>
              <h4 className="font-semibold mb-6">{section.title}</h4>
              <ul className="space-y-3 text-gray-400">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a 
                      href={link.href} 
                      className="hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="border-t border-gray-700 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © 2024 {COMPANY_INFO.name}. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0 text-sm text-gray-400">
            <a href="/privacy" className="hover:text-white transition-colors duration-200">Privacy Policy</a>
            <a href="/terms" className="hover:text-white transition-colors duration-200">Terms of Service</a>
            <a href="/cookies" className="hover:text-white transition-colors duration-200">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
