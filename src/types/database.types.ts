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
          onboarding_completed_at: string | null;
          notification_prefs: Json;
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
        };
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
        | "REMINDER";
      payment_status: "PAID" | "DUE" | "ADVANCE";
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