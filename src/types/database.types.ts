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
          /** Serves women only. Independent of business_type — see 20260916. */
          women_only: boolean;
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
          women_only?: boolean;
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
          women_only?: boolean;
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
      /** Per-beautician weekly schedule — see 20260919. */
      staff_working_hours: {
        Row: {
          chair_id: string;
          /** isodow: 1 = Monday .. 7 = Sunday. */
          weekday: number;
          start_time: string;
          end_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          chair_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Update: { start_time?: string; end_time?: string };
        Relationships: [];
      };
      /** A period one beautician is unavailable — see 20260919. */
      staff_time_off: {
        Row: {
          id: string;
          chair_id: string;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chair_id: string;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
        };
        Update: { starts_at?: string; ends_at?: string; reason?: string | null };
        Relationships: [];
      };
      /** Written only by the appointments AFTER UPDATE trigger — read-only. */
      appointment_reschedules: {
        Row: {
          id: string;
          appointment_id: string;
          from_starts_at: string;
          from_ends_at: string;
          from_staff_id: string;
          to_starts_at: string;
          to_ends_at: string;
          to_staff_id: string;
          moved_by: string | null;
          moved_at: string;
          reason: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** Beauty parlour bookings — see 20260918_appointment_core.sql. */
      appointments: {
        Row: {
          id: string;
          shop_id: string;
          /** A chairs row is the seat and its beautician both. */
          staff_id: string;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string | null;
          customer_avatar_url: string | null;
          service_ids: string[];
          services_snapshot: Json;
          starts_at: string;
          ends_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          total_amount: number;
          payment_status: Database["public"]["Enums"]["payment_status"];
          due_amount: number;
          due_collected_at: string | null;
          payment_method: string | null;
          advance_paid: boolean;
          advance_method: string | null;
          advance_txn_id: string | null;
          is_walk_in: boolean;
          notes: string | null;
          booked_at: string;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancel_reason: string | null;
          /** Sprint 5 reminder seam. */
          reminded_at: string | null;
          /** Stamped on the move to DONE — the date income counts against. */
          completed_at: string | null;
          due_reminded_at: string | null;
        };
        // ends_at, total_amount, services_snapshot, status and the customer
        // snapshot are all computed by appointment_before_insert. Prefer the
        // book_appointment() RPC, which supplies the placeholder ends_at.
        Insert: {
          id?: string;
          shop_id: string;
          staff_id: string;
          customer_id?: string | null;
          customer_name?: string;
          customer_phone?: string | null;
          service_ids: string[];
          starts_at: string;
          ends_at: string;
          is_walk_in?: boolean;
          notes?: string | null;
        };
        // Booking-time columns are force-reset by appointment_before_update,
        // so they are deliberately absent here — including starts_at/ends_at/
        // staff_id, which would be a reschedule (not this sprint).
        Update: {
          status?: Database["public"]["Enums"]["appointment_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          due_amount?: number;
          due_collected_at?: string | null;
          payment_method?: string | null;
          customer_phone?: string | null;
          notes?: string | null;
          cancel_reason?: string | null;
        };
        // completed_at is absent on purpose: the trigger stamps it on DONE and
        // then freezes it, so no client can move an appointment's income to
        // another month.
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
      /**
       * One shop's membership programme (20260921).
       *
       * Business-scoped, not booking-model-scoped: a salon and a parlour sell
       * memberships out of this one table. `shop_id` is absent from Update
       * because `membership_tier_touch()` freezes it — a tier cannot be moved
       * to another shop without making its members' history a lie.
       */
      membership_tiers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          description: string | null;
          price: number;
          duration_days: number;
          /** `MembershipBenefit[]` — see `parseBenefits()` in `src/types`. */
          benefits: Json;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          description?: string | null;
          price: number;
          duration_days: number;
          benefits?: Json;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          price?: number;
          duration_days?: number;
          benefits?: Json;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      /**
       * Who is a member of which shop (20260921).
       *
       * Insert carries only what a client may send: the trigger computes
       * `price`, `duration_days` and `tier_snapshot` from the tier row, and
       * refuses a `payment_status` from anyone but the shop owner.
       *
       * Update is deliberately narrow. `price`, `duration_days`,
       * `tier_snapshot`, `started_at` and `expires_at` are all frozen by
       * `membership_before_update()` — renewal is a new row, never a stretched
       * one — so they are absent here rather than silently ignored.
       */
      customer_memberships: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          tier_id: string;
          status: Database["public"]["Enums"]["membership_status"];
          /** Snapshotted from `profiles` by the trigger — `profiles` has no cross-user read policy. */
          customer_name: string;
          customer_phone: string | null;
          customer_avatar_url: string | null;
          /** Frozen at enrollment: `{tier_id, name, description, price, duration_days, benefits}`. */
          tier_snapshot: Json;
          price: number;
          duration_days: number;
          payment_status: "PAID" | "DUE";
          payment_method: string | null;
          paid_at: string | null;
          started_at: string | null;
          expires_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancel_reason: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id: string;
          tier_id: string;
          /** Only PENDING or ACTIVE; a customer's RLS policy allows PENDING only. */
          status?: Database["public"]["Enums"]["membership_status"];
          /** Owner-only — the trigger forces DUE for anyone else. */
          payment_status?: "PAID" | "DUE";
          payment_method?: string | null;
          note?: string | null;
        };
        Update: {
          status?: Database["public"]["Enums"]["membership_status"];
          payment_status?: "PAID" | "DUE";
          payment_method?: string | null;
          cancel_reason?: string | null;
          note?: string | null;
        };
        Relationships: [];
      };
      /**
       * One shop's loyalty programme (20260922).
       *
       * `shop_id` is the primary key — one programme per shop, no row means
       * never configured, and `is_enabled = false` means switched off. Both
       * read as "invisible" to the UI (decision 36). Absent from Update
       * because `loyalty_settings_touch()` freezes it.
       */
      loyalty_settings: {
        Row: {
          shop_id: string;
          is_enabled: boolean;
          /** How many taka of bill earn one point. Owner-legible direction. */
          taka_per_point: number;
          min_bill_taka: number;
          /**
           * Referral (20260923). A referral reward *is* a loyalty point, so
           * the programme is live only when `is_enabled` is true as well —
           * read it through `referral_is_live()` or `isReferralLive()`, never
           * on its own.
           */
          referral_enabled: boolean;
          referral_referrer_points: number;
          referral_referred_points: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          shop_id: string;
          is_enabled?: boolean;
          taka_per_point?: number;
          min_bill_taka?: number;
          referral_enabled?: boolean;
          referral_referrer_points?: number;
          referral_referred_points?: number;
        };
        Update: {
          is_enabled?: boolean;
          taka_per_point?: number;
          min_bill_taka?: number;
          referral_enabled?: boolean;
          referral_referrer_points?: number;
          referral_referred_points?: number;
        };
        Relationships: [];
      };
      /**
       * Points, owned by the (shop, customer) pair (decision 33).
       *
       * **Insert and Update are `never` on purpose.** The table has no INSERT
       * or UPDATE RLS policy at all (decision 32): balances move only inside
       * `loyalty_award()` / `loyalty_adjust()`, each of which writes a ledger
       * row in the same transaction. Typing them as `never` makes an attempt
       * to write directly a compile error rather than a silent RLS refusal.
       */
      loyalty_accounts: {
        Row: {
          shop_id: string;
          customer_id: string;
          balance: number;
          /** Only ever grows — "what they have earned", not what is left. */
          lifetime_earned: number;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /**
       * The loyalty ledger — the single source of truth (20260922).
       *
       * Balance is a cache of `sum(points)` here. Read-only to every client:
       * no INSERT/UPDATE/DELETE policy, so history can neither be forged nor
       * dropped, exactly like `appointment_reschedules`.
       */
      loyalty_transactions: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          /** Positive = earned, negative = spent or corrected. Never 0. */
          points: number;
          /**
           * The two REFERRAL kinds arrived with 20260923 — referral rewards
           * live in *this* ledger rather than a parallel one, so the balance
           * stays exactly `sum(points)`.
           */
          kind:
            | "EARN_SERIAL"
            | "EARN_APPOINTMENT"
            | "ADJUST"
            | "REFERRAL_REFERRER"
            | "REFERRAL_REFERRED";
          source_serial_id: string | null;
          source_appointment_id: string | null;
          source_referral_id: string | null;
          /** Snapshot: the bill and the rate that produced these points. */
          bill_amount: number | null;
          taka_per_point: number | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /**
       * A customer's referral code at one shop (20260923).
       *
       * The primary key is `(shop_id, customer_id)`, not `customer_id`: the
       * plan's decision 34 sketched a global code, but a shop-scoped one makes
       * "shop B's code does nothing at shop A" a fact about the row rather
       * than a condition inside an RPC, and it keeps the claim step on the
       * shop's own page so the auth flow needed no redesign.
       *
       * `Insert`/`Update` are `never`: there is no write policy at all, and
       * codes are minted only inside `my_referral_code()`, so nobody can pick
       * a vanity code or mint one in someone else's name.
       */
      referral_codes: {
        Row: {
          shop_id: string;
          customer_id: string;
          /** Upper-case, 6–12 chars, no 0/O/1/I/L. Globally unique. */
          code: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /**
       * Who brought whom, at one shop (20260923).
       *
       * `PENDING` until the referred customer actually completes a booking —
       * entering a code earns nothing. Read-only to every client: `PENDING →
       * CONVERTED` happens only inside `referral_convert()`, and
       * `referrals_freeze_history()` makes the conversion final even for a
       * future DEFINER function.
       */
      referrals: {
        Row: {
          id: string;
          shop_id: string;
          referrer_id: string;
          referred_id: string;
          /** Snapshot of the code as used, so history survives a reissue. */
          code: string;
          status: Database["public"]["Enums"]["referral_status"];
          qualifying_serial_id: string | null;
          qualifying_appointment_id: string | null;
          /** Null while PENDING; both set, possibly 0, once CONVERTED. */
          referrer_points: number | null;
          referred_points: number | null;
          converted_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
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
      hairstyles: {
        Row: {
          id: string;
          kind: "HAIR" | "BEARD";
          slug: string;
          name_bn: string;
          name_en: string;
          description_bn: string;
          description_en: string;
          /** English-only: read by the AI advisor, never rendered. */
          suits_notes_en: string;
          reference_image_url: string | null;
          /** Transparent PNG laid over the customer's photo. */
          overlay_image_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: "HAIR" | "BEARD";
          slug: string;
          name_bn: string;
          name_en: string;
          description_bn: string;
          description_en: string;
          suits_notes_en: string;
          reference_image_url?: string | null;
          overlay_image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          kind?: "HAIR" | "BEARD";
          name_bn?: string;
          name_en?: string;
          description_bn?: string;
          description_en?: string;
          suits_notes_en?: string;
          reference_image_url?: string | null;
          overlay_image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      serial_style_preferences: {
        Row: {
          serial_id: string;
          hairstyle_id: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          serial_id: string;
          hairstyle_id: string;
          note?: string | null;
        };
        Update: {
          hairstyle_id?: string;
          note?: string | null;
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
      shop_available_slots: {
        Args: {
          p_shop_id: string;
          p_date: string;
          p_service_ids: string[];
          p_staff_id?: string | null;
        };
        Returns: {
          staff_id: string;
          staff_name: string;
          slot_start: string;
          slot_end: string;
        }[];
      };
      reschedule_appointment: {
        Args: {
          p_appointment_id: string;
          p_starts_at: string;
          p_staff_id?: string | null;
          p_reason?: string | null;
        };
        Returns: string;
      };
      staff_is_available: {
        Args: { p_chair_id: string; p_starts_at: string; p_ends_at: string };
        Returns: string;
      };
      send_appointment_due_reminder: {
        Args: { p_appointment_id: string };
        Returns: undefined;
      };
      /**
       * The one door for "is this person a member of this shop right now"
       * (20260921). Checks `expires_at` itself, so a lapsed membership never
       * reads as active even before the nightly job has flipped it.
       */
      membership_is_active: {
        Args: { p_shop_id: string; p_customer_id: string };
        Returns: boolean;
      };
      /** Nightly tidy-up — flips lapsed ACTIVE memberships to EXPIRED. */
      expire_memberships: {
        Args: Record<string, never>;
        Returns: number;
      };
      /**
       * Points a bill earns: `floor(bill / taka_per_point)`, 0 below
       * `min_bill`. Mirrored in `src/features/loyalty/lib/loyalty.ts`.
       */
      points_for_bill: {
        Args: { p_bill: number; p_taka_per_point: number; p_min_bill?: number };
        Returns: number;
      };
      /**
       * The only door for adding points. Owner-only (checked by hand, since
       * the tables have no write policy). Returns the new balance.
       */
      loyalty_award: {
        Args: {
          p_shop_id: string;
          p_customer_id: string;
          p_points: number;
          p_kind: "EARN_SERIAL" | "EARN_APPOINTMENT";
          p_serial_id?: string | null;
          p_appointment_id?: string | null;
          p_bill_amount?: number | null;
          p_taka_per_point?: number | null;
          p_note?: string | null;
        };
        Returns: number;
      };
      /** Owner's manual correction, positive or negative. New balance back. */
      loyalty_adjust: {
        Args: {
          p_shop_id: string;
          p_customer_id: string;
          p_points: number;
          p_note?: string | null;
        };
        Returns: number;
      };
      /**
       * The signed-in customer's point cards — one row per shop, never a
       * total (decision 33). `auth.uid()` is hard-coded inside it.
       */
      my_loyalty_accounts: {
        Args: Record<string, never>;
        Returns: {
          shop_id: string;
          shop_name: string;
          shop_logo_url: string | null;
          business_type: string;
          balance: number;
          lifetime_earned: number;
          taka_per_point: number;
          is_enabled: boolean;
          last_earned_at: string | null;
        }[];
      };
      /**
       * Is this shop's referral programme live? True only when loyalty *and*
       * referral are both switched on, because a referral reward is a loyalty
       * point. Mirrored in `src/features/referral/lib/referral.ts`.
       */
      referral_is_live: {
        Args: { p_shop_id: string };
        Returns: boolean;
      };
      /**
       * The signed-in customer's code at one shop, minted on first ask.
       * `auth.uid()` is hard-coded, so no code can be created in anyone
       * else's name.
       */
      my_referral_code: {
        Args: { p_shop_id: string };
        Returns: string;
      };
      /**
       * Records a PENDING referral. Deliberately awards nothing — the reward
       * lands only when the referred customer completes a booking. Returns
       * the new referral's id.
       */
      claim_referral: {
        Args: { p_shop_id: string; p_code: string };
        Returns: string;
      };
      /**
       * Qualifies a PENDING referral against one completed booking and pays
       * both sides in the same transaction. The DONE triggers call this; the
       * app never needs to. Returns the total points awarded.
       */
      referral_convert: {
        Args: {
          p_referral_id: string;
          p_serial_id?: string | null;
          p_appointment_id?: string | null;
        };
        Returns: number;
      };
      /**
       * Credits one side of a converted referral. Takes no amount and no
       * customer — both are read from the referral row, so even the shop
       * owner cannot inflate or redirect a reward.
       */
      referral_award_points: {
        Args: { p_referral_id: string; p_side: "REFERRER" | "REFERRED" };
        Returns: number;
      };
      /**
       * The signed-in customer's own referrals at one shop. `auth.uid()` is
       * hard-coded; the referred person's name comes back shortened to its
       * first word.
       */
      my_referrals: {
        Args: { p_shop_id: string };
        Returns: {
          id: string;
          referred_name: string;
          status: Database["public"]["Enums"]["referral_status"];
          points_earned: number;
          converted_at: string | null;
          created_at: string;
        }[];
      };
      /** Who brought how many, for one shop only. Owner-guarded first line. */
      shop_referral_stats: {
        Args: { p_shop_id: string };
        Returns: {
          referrer_id: string;
          referrer_name: string;
          code: string;
          total_referrals: number;
          converted_count: number;
          pending_count: number;
          points_awarded: number;
          last_referral_at: string | null;
        }[];
      };
      shop_membership_summary: {
        Args: { p_shop_id: string };
        Returns: {
          active_count: number;
          pending_count: number;
          expiring_soon: number;
          unpaid_count: number;
        }[];
      };
      send_appointment_reminders: {
        Args: { p_within_hours?: number };
        Returns: number;
      };
      book_appointment: {
        Args: {
          p_shop_id: string;
          p_staff_id: string;
          p_service_ids: string[];
          p_starts_at: string;
          p_customer_name?: string | null;
          p_customer_phone?: string | null;
          p_is_walk_in?: boolean;
          p_notes?: string | null;
        };
        Returns: string;
      };
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
      /**
       * `customer_memberships.status` — a text column with a CHECK, like every
       * other status in this schema (decision 45). PENDING exists because
       * there is no real payment gateway: a customer requests, the owner takes
       * the money and activates.
       */
      membership_status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
      /**
       * `referrals.status` — a text column with a CHECK, like every other
       * status here (decision 45). Two values, not the plan's four: the
       * reward is paid in the same transaction as the qualification, so
       * QUALIFIED and REWARDED could never differ, and nothing in Sprint 8
       * can set a VOID.
       */
      referral_status: "PENDING" | "CONVERTED";
      appointment_status:
        | "BOOKED"
        | "CONFIRMED"
        | "IN_PROGRESS"
        | "DONE"
        | "CANCELLED"
        | "NO_SHOW";
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