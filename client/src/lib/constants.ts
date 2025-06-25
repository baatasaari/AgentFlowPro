export const COMPANY_INFO = {
  name: "AgentFlow",
  tagline: "Enterprise Agentic AI Platform",
  description: "Deploy autonomous AI agents that think, decide, and act independently across WhatsApp, Telegram, Discord, and more. Our agentic AI systems go beyond conversations—they execute complex workflows, make intelligent decisions, and drive business outcomes autonomously.",
  email: "contact@agentflow.com",
  phone: "+1 (555) 123-4567",
  address: "123 AI Innovation Blvd, San Francisco, CA 94105",
};

export const SOCIAL_LINKS = {
  twitter: "https://twitter.com/agentflow",
  linkedin: "https://linkedin.com/company/agentflow",
  github: "https://github.com/agentflow",
};

export const PRICING_PLANS = [
  {
    name: "Starter",
    price: 99,
    description: "Perfect for small businesses",
    features: [
      "1 Autonomous AI Agent",
      "2 Platform Integrations",
      "Basic Decision Analytics",
      "Email Support",
      "Pre-built Agentic Templates",
    ],
    popular: false,
    cta: "Start Free Trial",
  },
  {
    name: "Professional",
    price: 299,
    description: "Ideal for growing companies",
    features: [
      "5 Autonomous AI Agents",
      "All Platform Integrations",
      "Advanced Agentic Analytics",
      "Priority Support",
      "Custom Agent Training",
      "Multi-Step Workflow Designer",
    ],
    popular: true,
    cta: "Start Free Trial",
  },
  {
    name: "Enterprise",
    price: null,
    description: "For large organizations",
    features: [
      "Unlimited Agents",
      "White-label Solution",
      "Custom Integrations",
      "Dedicated Support",
      "SLA Guarantee",
      "On-premise Deployment",
    ],
    popular: false,
    cta: "Contact Sales",
  },
];

export const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Director of Customer Success",
    company: "TechCorp",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&h=100",
    content: "AgentFlow reduced our response time by 75% and increased customer satisfaction scores significantly. The AI training system learned our brand voice perfectly.",
    rating: 5,
  },
  {
    name: "Michael Rodriguez",
    role: "VP of Operations",
    company: "RetailPlus",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&h=100",
    content: "The multi-platform integration is game-changing. We're now present on WhatsApp, Telegram, and Facebook with consistent, intelligent responses across all channels.",
    rating: 5,
  },
  {
    name: "Emma Thompson",
    role: "CMO",
    company: "HealthWise Solutions",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&h=100",
    content: "Implementation was seamless, and the ROI was immediate. Our customer acquisition costs dropped by 40% while conversion rates increased by 60%.",
    rating: 5,
  },
];

export const FEATURES = [
  {
    icon: "Brain",
    title: "Custom AI Training",
    description: "Train your agents with your business context, brand voice, and industry knowledge. Our semantic search system ensures accurate, relevant responses every time.",
    benefits: [
      "Brand voice configuration",
      "Knowledge base management",
      "Real-time learning",
    ],
  },
  {
    icon: "Network",
    title: "Multi-Platform Integration",
    description: "Deploy across WhatsApp, Telegram, Discord, Facebook Messenger, and Instagram. One agent, multiple touchpoints, consistent experience.",
    benefits: [
      "5+ messaging platforms",
      "Rich media support",
      "Interactive buttons & menus",
    ],
  },
  {
    icon: "TrendingUp",
    title: "Advanced Analytics",
    description: "Track performance metrics, conversion rates, and cost analysis. Optimize your agents with detailed insights and A/B testing capabilities.",
    benefits: [
      "Conversion tracking",
      "Cost optimization",
      "Performance metrics",
    ],
  },
  {
    icon: "GitBranch",
    title: "Visual Flow Designer",
    description: "Create complex conversation flows with our drag-and-drop interface. Build conditional logic, manage variables, and design engaging user experiences.",
    benefits: [
      "Drag-and-drop builder",
      "Conditional logic",
      "Pre-built templates",
    ],
  },
  {
    icon: "Database",
    title: "Data Source Integration",
    description: "Connect to CRMs, help desk systems, and databases. Import training data from CSV, Google Sheets, or sync real-time data via webhooks.",
    benefits: [
      "CRM integration",
      "File imports",
      "API webhooks",
    ],
  },
  {
    icon: "Shield",
    title: "Enterprise Security",
    description: "Role-based access control, multi-tenant architecture, and comprehensive audit logging. Built for enterprise compliance and data protection.",
    benefits: [
      "RBAC system",
      "Data isolation",
      "Audit logging",
    ],
  },
];

export const INTEGRATIONS = [
  { name: "WhatsApp Business", icon: "MessageCircle", color: "text-green-500" },
  { name: "Telegram", icon: "Send", color: "text-blue-500" },
  { name: "Discord", icon: "Hash", color: "text-indigo-500" },
  { name: "Messenger", icon: "MessageSquare", color: "text-blue-600" },
  { name: "Instagram", icon: "Instagram", color: "text-pink-500" },
  { name: "Salesforce", icon: "Cloud", color: "text-blue-500" },
  { name: "HubSpot", icon: "BarChart3", color: "text-orange-500" },
  { name: "Zendesk", icon: "Headphones", color: "text-green-500" },
  { name: "Google Sheets", icon: "FileSpreadsheet", color: "text-green-600" },
  { name: "Shopify", icon: "ShoppingBag", color: "text-green-600" },
];

export const RESOURCES = [
  {
    type: "GUIDE",
    title: "AI Agent Implementation Best Practices",
    description: "Complete guide to deploying conversational AI that drives business results and customer satisfaction.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&h=200",
    link: "/resources/implementation-guide",
  },
  {
    type: "CASE STUDY",
    title: "How RetailCorp Increased Sales by 45%",
    description: "Learn how a major retailer transformed their customer experience and boosted conversion rates.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&h=200",
    link: "/resources/retailcorp-case-study",
  },
  {
    type: "WEBINAR",
    title: "The Future of Customer Service AI",
    description: "Join our experts to explore emerging trends and technologies in conversational AI for business.",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&h=200",
    link: "/resources/future-of-ai-webinar",
  },
];
