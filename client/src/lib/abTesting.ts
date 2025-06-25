// A/B Testing System for Conversion Optimization
import { useState, useEffect } from 'react';

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number; // Percentage allocation (0-100)
  metadata?: Record<string, any>;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
  conversionGoal: string;
}

// A/B Test Storage (using localStorage for simplicity)
class ABTestStorage {
  private static STORAGE_KEY = 'agentflow_ab_tests';
  private static USER_ASSIGNMENTS_KEY = 'agentflow_ab_assignments';
  private static CONVERSION_EVENTS_KEY = 'agentflow_ab_conversions';

  static getTests(): ABTest[] {
    const tests = localStorage.getItem(this.STORAGE_KEY);
    return tests ? JSON.parse(tests) : [];
  }

  static saveTest(test: ABTest): void {
    const tests = this.getTests();
    const existingIndex = tests.findIndex(t => t.id === test.id);
    
    if (existingIndex >= 0) {
      tests[existingIndex] = test;
    } else {
      tests.push(test);
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tests));
  }

  static getUserAssignment(testId: string): string | null {
    const assignments = localStorage.getItem(this.USER_ASSIGNMENTS_KEY);
    const parsed = assignments ? JSON.parse(assignments) : {};
    return parsed[testId] || null;
  }

  static setUserAssignment(testId: string, variantId: string): void {
    const assignments = localStorage.getItem(this.USER_ASSIGNMENTS_KEY);
    const parsed = assignments ? JSON.parse(assignments) : {};
    parsed[testId] = variantId;
    localStorage.setItem(this.USER_ASSIGNMENTS_KEY, JSON.stringify(parsed));
  }

  static trackConversion(testId: string, variantId: string, conversionType: string): void {
    const conversions = localStorage.getItem(this.CONVERSION_EVENTS_KEY);
    const parsed = conversions ? JSON.parse(conversions) : [];
    
    parsed.push({
      testId,
      variantId,
      conversionType,
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId()
    });
    
    localStorage.setItem(this.CONVERSION_EVENTS_KEY, JSON.stringify(parsed));
  }

  static getConversions(testId?: string) {
    const conversions = localStorage.getItem(this.CONVERSION_EVENTS_KEY);
    const parsed = conversions ? JSON.parse(conversions) : [];
    
    return testId ? parsed.filter((c: any) => c.testId === testId) : parsed;
  }

  private static getSessionId(): string {
    let sessionId = sessionStorage.getItem('agentflow_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('agentflow_session_id', sessionId);
    }
    return sessionId;
  }
}

// A/B Test Manager
export class ABTestManager {
  static assignUserToVariant(test: ABTest): ABTestVariant {
    // Check if user already has an assignment
    const existingAssignment = ABTestStorage.getUserAssignment(test.id);
    if (existingAssignment) {
      const variant = test.variants.find(v => v.id === existingAssignment);
      if (variant) return variant;
    }

    // Assign user to variant based on weights
    const totalWeight = test.variants.reduce((sum, variant) => sum + variant.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const variant of test.variants) {
      currentWeight += variant.weight;
      if (random <= currentWeight) {
        ABTestStorage.setUserAssignment(test.id, variant.id);
        return variant;
      }
    }

    // Fallback to first variant
    const fallback = test.variants[0];
    ABTestStorage.setUserAssignment(test.id, fallback.id);
    return fallback;
  }

  static trackConversion(testId: string, conversionType: string): void {
    const assignment = ABTestStorage.getUserAssignment(testId);
    if (assignment) {
      ABTestStorage.trackConversion(testId, assignment, conversionType);
    }
  }

  static getTestResults(testId: string) {
    const conversions = ABTestStorage.getConversions(testId);
    const test = ABTestStorage.getTests().find(t => t.id === testId);
    
    if (!test) return null;

    const results = test.variants.map(variant => {
      const variantConversions = conversions.filter((c: any) => c.variantId === variant.id);
      return {
        variant,
        conversions: variantConversions.length,
        conversionRate: variantConversions.length // This would need traffic data for actual rate
      };
    });

    return { test, results };
  }
}

// React Hook for A/B Testing
export function useABTest(testId: string): {
  variant: ABTestVariant | null;
  trackConversion: (conversionType: string) => void;
  isLoading: boolean;
} {
  const [variant, setVariant] = useState<ABTestVariant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const test = ABTestStorage.getTests().find(t => t.id === testId && t.status === 'active');
    
    if (test) {
      const assignedVariant = ABTestManager.assignUserToVariant(test);
      setVariant(assignedVariant);
    }
    
    setIsLoading(false);
  }, [testId]);

  const trackConversion = (conversionType: string) => {
    if (variant) {
      ABTestManager.trackConversion(testId, conversionType);
    }
  };

  return { variant, trackConversion, isLoading };
}

// Predefined A/B Tests for AgentFlow
export const AGENTFLOW_AB_TESTS: ABTest[] = [
  {
    id: 'hero_cta_test',
    name: 'Hero CTA Button Text',
    description: 'Test different CTA button texts on the hero section',
    variants: [
      { id: 'control', name: 'Start Free 7-Day Trial', weight: 50 },
      { id: 'variant_a', name: 'Deploy Agents Now - Free', weight: 25 },
      { id: 'variant_b', name: 'Try Autonomous AI Free', weight: 25 }
    ],
    status: 'active',
    conversionGoal: 'trial_signup'
  },
  {
    id: 'pricing_display_test',
    name: 'Pricing Display Format',
    description: 'Test different ways to display pricing information',
    variants: [
      { id: 'monthly', name: 'Monthly Pricing', weight: 50, metadata: { showMonthly: true } },
      { id: 'annual', name: 'Annual Pricing (Default)', weight: 50, metadata: { showMonthly: false } }
    ],
    status: 'active',
    conversionGoal: 'pricing_page_conversion'
  },
  {
    id: 'hero_value_prop_test',
    name: 'Hero Value Proposition',
    description: 'Test different value propositions in the hero section',
    variants: [
      { 
        id: 'autonomous', 
        name: 'Autonomous Focus', 
        weight: 33,
        metadata: { 
          headline: 'Deploy Autonomous AI Agents That Think, Decide & Act',
          subheadline: 'Revolutionary agentic AI that goes beyond conversations. Our autonomous agents analyze situations, make intelligent decisions, execute complex workflows, and drive business outcomes—all without human intervention.'
        }
      },
      { 
        id: 'business_results', 
        name: 'Business Results Focus', 
        weight: 33,
        metadata: { 
          headline: 'AI Agents That Drive Real Business Results',
          subheadline: 'Transform your operations with intelligent agents that increase sales by 45%, reduce costs by 60%, and operate 24/7 across all your customer touchpoints.'
        }
      },
      { 
        id: 'enterprise', 
        name: 'Enterprise Focus', 
        weight: 34,
        metadata: { 
          headline: 'Enterprise-Grade AI Agent Platform',
          subheadline: 'Trusted by Fortune 500 companies to deploy sophisticated AI agents that handle complex workflows, manage customer relationships, and scale operations intelligently.'
        }
      }
    ],
    status: 'active',
    conversionGoal: 'hero_engagement'
  }
];

// Initialize tests in localStorage if not present
export function initializeABTests(): void {
  const existingTests = ABTestStorage.getTests();
  if (existingTests.length === 0) {
    AGENTFLOW_AB_TESTS.forEach(test => {
      ABTestStorage.saveTest(test);
    });
  }
}