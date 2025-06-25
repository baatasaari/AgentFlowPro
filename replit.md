# AgentFlow - Enterprise AI Conversational Agent Platform

## Overview

AgentFlow is a full-stack web application that provides an enterprise AI platform for deploying intelligent conversational agents across multiple messaging platforms including WhatsApp, Telegram, Discord, and more. The platform enables businesses to automate customer interactions while maintaining personalized, context-aware conversations.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **State Management**: React Query (@tanstack/react-query) for server state
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite with custom configuration

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with structured error handling
- **Development**: Hot reload with Vite middleware integration
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Validation**: Zod schemas for type-safe data validation

### Data Storage
- **Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM with type-safe queries
- **Schema**: Centralized schema definition in `/shared/schema.ts`
- **Migrations**: Drizzle Kit for database migrations
- **Tables**: Users, leads, newsletter subscribers, contact submissions

## Key Components

### Database Schema
- **Users**: Authentication and user management
- **Leads**: Customer lead capture from various sources (trial, demo, contact, newsletter)
- **Newsletter Subscribers**: Email subscription management
- **Contact Submissions**: Customer inquiry tracking with status management

### API Endpoints
- `POST /api/leads` - Lead capture and conversion tracking
- `POST /api/newsletter` - Newsletter subscription management
- `POST /api/contact` - Contact form submissions

### Frontend Components
- **Navigation**: Responsive navigation with mobile support
- **Hero**: Landing page with call-to-action forms
- **Features**: Interactive feature showcase
- **Integrations**: Platform integration demonstrations
- **Pricing**: Tiered pricing plans with feature comparison
- **Interactive Demo**: Platform demonstration components
- **Contact Forms**: Lead capture and contact management

### Shared Resources
- **Schema**: Shared TypeScript types and Zod validation schemas
- **Constants**: Centralized configuration for company info, pricing, features
- **Utilities**: Common utility functions and helpers

## Data Flow

1. **User Interaction**: Users interact with React frontend components
2. **Form Submission**: Forms validated with React Hook Form + Zod schemas
3. **API Requests**: Requests sent to Express.js backend via React Query
4. **Data Validation**: Server validates requests using shared Zod schemas
5. **Database Operations**: Drizzle ORM handles PostgreSQL operations
6. **Response Handling**: Structured responses with error handling
7. **UI Updates**: React Query manages cache invalidation and UI updates

## External Dependencies

### Core Framework Dependencies
- React ecosystem (React, React DOM, React Hook Form)
- Express.js with TypeScript support
- Drizzle ORM with PostgreSQL adapter
- Vite for build tooling and development server

### UI and Styling
- Tailwind CSS for utility-first styling
- Radix UI primitives for accessible components
- Lucide React for consistent iconography
- Custom CSS variables for theme management

### Development Tools
- TypeScript for type safety
- Zod for runtime validation
- ESBuild for production bundling
- PostCSS for CSS processing

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with hot reload
- **Database**: PostgreSQL 16 with Replit integration
- **Build Process**: Vite development server with Express middleware
- **Port Configuration**: Local port 5000, external port 80

### Production Build
- **Frontend**: Vite build to static assets in `dist/public`
- **Backend**: ESBuild bundles server code to `dist/index.js`
- **Database**: Environment-based DATABASE_URL configuration
- **Deployment Target**: Autoscale deployment on Replit

### Environment Configuration
- Development: Hot reload with source maps
- Production: Optimized bundles with minification
- Database: Environment variable configuration
- Static Assets: Served from build output directory

## Changelog
- June 24, 2025: Initial setup
- June 24, 2025: Created comprehensive multi-page website with detailed navigation structure including Platform, Solutions, Resources, and Company sections with 15+ pages total
- June 25, 2025: Updated all content to focus on agentic AI capabilities, emphasizing autonomous decision-making and self-directed agents
- June 25, 2025: Added dedicated platform-specific integration pages (WhatsApp, Instagram, Facebook, Telegram, Discord, LinkedIn, Custom API) with detailed agentic capabilities for each platform
- June 25, 2025: Updated trial period from 14 days to 7 days across all CTAs
- June 25, 2025: Integrated PostgreSQL database and updated storage layer from in-memory to database operations
- June 25, 2025: Implemented comprehensive A/B testing system for conversion optimization with variant testing for CTAs, pricing displays, and value propositions

## User Preferences

Preferred communication style: Simple, everyday language.