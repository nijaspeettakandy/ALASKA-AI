export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      account_suspensions: {
        Row: {
          created_at: string;
          id: string;
          reason: string;
          suspended_until: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reason?: string;
          suspended_until: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string;
          suspended_until?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          client_id: string | null;
          created_at: string;
          id: string;
          parts: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          id?: string;
          parts?: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          id?: string;
          parts?: Json;
          role?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "ai_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_threads: {
        Row: {
          created_at: string;
          id: string;
          pinned: boolean;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          pinned?: boolean;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          pinned?: boolean;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      blocked_users: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      content_reports: {
        Row: {
          created_at: string;
          details: string;
          id: string;
          reason: string;
          reported_user_id: string | null;
          reporter_id: string;
          status: string;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          created_at?: string;
          details?: string;
          id?: string;
          reason: string;
          reported_user_id?: string | null;
          reporter_id: string;
          status?: string;
          target_id?: string | null;
          target_type?: string;
        };
        Update: {
          created_at?: string;
          details?: string;
          id?: string;
          reason?: string;
          reported_user_id?: string | null;
          reporter_id?: string;
          status?: string;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_pins: {
        Row: {
          conversation_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_pins_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          is_group: boolean;
          last_message_at: string;
          title: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          is_group?: boolean;
          last_message_at?: string;
          title?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          is_group?: boolean;
          last_message_at?: string;
          title?: string | null;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          status: string;
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          status?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      image_library: {
        Row: {
          created_at: string;
          id: string;
          prompt: string;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          prompt?: string;
          storage_path: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          prompt?: string;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      knowledge_chunks: {
        Row: {
          chunk_index: number;
          content: string;
          created_at: string;
          document_id: string;
          embedding: string;
          id: string;
          token_estimate: number;
          user_id: string;
        };
        Insert: {
          chunk_index: number;
          content: string;
          created_at?: string;
          document_id: string;
          embedding: string;
          id?: string;
          token_estimate?: number;
          user_id: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: string;
          id?: string;
          token_estimate?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_documents: {
        Row: {
          chunk_count: number;
          content: string;
          created_at: string;
          id: string;
          source: string;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chunk_count?: number;
          content?: string;
          created_at?: string;
          id?: string;
          source?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chunk_count?: number;
          content?: string;
          created_at?: string;
          id?: string;
          source?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          sender_id: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          sender_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_events: {
        Row: {
          action: string;
          categories: string[];
          created_at: string;
          direction: string;
          excerpt: string;
          id: string;
          severity: string;
          surface: string;
          user_id: string;
        };
        Insert: {
          action?: string;
          categories?: string[];
          created_at?: string;
          direction?: string;
          excerpt?: string;
          id?: string;
          severity?: string;
          surface?: string;
          user_id: string;
        };
        Update: {
          action?: string;
          categories?: string[];
          created_at?: string;
          direction?: string;
          excerpt?: string;
          id?: string;
          severity?: string;
          surface?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profile_private: {
        Row: {
          birth_year: number | null;
          location: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          birth_year?: number | null;
          location?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          birth_year?: number | null;
          location?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string;
          chat_rules: string;
          created_at: string;
          display_name: string;
          id: string;
          safe_mode: boolean;
          theme: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string;
          chat_rules?: string;
          created_at?: string;
          display_name?: string;
          id: string;
          safe_mode?: boolean;
          theme?: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string;
          chat_rules?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          safe_mode?: boolean;
          theme?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      rate_limit_counters: {
        Row: {
          bucket: string;
          count: number;
          user_id: string;
          window_start: string;
        };
        Insert: {
          bucket: string;
          count?: number;
          user_id: string;
          window_start: string;
        };
        Update: {
          bucket?: string;
          count?: number;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      stories: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          expires_at: string;
          id: string;
          image_url: string | null;
          title: string;
        };
        Insert: {
          author_id: string;
          body?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          image_url?: string | null;
          title?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          image_url?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      story_views: {
        Row: {
          story_id: string;
          viewed_at: string;
          viewer_id: string;
        };
        Insert: {
          story_id: string;
          viewed_at?: string;
          viewer_id: string;
        };
        Update: {
          story_id?: string;
          viewed_at?: string;
          viewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          chat_privacy: boolean;
          chats_visible: boolean;
          disappearing: boolean;
          enter_to_send: boolean;
          font_size: string;
          group_notifications: boolean;
          hide_message_previews: boolean;
          last_seen: boolean;
          message_sounds: boolean;
          profile_photo_privacy: string;
          read_receipts: boolean;
          stories_visible: boolean;
          story_notifications: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chat_privacy?: boolean;
          chats_visible?: boolean;
          disappearing?: boolean;
          enter_to_send?: boolean;
          font_size?: string;
          group_notifications?: boolean;
          hide_message_previews?: boolean;
          last_seen?: boolean;
          message_sounds?: boolean;
          profile_photo_privacy?: string;
          read_receipts?: boolean;
          stories_visible?: boolean;
          story_notifications?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chat_privacy?: boolean;
          chats_visible?: boolean;
          disappearing?: boolean;
          enter_to_send?: boolean;
          font_size?: string;
          group_notifications?: boolean;
          hide_message_previews?: boolean;
          last_seen?: boolean;
          message_sounds?: boolean;
          profile_photo_privacy?: string;
          read_receipts?: boolean;
          stories_visible?: boolean;
          story_notifications?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      active_suspension: { Args: never; Returns: string };
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean };
      bump_rate_limit: {
        Args: { _bucket: string; _window_seconds: number };
        Returns: number;
      };
      chats_visible_for: { Args: { _user_id: string }; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string };
        Returns: boolean;
      };
      is_moderator: { Args: { _user_id: string }; Returns: boolean };
      log_moderation_event: {
        Args: {
          _action: string;
          _categories: string[];
          _direction: string;
          _excerpt: string;
          _severity: string;
          _surface: string;
        };
        Returns: undefined;
      };
      match_knowledge_chunks: {
        Args: {
          match_count?: number;
          min_similarity?: number;
          query_embedding: string;
        };
        Returns: {
          chunk_id: string;
          chunk_index: number;
          content: string;
          document_id: string;
          similarity: number;
          title: string;
        }[];
      };
      recent_violation_count: { Args: { _hours?: number }; Returns: number };
      stories_visible_for: { Args: { _user_id: string }; Returns: boolean };
      suspend_self: {
        Args: { _hours: number; _reason: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const;
