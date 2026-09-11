import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently deletes the signed-in user: all AI threads/messages, chats,
 * stories, media files, saved images, settings, profile and the auth account.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Uploaded media (recursively under <userId>/)
    const removeFolder = async (prefix: string) => {
      const { data } = await supabaseAdmin.storage.from("media").list(prefix, { limit: 1000 });
      if (!data?.length) return;
      const files: string[] = [];
      for (const entry of data) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) {
          await removeFolder(path);
        } else {
          files.push(path);
        }
      }
      if (files.length) await supabaseAdmin.storage.from("media").remove(files);
    };
    await removeFolder(userId);

    // 2. Rows the user owns
    await supabaseAdmin.from("ai_messages").delete().eq("user_id", userId);
    await supabaseAdmin.from("ai_threads").delete().eq("user_id", userId);
    await supabaseAdmin.from("image_library").delete().eq("user_id", userId);
    await supabaseAdmin.from("story_views").delete().eq("viewer_id", userId);
    await supabaseAdmin.from("stories").delete().eq("author_id", userId);
    await supabaseAdmin.from("messages").delete().eq("sender_id", userId);
    await supabaseAdmin.from("conversation_pins").delete().eq("user_id", userId);
    await supabaseAdmin.from("conversation_members").delete().eq("user_id", userId);
    await supabaseAdmin.from("blocked_users").delete().eq("blocker_id", userId);
    await supabaseAdmin.from("blocked_users").delete().eq("blocked_id", userId);
    await supabaseAdmin.from("friendships").delete().eq("requester_id", userId);
    await supabaseAdmin.from("friendships").delete().eq("addressee_id", userId);
    await supabaseAdmin.from("user_settings").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // 3. Conversations created by the user that no longer have members
    const { data: created } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("created_by", userId);
    for (const row of created ?? []) {
      const { count } = await supabaseAdmin
        .from("conversation_members")
        .select("user_id", { count: "exact", head: true })
        .eq("conversation_id", row.id);
      if (!count) {
        await supabaseAdmin.from("messages").delete().eq("conversation_id", row.id);
        await supabaseAdmin.from("conversation_pins").delete().eq("conversation_id", row.id);
        await supabaseAdmin.from("conversations").delete().eq("id", row.id);
      }
    }

    // 4. The auth account itself
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
