import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, Users, Target, Play, Pause, RotateCcw } from "lucide-react";
import { ABTestManager, ABTest, ABTestVariant } from "@/lib/abTesting";

const ABTestDashboard = () => {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any>(null);

  useEffect(() => {
    // Load tests from storage
    const storedTests = JSON.parse(localStorage.getItem('agentflow_ab_tests') || '[]');
    setTests(storedTests);
  }, []);

  useEffect(() => {
    if (selectedTest) {
      const results = ABTestManager.getTestResults(selectedTest);
      setTestResults(results);
    }
  }, [selectedTest]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800',
      draft: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || colors.draft;
  };

  const formatDate = (date: Date | undefined) => {
    return date ? new Date(date).toLocaleDateString() : 'Not set';
  };

  const calculateConversionRate = (conversions: number, traffic: number) => {
    return traffic > 0 ? ((conversions / traffic) * 100).toFixed(2) : '0.00';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">A/B Testing Dashboard</h1>
          <p className="text-gray-600">Monitor and optimize your conversion tests</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tests</CardTitle>
              <Play className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tests.filter(t => t.status === 'active').length}</div>
              <p className="text-xs text-gray-600">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tests.length}</div>
              <p className="text-xs text-gray-600">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Improvement</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+12.5%</div>
              <p className="text-xs text-gray-600">Conversion rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Visitors</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2,847</div>
              <p className="text-xs text-gray-600">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Tests List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Active Tests</h2>
            <div className="space-y-4">
              {tests.map((test) => (
                <Card 
                  key={test.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedTest === test.id ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedTest(test.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{test.name}</CardTitle>
                      <Badge className={getStatusBadge(test.status)}>
                        {test.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{test.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{test.variants.length} variants</span>
                      <span>Goal: {test.conversionGoal}</span>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>
                          {test.status === 'active' ? 'Running' : 'Inactive'}
                        </span>
                      </div>
                      <Progress 
                        value={test.status === 'active' ? 65 : 100} 
                        className="h-2" 
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Test Details */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Test Details</h2>
            {selectedTest && testResults ? (
              <Card>
                <CardHeader>
                  <CardTitle>{testResults.test.name}</CardTitle>
                  <p className="text-sm text-gray-600">{testResults.test.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Test Info */}
                    <div>
                      <h4 className="font-medium mb-2">Test Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <Badge className={`ml-2 ${getStatusBadge(testResults.test.status)}`}>
                            {testResults.test.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-gray-600">Goal:</span>
                          <span className="ml-2">{testResults.test.conversionGoal}</span>
                        </div>
                      </div>
                    </div>

                    {/* Variants Performance */}
                    <div>
                      <h4 className="font-medium mb-3">Variant Performance</h4>
                      <div className="space-y-3">
                        {testResults.results.map((result: any, index: number) => (
                          <div key={result.variant.id} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <div 
                                  className={`w-3 h-3 rounded-full mr-2 ${
                                    index === 0 ? 'bg-blue-500' : 
                                    index === 1 ? 'bg-green-500' : 'bg-purple-500'
                                  }`} 
                                />
                                <span className="font-medium">{result.variant.name}</span>
                                {result.variant.id === 'control' && (
                                  <Badge variant="outline" className="ml-2 text-xs">Control</Badge>
                                )}
                              </div>
                              <span className="text-sm text-gray-600">
                                {result.variant.weight}% traffic
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Conversions:</span>
                                <div className="font-medium">{result.conversions}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Visitors:</span>
                                <div className="font-medium">
                                  {Math.round(100 * result.variant.weight / 100) || 0}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-600">Conv. Rate:</span>
                                <div className="font-medium">
                                  {calculateConversionRate(result.conversions, 100)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Test
                      </Button>
                      <Button size="sm" variant="outline">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset Data
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-gray-500">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a test to view detailed results</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ABTestDashboard;