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
          /** Three-state availability — see 20260827_wait_reality.sql. */
          accepting_new: boolean;
          break_until: string | null;
          break_reason: string | null;
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
          accepting_new?: boolean;
          // break_until / break_reason go through set_shop_break() so every
          // chair's ETA is recomputed in the same call.
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
          /** Staff's cut of what they bring in, 0–100. 0 = salaried. */
          commission_pct: number;
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
          commission_pct?: number;
        };
        Update: {
          label?: string;
          staff_name?: string;
          is_active?: boolean;
          sort_order?: number;
          staff_avatar_url?: string | null;
          color?: string | null;
          commission_pct?: number;
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
          /** Standing wait alert — NULL is an ordinary bookmark (20260831_retention.sql). */
          wait_alert_min: number | null;
          alerted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          shop_id: string;
          wait_alert_min?: number | null;
        };
        // alerted_at is the rate-limit stamp, written only by notify_shop_wait_drop().
        Update: {
          wait_alert_min?: number | null;
        };
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
          /** Wait-reality columns — see 20260827_wait_reality.sql. */
          arrived_at: string | null;
          called_at: string | null;
          travel_min: number | null;
          notified_leave_at: string | null;
          /** Party booking — see 20260828_group_booking.sql. NULL group_id = solo. */
          group_id: string | null;
          party_seq: number | null;
          party_member_name: string | null;
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
          /** Captured once at booking time; frozen by serial_before_update afterwards. */
          travel_min?: number | null;
          // group_id / party_seq / party_member_name are absent on purpose:
          // parties are created only through create_group_booking(), so a
          // half-inserted party can't exist.
        };
        // arrived_at / called_at are set only through mark_serial_arrived() and
        // mark_serial_called() — the customer's own UPDATE policy can't reach
        // them, and routing the provider through the RPC is what fires the
        // "you've been called" notification.
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
      customer_reminders: {
        Row: {
          id: string;
          customer_id: string;
          shop_id: string | null;
          interval_days: number;
          next_at: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          shop_id?: string | null;
          interval_days: number;
          next_at: string;
          active?: boolean;
        };
        Update: {
          shop_id?: string | null;
          interval_days?: number;
          next_at?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      shop_expenses: {
        Row: {
          id: string;
          shop_id: string;
          category: Database["public"]["Enums"]["expense_category"];
          amount: number;
          note: string | null;
          /** The day the money was for, not the day it was typed in. */
          spent_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          category: Database["public"]["Enums"]["expense_category"];
          amount: number;
          note?: string | null;
          spent_on?: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["expense_category"];
          amount?: number;
          note?: string | null;
          spent_on?: string;
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
          /** The shop's public answer — written only by set_review_reply(). */
          owner_reply: string | null;
          owner_replied_at: string | null;
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
          /**
           * Name and email live here, not on profiles: an admin provisioned
           * from the panel has no profiles row at all (see
           * 20260901_admin_identity.sql), which is what keeps it from being a
           * customer or a shop owner.
           */
          full_name: string | null;
          email: string | null;
          status: Database["public"]["Enums"]["admin_status"];
          created_by: string | null;
          updated_at: string;
        };
        /** Provisioning goes through admin_provision_admin() — no client write path. */
        Insert: never;
        Update: never;
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          category: Database["public"]["Enums"]["support_category"];
          subject: string;
          status: Database["public"]["Enums"]["support_status"];
          assigned_to: string | null;
          last_message_at: string;
          admin_read_at: string | null;
          user_read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        /** Opened by create_support_ticket() so the first message lands with it. */
        Insert: never;
        Update: never;
        Relationships: [];
      };
      support_ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_id: string | null;
          is_staff: boolean;
          is_internal: boolean;
          body: string;
          images: string[];
          created_at: string;
        };
        /** Written by add_support_message() / admin_reply_ticket(). */
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
      /** 20260906 — chair removal decided in SQL, not by two client DELETEs. */
      delete_chair: {
        Args: { p_chair_id: string };
        Returns: { deleted: boolean; reason: string; serials?: number };
      };
      set_chair_active: {
        Args: { p_chair_id: string; p_active: boolean };
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
      admin_recent_shops: {
        Args: { p_days?: number; p_limit?: number };
        Returns: Json;
      };
      admin_audit_feed: {
        Args: { p_action?: string | null; p_limit?: number; p_offset?: number };
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
      mark_serial_arrived: {
        Args: { p_serial_id: string };
        Returns: void;
      };
      mark_serial_called: {
        Args: { p_serial_id: string };
        Returns: void;
      };
      bump_serial_back: {
        Args: { p_serial_id: string };
        Returns: void;
      };
      set_shop_break: {
        Args: { p_shop_id: string; p_minutes: number; p_reason?: string | null };
        Returns: string | null;
      };
      create_group_booking: {
        Args: {
          p_shop_id: string;
          p_members: Json;
          p_chair_id?: string | null;
          p_travel_min?: number | null;
        };
        /** The new group_id. */
        Returns: string;
      };
      cancel_my_group: {
        Args: { p_group_id: string };
        /** How many serials were cancelled. */
        Returns: number;
      };
      settle_group_dues: {
        Args: { p_group_id: string; p_method: string };
        /** How many outstanding party serials were settled. */
        Returns: number;
      };
      /** Public, unauthenticated read for the counter display. Null = no ACTIVE shop. */
      shop_display_board: {
        Args: { p_shop_id: string };
        Returns: Json;
      };
      set_review_reply: {
        Args: { p_review_id: string; p_reply: string | null };
        Returns: void;
      };
      /**
       * Service-role only (not granted to `authenticated`) — it walks every
       * shop on the platform. Called by the nightly cron route.
       */
      shop_current_wait: {
        Args: { p_shop_id: string };
        Returns: number;
      };
      /** Service-role only — walks every customer. Called by the nightly cron route. */
      send_customer_reminders: {
        Args: Record<string, never>;
        Returns: number;
      };
      send_daily_summaries: {
        Args: { p_day?: string | null };
        /** How many summaries were sent. */
        Returns: number;
      };
      /** Capability check; levels map to capabilities inside the function. */
      admin_can: {
        Args: { p_permission: string };
        Returns: boolean;
      };
      my_admin_identity: {
        Args: Record<PropertyKey, never>;
        Returns: {
          user_id: string;
          full_name: string | null;
          email: string | null;
          level: Database["public"]["Enums"]["admin_level"];
          status: Database["public"]["Enums"]["admin_status"];
        }[];
      };
      admin_list_admins: {
        Args: Record<PropertyKey, never>;
        Returns: {
          user_id: string;
          full_name: string | null;
          email: string | null;
          level: Database["public"]["Enums"]["admin_level"];
          status: Database["public"]["Enums"]["admin_status"];
          created_at: string;
          created_by: string | null;
          last_sign_in: string | null;
        }[];
      };
      admin_set_admin_status: {
        Args: {
          p_user_id: string;
          p_status: Database["public"]["Enums"]["admin_status"];
        };
        Returns: void;
      };
      admin_set_admin_level: {
        Args: {
          p_user_id: string;
          p_level: Database["public"]["Enums"]["admin_level"];
        };
        Returns: void;
      };
      admin_revoke_admin: {
        Args: { p_user_id: string };
        Returns: void;
      };
      /**
       * service_role only — creating the auth.users row is the Admin API's
       * job, so this is called from /api/admin/admins, never from a browser.
       */
      admin_provision_admin: {
        Args: {
          p_actor: string;
          p_user_id: string;
          p_full_name: string;
          p_email: string;
          p_level: Database["public"]["Enums"]["admin_level"];
        };
        Returns: void;
      };
      create_support_ticket: {
        Args: {
          p_category: Database["public"]["Enums"]["support_category"];
          p_subject: string;
          p_body: string;
          p_images?: string[];
        };
        /** The new ticket's id. */
        Returns: string;
      };
      add_support_message: {
        Args: { p_ticket_id: string; p_body: string; p_images?: string[] };
        Returns: string;
      };
      mark_support_ticket_read: {
        Args: { p_ticket_id: string };
        Returns: void;
      };
      my_support_tickets: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          category: Database["public"]["Enums"]["support_category"];
          subject: string;
          status: Database["public"]["Enums"]["support_status"];
          created_at: string;
          last_message_at: string;
          message_count: number;
          last_preview: string | null;
          has_unread: boolean;
        }[];
      };
      admin_list_tickets: {
        Args: {
          p_status?: Database["public"]["Enums"]["support_status"] | null;
          p_search?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          user_id: string;
          user_name: string | null;
          user_email: string | null;
          user_role: Database["public"]["Enums"]["user_role"] | null;
          category: Database["public"]["Enums"]["support_category"];
          subject: string;
          status: Database["public"]["Enums"]["support_status"];
          created_at: string;
          last_message_at: string;
          message_count: number;
          last_preview: string | null;
          needs_reply: boolean;
          total_count: number;
        }[];
      };
      admin_ticket_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          pending: number;
          in_progress: number;
          solved: number;
          closed: number;
        }[];
      };
      admin_reply_ticket: {
        Args: {
          p_ticket_id: string;
          p_body: string;
          p_images?: string[];
          p_internal?: boolean;
        };
        Returns: string;
      };
      admin_set_ticket_status: {
        Args: {
          p_ticket_id: string;
          p_status: Database["public"]["Enums"]["support_status"];
        };
        Returns: void;
      };
      admin_mark_ticket_read: {
        Args: { p_ticket_id: string };
        Returns: void;
      };
    };
    Enums: {
      user_role: "customer" | "provider";
      serial_status: "WAITING" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "NO_SHOW";
      assignment_mode: "AUTO" | "CHOSEN" | "MANUAL";
      business_type: "SALON" | "PARLOUR" | "UNISEX";
      expense_category: "RENT" | "UTILITY" | "SUPPLIES" | "STAFF" | "OTHER";
      notification_type:
        | "SERIAL_CONFIRMED"
        | "QUEUE_UPDATE"
        | "YOUR_TURN"
        | "CANCELLED"
        | "PROMO"
        | "REMINDER"
        | "SYSTEM"
        | "NEW_BOOKING"
        | "LEAVE_NOW"
        | "DAILY_SUMMARY"
        | "WAIT_ALERT";
      payment_status: "PAID" | "DUE" | "ADVANCE";
      // shop_status / admin_level are CHECK constraints in Postgres rather than
      // real enum types; they live here so the app has one name for the values.
      shop_status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
      admin_level: "SUPER_ADMIN" | "MODERATOR" | "SUPPORT";
      admin_status: "ACTIVE" | "DISABLED";
      support_category:
        | "BOOKING"
        | "PAYMENT"
        | "ACCOUNT"
        | "SHOP"
        | "TECHNICAL"
        | "OTHER";
      support_status: "PENDING" | "IN_PROGRESS" | "SOLVED" | "CLOSED";
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