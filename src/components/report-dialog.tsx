import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const REPORT_REASONS = [
  "Harassment or bullying",
  "Hate speech",
  "Sexual or adult content",
  "Violence or threats",
  "Self-harm or suicide",
  "Illegal or dangerous activity",
  "Spam or scam",
  "Child safety concern",
  "Something else",
];

export type ReportTarget = {
  type: "user" | "message" | "story" | "ai_reply";
  id?: string | undefined;
  userId?: string | undefined;
  label?: string | undefined;
};

export function ReportDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReportTarget;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]!);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const submit = async () => {
    if (!userId) return;
    if (details.length > 2000) {
      toast.error("Please keep the details under 2000 characters.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: userId,
      reported_user_id: target.userId ?? null,
      target_type: target.type,
      target_id: target.id ?? null,
      reason,
      details: details.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Couldn't send that report. Please try again.");
      return;
    }
    toast.success("Report sent. Our moderators will review it.");
    setDetails("");
    onOpenChange(false);
  };

  const blockUser = async () => {
    if (!userId || !target.userId) return;
    const { error } = await supabase
      .from("blocked_users")
      .insert({ blocker_id: userId, blocked_id: target.userId });
    if (error) toast.error("Couldn't block that person.");
    else toast.success("Blocked. They can no longer reach you.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4" /> Report {target.label ?? target.type.replace("_", " ")}
          </DialogTitle>
          <DialogDescription>
            Reports are private. Moderators review them and can suspend accounts that break the
            rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>What happened? (optional)</Label>
            <Textarea
              value={details}
              maxLength={2000}
              rows={4}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Add anything that helps us review this"
            />
          </div>
        </div>

        <div className="flex justify-between gap-2">
          {target.userId ? (
            <Button variant="outline" onClick={blockUser}>
              Block this person
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={submit} disabled={sending}>
            {sending ? "Sending…" : "Send report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
