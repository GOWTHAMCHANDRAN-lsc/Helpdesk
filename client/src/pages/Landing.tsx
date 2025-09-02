import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Headphones, Shield, Zap, Users, MessageCircle, BarChart3 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen gradient-primary animate-gradient-move">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex justify-center items-center mb-6">
            <Headphones className="h-16 w-16 text-primary-500 mr-4 animate-fade-in" />
            <h1 className="premium-heading text-5xl animate-fade-in">Helpdesk Pro</h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in delay-100">
            Enterprise-grade helpdesk solution for modern teams. Streamline support, enhance collaboration, and deliver exceptional customer service.
          </p>
          <div className="space-x-4">
            <Button 
              size="lg" 
              variant="premium"
              className="shadow-xl px-8 text-lg animate-fade-in"
              onClick={() => window.location.href = "/api/login"}
            >
              Get Started
            </Button>
            <Button variant="outline" size="lg" className="rounded-full border-2 border-indigo-400 text-indigo-700 dark:text-indigo-200 px-8 text-lg bg-white/70 dark:bg-gray-900/60 shadow-md hover:bg-indigo-50 dark:hover:bg-gray-800/80 animate-fade-in delay-100">
              Learn More
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="card shadow-xl">
            <CardHeader>
              <Shield className="h-8 w-8 text-primary-500 mb-2" />
              <CardTitle>Enterprise Security</CardTitle>
              <CardDescription>
                Bank-level security with role-based access control and audit logs.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <Zap className="h-8 w-8 text-primary-500 mb-2" />
              <CardTitle>Real-time Collaboration</CardTitle>
              <CardDescription>
                Instant messaging and live updates keep your team in sync.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <Users className="h-8 w-8 text-primary-500 mb-2" />
              <CardTitle>Multi-department Support</CardTitle>
              <CardDescription>
                Organize tickets by departments with intelligent routing.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <MessageCircle className="h-8 w-8 text-primary-500 mb-2" />
              <CardTitle>Integrated Chat</CardTitle>
              <CardDescription>
                Built-in chat system for seamless communication on every ticket.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-primary-500 mb-2" />
              <CardTitle>Advanced Analytics</CardTitle>
              <CardDescription>
                Comprehensive reporting and insights to optimize your support.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <Headphones className="h-8 w-8 text-primary-500 mb-2" />
              <CardTitle>24/7 Availability</CardTitle>
              <CardDescription>
                Always-on support with mobile-responsive design.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to transform your support?</CardTitle>
              <CardDescription className="text-lg">
                Join thousands of teams already using Helpdesk Pro to deliver exceptional support experiences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                size="lg" 
                className="bg-primary-500 hover:bg-primary-600"
                onClick={() => window.location.href = "/api/login"}
              >
                Sign In to Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
