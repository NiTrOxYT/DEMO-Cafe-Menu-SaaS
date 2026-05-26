import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useLogin } from "@/lib/api";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: () => {
          toast({
            title: "Welcome back",
            description: "Signed in successfully.",
          });
          setLocation("/admin");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: "Invalid credentials.",
          });
        },
      },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-5">
      <div className="noise-overlay" />
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="font-manrope text-[11px] uppercase tracking-[0.18em] font-semibold text-secondary mb-4">
            Admin Portal
          </p>
          <h1 className="font-garamond text-[44px] leading-tight text-foreground">
            TONGUE TWISTER
          </h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-manrope text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-email"
                      placeholder="your@email.com"
                      className="rounded-none border-0 border-b border-border bg-transparent px-0 py-3 font-manrope text-[15px] placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-foreground transition-colors"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="font-manrope text-[12px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-manrope text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">
                    Password
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-password"
                      type="password"
                      placeholder="••••••••"
                      className="rounded-none border-0 border-b border-border bg-transparent px-0 py-3 font-manrope text-[15px] placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-foreground transition-colors"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="font-manrope text-[12px]" />
                </FormItem>
              )}
            />

            <div className="pt-6">
              <button
                data-testid="button-submit"
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full bg-foreground text-background font-manrope text-[11px] uppercase tracking-[0.18em] font-semibold py-4 hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
