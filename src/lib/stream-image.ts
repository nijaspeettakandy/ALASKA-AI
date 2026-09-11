import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImageEventPayload =
  | { type: "image_generation.partial_image"; b64_json: string }
  | { type: "image_generation.completed"; b64_json: string }
  | { type: "error"; error: { message: string } };

export type ImageOptions = {
  prompt: string;
  quality?: "fast" | "high";
  aspect?: "square" | "landscape" | "portrait";
  referenceImage?: string;
  variation?: boolean;
};

export async function streamImage(
  options: ImageOptions,
  token: string,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(options),
  });
  if (!res.ok || !res.body) {
    throw new Error((await res.text().catch(() => "")) || "Image generation failed");
  }

  let sawCompleted = false;
  let streamError: string | undefined;

  const parser = createParser({
    onEvent(event) {
      let payload: ImageEventPayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImageEventPayload;
      } catch {
        return;
      }
      if (event.event === "error" || payload?.type === "error") {
        streamError =
          (payload as { error?: { message?: string } })?.error?.message ??
          "Image generation failed";
        return;
      }
      if (
        event.event !== "image_generation.partial_image" &&
        event.event !== "image_generation.completed"
      )
        return;
      const isFinal = event.event === "image_generation.completed";
      flushSync(() => {
        onFrame(`data:image/png;base64,${(payload as { b64_json: string }).b64_json}`, isFinal);
      });
      if (isFinal) sawCompleted = true;
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  if (streamError) throw new Error(streamError);
  if (!sawCompleted) throw new Error("Image generation failed");
}

export async function saveImageToLibrary(dataUrl: string, prompt: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("You need to be signed in");

  const blob = await (await fetch(dataUrl)).blob();
  const path = `${userId}/library/${crypto.randomUUID()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, blob, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabase
    .from("image_library")
    .insert({ user_id: userId, prompt, storage_path: path });
  if (error) throw error;
}
