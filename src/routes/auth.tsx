import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlaskaWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { StrengthMeter } from "@/routes/reset-password";
import {
  clearLoginAttempts,
  emailSchema,
  lockoutSeconds,
  passwordProblem,
  passwordScore,
  recordFailedLogin,
  usernameSchema,
} from "@/lib/auth-security";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Alaska AI" },
      {
        name: "description",
        content:
          "Create your Alaska AI account or sign back in to your assistant, chats and stories.",
      },
      { property: "og:title", content: "Sign in to Alaska AI" },
      {
        property: "og:description",
        content:
          "Create your Alaska AI account or sign back in to your assistant, chats and stories.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search["next"] === "string" ? { next: search["next"] as string } : {},
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [lockedFor, setLockedFor] = useState(0);

  useEffect(() => {
    const tick = () => setLockedFor(lockoutSeconds());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const destination = next && next.startsWith("/") ? next : "/ai";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(destination);
    });
  }, [destination]);

  const signIn = async () => {
    const remainingLock = lockoutSeconds();
    if (remainingLock > 0) {
      toast.error(`Too many failed attempts. Try again in ${remainingLock}s.`);
      return;
    }
    if (!emailSchema.safeParse(email).success) {
      toast.error("Enter a valid email address");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      const left = recordFailedLogin();
      setLockedFor(lockoutSeconds());
      // Generic message: never reveal whether the email exists.
      toast.error(
        left > 0
          ? `Incorrect email or password. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many failed attempts. Sign-in is paused for a moment.",
      );
      return;
    }
    clearLoginAttempts();
    navigate({ to: destination });
  };

  const forgotPassword = async () => {
    if (!emailSchema.safeParse(email).success) {
      toast.error("Enter your email first, then tap reset");
      return;
    }
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Always the same confirmation, so the form cannot be used to probe accounts.
    toast.success("If that email has an account, a reset link is on its way.");
  };

  const signUp = async () => {
    const parsedUsername = usernameSchema.safeParse(username);
    if (!parsedUsername.success) {
      toast.error(parsedUsername.error.issues[0]?.message ?? "Pick a valid username");
      return;
    }
    if (!emailSchema.safeParse(email).success) {
      toast.error("Enter a valid email address");
      return;
    }
    const weak = passwordProblem(password);
    if (weak) {
      toast.error(weak);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${destination}`,
        data: { display_name: displayName || parsedUsername.data, username: parsedUsername.data },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Check your email to confirm your account.");
      return;
    }
    navigate({ to: destination });
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: destination });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        className="pointer-events-none absolute -top-40 h-[420px] w-[720px] opacity-25 blur-3xl bg-aurora-gradient"
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft">
        <AlaskaWordmark />
        <h1 className="mt-6 text-2xl font-semibold">Welcome to Alaska</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your assistant, your chats and your research stories.
        </p>

        <Tabs defaultValue="signin" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-5 space-y-4">
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field label="Password" value={password} onChange={setPassword} type="password" />
            <Button className="w-full" disabled={loading || lockedFor > 0} onClick={signIn}>
              {lockedFor > 0 ? `Locked — ${lockedFor}s` : "Sign in"}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={forgotPassword}
            >
              Forgot password?
            </button>
          </TabsContent>

          <TabsContent value="signup" className="mt-5 space-y-4">
            <Field label="Display name" value={displayName} onChange={setDisplayName} />
            <Field label="Username" value={username} onChange={setUsername} />
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <div className="space-y-1.5">
              <Field label="Password" value={password} onChange={setPassword} type="password" />
              <StrengthMeter score={passwordScore(password)} />
              <p className="text-xs text-muted-foreground">
                12+ characters with upper and lower case, a number and a symbol. Passwords found in
                known data breaches are rejected.
              </p>
            </div>
            <Button className="w-full" disabled={loading} onClick={signUp}>
              Create account
            </Button>
            <p className="text-xs text-muted-foreground">
              We email you a confirmation link — accounts stay inactive until it is opened.
            </p>
          </TabsContent>
        </Tabs>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={google}>
          Continue with Google
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
