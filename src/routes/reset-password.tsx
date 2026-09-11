import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlaskaWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { passwordProblem, passwordScore } from "@/lib/auth-security";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your Alaska AI password" },
      {
        name: "description",
        content: "Choose a new, strong password for your Alaska AI account.",
      },
      { property: "og:title", content: "Reset your Alaska AI password" },
      {
        property: "og:description",
        content: "Choose a new, strong password for your Alaska AI account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: session }) => {
      if (session.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    const problem = passwordProblem(password);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Invalidate every other session so a stolen token cannot survive the reset.
    await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
    toast.success("Password updated. You are signed out everywhere else.");
    navigate({ to: "/ai" });
  };

  const score = passwordScore(password);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft">
        <AlaskaWordmark />
        <h1 className="mt-6 text-2xl font-semibold">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready
            ? "Choose a strong password you do not use anywhere else."
            : "Open this page from the reset link in your email."}
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!ready}
            />
            <StrengthMeter score={score} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={!ready}
            />
          </div>
          <Button className="w-full" disabled={!ready || saving} onClick={submit}>
            Update password
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StrengthMeter({ score }: { score: number }) {
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              index < score ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{labels[score]}</p>
    </div>
  );
}
