import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Loader2, Zap } from "lucide-react";

const schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_-]+$/, "Lowercase letters, numbers, hyphens only"),
  organizationName: z.string().min(2, "Company name required"),
  password: z.string().min(8, "Min. 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

type Form = z.infer<typeof schema>;

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json();
      if (!res.ok) throw new Error(Array.isArray(json.error) ? json.error[0]?.message : json.error);
      login(json.token, json.user, json.organization);
      toast({ title: "Welcome to AgentFlow!", description: "Your 14-day trial has started." });
      navigate("/dashboard");
    } catch (err) {
      toast({ title: "Registration failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><Zap className="w-5 h-5 text-white" /></div>
            <span className="text-xl font-bold text-white">AgentFlow</span>
          </Link>
        </div>
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Start your free trial</CardTitle>
            <CardDescription>14 days free. No credit card required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Sign-Up */}
            <a href="/api/auth/google">
              <Button variant="outline" className="w-full gap-3" type="button">
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </Button>
            </a>

            <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">or with email</span></div></div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>First Name</Label><Input {...register("firstName")} placeholder="Jane" />{errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}</div>
                <div className="space-y-1"><Label>Last Name</Label><Input {...register("lastName")} placeholder="Smith" />{errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}</div>
              </div>
              <div className="space-y-1"><Label>Company Name</Label><Input {...register("organizationName")} placeholder="Acme Corp" />{errors.organizationName && <p className="text-xs text-destructive">{errors.organizationName.message}</p>}</div>
              <div className="space-y-1"><Label>Work Email</Label><Input type="email" {...register("email")} placeholder="jane@acme.com" />{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}</div>
              <div className="space-y-1"><Label>Username</Label><Input {...register("username")} placeholder="janesmith" />{errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}</div>
              <div className="space-y-1"><Label>Password</Label><Input type="password" {...register("password")} placeholder="Min. 8 characters" />{errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}</div>
              <div className="space-y-1"><Label>Confirm Password</Label><Input type="password" {...register("confirmPassword")} />{errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}</div>
              <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Create Account</Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link></p>
            <p className="text-center text-xs text-muted-foreground">By signing up you agree to our <a href="#" className="underline">Terms</a> and <a href="#" className="underline">Privacy Policy</a></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
