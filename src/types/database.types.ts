export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          full_name: string;
          phone: string | null;
          gender: string | null;
          avatar_url: string | null;
          date_of_birth: string | null;
          address: string | null;
          address_lat: number | null;
          address_lng: number | null;
          onboarding_completed_at: string | null;
          notification_prefs: Json;
          /** Moderation — admin-controlled (see 20260825_admin_users_moderation.sql). */
          blocked_at: string | null;
          blocked_reason: string | null;
          blocked_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          full_name?: string;
          phone?: string | null;
          gender?: string | null;
          avatar_url?: string | null;
          date_of_birth?: string | null;
          address?: string | null;
          address_lat?: number | null;
          address_lng?: number | null;
          onboarding_completed_at?: string | null;
          notification_prefs?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          phone?: string | null;
          gender?: string | null;
          avatar_url?: string | null;
          date_of_birth?: string | null;
          address?: string | null;
          address_lat?: number | null;
          address_lng?: number | null;
          onboarding_completed_at?: string | null;
          notification_prefs?: Json;
        };
        Relationships: [];
      };
      shops: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          business_type: Database["public"]["Enums"]["business_type"];
          address: string;
          latitude: number | null;
          longitude: number | null;
          is_open: boolean;
          phone: string | null;
          logo_url: string | null;
          cover_image_url: string | null;
          about: string | null;
          weekly_hours: Json | null;
          accepted_payment_methods: string[];
          /** Verification lifecycle — admin-controlled (see 20260824_admin_panel.sql). */
          status: Database["public"]["Enums"]["shop_status"];
          verified_at: string | null;
          verified_by: string | null;
          status_reason: string | null;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          business_type?: Database["public"]["Enums"]["business_type"];
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          is_open?: boolean;
          phone?: string | null;
          logo_url?: string | null;
          cover_image_url?: string | null;
          about?: string | null;
          weekly_hours?: Json | null;
          accepted_payment_methods?: string[];
        };
        // status / verified_* / status_reason / is_featured are intentionally
        // absent here and in Insert: the shops_lock_status trigger rejects any
        // non-admin write to them, and admins go through admin_set_shop_status.
        Update: {
          name?: string;
          business_type?: Database["public"]["Enums"]["business_type"];
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          is_open?: boolean;
          phone?: string | null;
          logo_url?: string | null;
          cover_image_url?: string | null;
          about?: string | null;
          weekly_hours?: Json | null;
          accepted_payment_methods?: string[];
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          rate: number;
          default_duration_min: number;
          is_active: boolean;
          category: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          rate: number;
          default_duration_min: number;
          is_active?: boolean;
          category?: string | null;
          image_url?: string | null;
        };
        Update: {
          name?: string;
          rate?: number;
          default_duration_min?: number;
          is_active?: boolean;
          category?: string | null;
          image_url?: string | null;
        };
        Relationships: [];
      };
      offers: {
        Row: {
          id: string;
          shop_id: string;
          title: string;
          description: string | null;
          discount_pct: number;
          valid_until: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          title: string;
          description?: string | null;
          discount_pct: number;
          valid_until: string;
          active?: boolean;
        };
        Update: {
          title?: string;
          description?: string | null;
          discount_pct?: number;
          valid_until?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      shop_rating_summary: {
        Row: {
          shop_id: string;
          avg_rating: number;
          review_count: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      chairs: {
        Row: {
          id: string;
          shop_id: string;
          label: string;
          staff_name: string;
          is_active: boolean;
          sort_order: number;
          staff_avatar_url: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          label: string;
          staff_name?: string;
          is_active?: boolean;
          sort_order?: number;
          staff_avatar_url?: string | null;
          color?: string | null;
        };
        Update: {
          label?: string;
          staff_name?: string;
          is_active?: boolean;
          sort_order?: number;
          staff_avatar_url?: string | null;
          color?: string | null;
        };
        Relationships: [];
      };
      chair_service_stats: {
        Row: {
          chair_id: string;
          service_id: string;
          can_perform: boolean;
          rolling_avg_duration_min: number | null;
          completed_count: number;
          updated_at: string;
        };
        Insert: {
          chair_id: string;
          service_id: string;
          can_perform?: boolean;
        };
        Update: {
          can_perform?: boolean;
        };
        Relationships: [];
      };
      shop_gallery_images: {
        Row: {
          id: string;
          shop_id: string;
          path: string;
          url: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          path: string;
          url: string;
          sort_order?: number;
        };
        Update: {
          sort_order?: number;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          id: string;
          customer_id: string;
          shop_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          shop_id: string;
        };
        Update: never;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        };
        Update: never;
        Relationships: [];
      };
      serials: {
        Row: {
          id: string;
          shop_id: string;
          chair_id: string;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string | null;
          service_ids: string[];
          services_snapshot: Json;
          total_amount: number;
          status: Database["public"]["Enums"]["serial_status"];
          position: number;
          is_walk_in: boolean;
          assignment_mode: Database["public"]["Enums"]["assignment_mode"];
          estimated_duration_min: number;
          estimated_start_at: string | null;
          booked_at: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          advance_paid: boolean;
          advance_method: string | null;
          advance_txn_id: string | null;
          notified_two_ahead_at: string | null;
          notified_turn_at: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          due_amount: number;
          due_collected_at: string | null;
          due_reminded_at: string | null;
          payment_method: string | null;
          extended_min: number;
          customer_avatar_url: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          chair_id?: string | null;
          customer_id?: string | null;
          customer_name?: string;
          customer_phone?: string | null;
          service_ids: string[];
          is_walk_in?: boolean;
          advance_paid?: boolean;
          advance_method?: string | null;
          advance_txn_id?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
        };
        Update: {
          status?: Database["public"]["Enums"]["serial_status"];
          chair_id?: string;
          customer_phone?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          due_amount?: number;
          due_collected_at?: string | null;
          due_reminded_at?: string | null;
          payment_method?: string | null;
          extended_min?: number;
          estimated_duration_min?: number;
        };
        Relationships: [];
      };
      manual_entries: {
        Row: {
          id: string;
          shop_id: string;
          service_id: string;
          chair_id: string | null;
          amount: number;
          payment_method: string | null;
          payment_status: "PAID" | "DUE";
          note: string | null;
          customer_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          service_id: string;
          chair_id?: string | null;
          amount: number;
          payment_method?: string | null;
          payment_status?: "PAID" | "DUE";
          note?: string | null;
          customer_name?: string | null;
        };
        Update: {
          service_id?: string;
          chair_id?: string | null;
          amount?: number;
          payment_method?: string | null;
          payment_status?: "PAID" | "DUE";
          note?: string | null;
          customer_name?: string | null;
        };
        Relationships: [];
      };
      queue_public: {
        Row: {
          id: string;
          shop_id: string;
          chair_id: string;
          position: number;
          status: Database["public"]["Enums"]["serial_status"];
          is_walk_in: boolean;
          estimated_duration_min: number;
          estimated_start_at: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          shop_id: string;
          serial_id: string;
          customer_id: string;
          rating: number;
          comment: string | null;
          images: string[];
          chair_id: string | null;
          /** Moderation — set only by admin_set_review_hidden(). */
          hidden_at: string | null;
          hidden_reason: string | null;
          hidden_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          serial_id: string;
          customer_id: string;
          rating: number;
          comment?: string | null;
          images?: string[];
          chair_id?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      chair_rating_summary: {
        Row: {
          chair_id: string;
          avg_rating: number;
          review_count: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      regular_reminders: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string | null;
          customer_phone: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id?: string | null;
          customer_phone?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          sender_id: string;
          content: string | null;
          image_url: string | null;
          image_urls: string[] | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id: string;
          sender_id: string;
          content?: string | null;
          image_url?: string | null;
          image_urls?: string[] | null;
          is_read?: boolean;
        };
        Update: {
          is_read?: boolean;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          body: string;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: {
          read_at?: string | null;
        };
        Relationships: [];
      };
      admin_users: {
        Row: {
          user_id: string;
          level: Database["public"]["Enums"]["admin_level"];
          note: string | null;
          created_at: string;
        };
        /** Granting admin is a SQL-editor operation — no client write path. */
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: Database["public"]["Enums"]["report_target_type"];
          target_id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          note: string | null;
          status: Database["public"]["Enums"]["report_status"];
          resolved_by: string | null;
          resolved_at: string | null;
          resolution_note: string | null;
          created_at: string;
        };
        Insert: {
          reporter_id: string;
          target_type: Database["public"]["Enums"]["report_target_type"];
          target_id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          note?: string | null;
        };
        /** Triage happens through admin_resolve_report(). */
        Update: never;
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          meta: Json;
          created_at: string;
        };
        /**
         * No client can write this: there is no INSERT policy, so an anon-key
         * insert is rejected by RLS. The SQL RPCs write it through admin_log(),
         * and /api/admin/account writes it with the service role.
         */
        Insert: {
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          meta?: Json;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      assign_best_chair: {
        Args: { p_shop_id: string; p_service_ids: string[] };
        Returns: string | null;
      };
      estimate_duration_on_chair: {
        Args: { p_chair_id: string; p_service_ids: string[] };
        Returns: number;
      };
      chair_backlog_min: {
        Args: { p_chair_id: string };
        Returns: number;
      };
      is_shop_owner: {
        Args: { p_shop_id: string };
        Returns: boolean;
      };
      broadcast_shop_notification: {
        Args: {
          p_shop_id: string;
          p_target: "recent" | "regulars";
          p_title: string;
          p_body: string;
        };
        Returns: number;
      };
      send_due_reminder: {
        Args: { p_serial_id: string };
        Returns: void;
      };
      notification_enabled: {
        Args: { p_user_id: string; p_type: string };
        Returns: boolean;
      };
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
      is_platform_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      admin_level: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["admin_level"] | null;
      };
      /** Shape is narrowed by AdminOverviewStats in features/admin/api. */
      admin_overview_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_list_shops: {
        Args: {
          p_status?: Database["public"]["Enums"]["shop_status"] | null;
          p_business_type?: Database["public"]["Enums"]["business_type"] | null;
          p_search?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          name: string;
          business_type: Database["public"]["Enums"]["business_type"];
          address: string;
          status: Database["public"]["Enums"]["shop_status"];
          is_open: boolean;
          is_featured: boolean;
          logo_url: string | null;
          phone: string | null;
          created_at: string;
          verified_at: string | null;
          status_reason: string | null;
          owner_id: string;
          owner_name: string | null;
          owner_phone: string | null;
          chair_count: number;
          service_count: number;
          serials_30d: number;
          revenue_30d: number;
          avg_rating: number;
          review_count: number;
          last_serial_at: string | null;
          total_count: number;
        }[];
      };
      /** Shape is narrowed by AdminShopDetail in features/admin/api. */
      admin_shop_detail: {
        Args: { p_shop_id: string };
        Returns: Json;
      };
      admin_set_shop_status: {
        Args: {
          p_shop_id: string;
          p_status: Database["public"]["Enums"]["shop_status"];
          p_reason?: string | null;
        };
        Returns: void;
      };
      admin_set_shop_featured: {
        Args: { p_shop_id: string; p_featured: boolean };
        Returns: void;
      };
      is_user_blocked: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      admin_list_users: {
        Args: {
          p_role?: Database["public"]["Enums"]["user_role"] | null;
          p_blocked?: boolean | null;
          p_search?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          full_name: string;
          role: Database["public"]["Enums"]["user_role"];
          phone: string | null;
          email: string | null;
          avatar_url: string | null;
          created_at: string;
          blocked_at: string | null;
          blocked_reason: string | null;
          shop_id: string | null;
          shop_name: string | null;
          serials_total: number;
          no_shows: number;
          spend_total: number;
          due_total: number;
          reviews_count: number;
          reports_against: number;
          last_serial_at: string | null;
          total_count: number;
        }[];
      };
      /** Shape is narrowed by AdminUserDetail in features/admin/api. */
      admin_user_detail: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      admin_set_user_blocked: {
        Args: { p_user_id: string; p_blocked: boolean; p_reason?: string | null };
        Returns: void;
      };
      admin_list_reports: {
        Args: {
          p_status?: Database["public"]["Enums"]["report_status"] | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          target_type: Database["public"]["Enums"]["report_target_type"];
          target_id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          note: string | null;
          status: Database["public"]["Enums"]["report_status"];
          created_at: string;
          resolved_at: string | null;
          resolution_note: string | null;
          reporter_id: string;
          reporter_name: string | null;
          target_title: string | null;
          target_body: string | null;
          target_rating: number | null;
          target_hidden: boolean | null;
          target_owner_id: string | null;
          target_owner_name: string | null;
          shop_id: string | null;
          shop_name: string | null;
          total_count: number;
        }[];
      };
      admin_resolve_report: {
        Args: {
          p_report_id: string;
          p_status: Database["public"]["Enums"]["report_status"];
          p_note?: string | null;
        };
        Returns: void;
      };
      admin_set_review_hidden: {
        Args: { p_review_id: string; p_hidden: boolean; p_reason?: string | null };
        Returns: void;
      };
      admin_update_user_profile: {
        Args: {
          p_user_id: string;
          p_full_name?: string | null;
          p_phone?: string | null;
          p_gender?: string | null;
          p_date_of_birth?: string | null;
          p_address?: string | null;
        };
        Returns: void;
      };
      admin_force_cancel_serial: {
        Args: { p_serial_id: string; p_reason?: string | null };
        Returns: void;
      };
      /** Returns a summary of what the teardown touched. */
      admin_delete_user: {
        Args: { p_user_id: string; p_reason?: string | null };
        Returns: Json;
      };
    };
    Enums: {
      user_role: "customer" | "provider";
      serial_status: "WAITING" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "NO_SHOW";
      assignment_mode: "AUTO" | "CHOSEN" | "MANUAL";
      business_type: "SALON" | "PARLOUR" | "UNISEX";
      notification_type:
        | "SERIAL_CONFIRMED"
        | "QUEUE_UPDATE"
        | "YOUR_TURN"
        | "CANCELLED"
        | "PROMO"
        | "REMINDER"
        | "SYSTEM";
      payment_status: "PAID" | "DUE" | "ADVANCE";
      // shop_status / admin_level are CHECK constraints in Postgres rather than
      // real enum types; they live here so the app has one name for the values.
      shop_status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
      admin_level: "SUPER_ADMIN" | "MODERATOR" | "SUPPORT";
      report_target_type: "REVIEW" | "SHOP" | "MESSAGE" | "USER";
      report_reason: "SPAM" | "ABUSE" | "FAKE" | "INAPPROPRIATE" | "OTHER";
      report_status: "OPEN" | "RESOLVED" | "DISMISSED";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

// ---- standard helper generics (same as Supabase codegen emits) ----

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];