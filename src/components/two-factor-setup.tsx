import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Factor = { id: string; status: string; friendly_name?: string | null };

export function TwoFactorSetup() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error(error.message);
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const verified = factors.filter((f) => f.status === "verified");

  const startEnroll = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Alaska ${Date.now()}`,
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't start two-factor setup");
      return;
    }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verify = async () => {
    if (!enroll) return;
    setBusy(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId: enroll.id });
    if (challenge.error) {
      setBusy(false);
      toast.error(challenge.error.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enroll.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication is on");
    setEnroll(null);
    setCode("");
    refresh();
  };

  const disable = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication turned off");
    refresh();
  };

  if (loading) {
    return <Loader2 className="my-3 h-4 w-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            Two-factor authentication
          </p>
          <p className="text-xs text-muted-foreground">
            {verified.length > 0
              ? "Enabled — you'll be asked for a code from your authenticator app."
              : "Protect your account with a code from an authenticator app."}
          </p>
        </div>
        {verified.length > 0 ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => disable(verified[0]!.id)}
          >
            Turn off
          </Button>
        ) : enroll ? null : (
          <Button size="sm" disabled={busy} onClick={startEnroll}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable"}
          </Button>
        )}
      </div>

      {enroll ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">
            Scan this QR code with Google Authenticator, 1Password or Authy, then enter the 6-digit
            code.
          </p>
          <img
            src={enroll.qr}
            alt="Two-factor QR code"
            className="h-40 w-40 rounded-lg bg-white p-2"
          />
          <p className="break-all text-xs text-muted-foreground">
            Manual key: <span className="font-mono">{enroll.secret}</span>
          </p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              className="w-32"
            />
            <Button size="sm" disabled={busy || code.trim().length < 6} onClick={verify}>
              Verify
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                await supabase.auth.mfa.unenroll({ factorId: enroll.id });
                setEnroll(null);
                refresh();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
