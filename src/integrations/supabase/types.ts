export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json;
          entity: string | null;
          entity_id: string | null;
          id: string;
          ip_address: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          ip_address?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          ip_address?: string | null;
        };
        Relationships: [];
      };
      badge_definitions: {
        Row: {
          auto_rule: string | null;
          created_at: string;
          description: string;
          icon: string;
          id: string;
          is_active: boolean;
          name: string;
          rule: string | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          auto_rule?: string | null;
          created_at?: string;
          description: string;
          icon?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          rule?: string | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          auto_rule?: string | null;
          created_at?: string;
          description?: string;
          icon?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          rule?: string | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          activation_window_minutes: number;
          audience_segment: string | null;
          benefit_type: string;
          campaign_kind: string;
          counts_for_fofocometro: boolean;
          counts_for_funnel: boolean;
          created_at: string;
          description: string | null;
          discount_max_cents: number | null;
          discount_type: string | null;
          discount_value: number | null;
          discount_percent: number | null;
          ends_at: string | null;
          event_id: string | null;
          feed_priority: number;
          feed_visible: boolean;
          home_sort_order: number | null;
          home_visible: boolean;
          redemption_mode: string;
          external_url: string | null;
          external_button_label: string;
          external_open_new_tab: boolean;
          fixed_off_cents: number | null;
          id: string;
          instructions: string | null;
          is_pinned: boolean;
          internal_rules: string | null;
          name: string;
          per_user_limit: number;
          product_category: string | null;
          product_id: string | null;
          product_name: string | null;
          progression_rule: Json;
          public_copy: string | null;
          public_rules: string | null;
          public_title: string | null;
          required_badge_id: string | null;
          requires_checkin: boolean;
          requires_min_profile: boolean;
          requires_staff_validation: boolean;
          redemption_window_minutes: number;
          reward_valid_hours: number;
          stacking_allowed: boolean;
          starts_at: string;
          status: string;
          total_available: number | null;
          trigger_category: string | null;
          trigger_target: number;
          trigger_type: string;
          eligible_quantity_mode: string;
          updated_at: string;
          used_count: number;
          visit_scope: string;
        };
        Insert: {
          activation_window_minutes?: number;
          audience_segment?: string | null;
          benefit_type: string;
          campaign_kind?: string;
          counts_for_fofocometro?: boolean;
          counts_for_funnel?: boolean;
          created_at?: string;
          description?: string | null;
          discount_max_cents?: number | null;
          discount_type?: string | null;
          discount_value?: number | null;
          discount_percent?: number | null;
          ends_at?: string | null;
          event_id?: string | null;
          feed_priority?: number;
          feed_visible?: boolean;
          home_sort_order?: number | null;
          home_visible?: boolean;
          redemption_mode?: string;
          external_url?: string | null;
          external_button_label?: string;
          external_open_new_tab?: boolean;
          fixed_off_cents?: number | null;
          id?: string;
          instructions?: string | null;
          is_pinned?: boolean;
          internal_rules?: string | null;
          name: string;
          per_user_limit?: number;
          product_category?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          progression_rule?: Json;
          public_copy?: string | null;
          public_rules?: string | null;
          public_title?: string | null;
          required_badge_id?: string | null;
          requires_checkin?: boolean;
          requires_min_profile?: boolean;
          requires_staff_validation?: boolean;
          redemption_window_minutes?: number;
          reward_valid_hours?: number;
          stacking_allowed?: boolean;
          starts_at?: string;
          status?: string;
          total_available?: number | null;
          trigger_category?: string | null;
          trigger_target?: number;
          trigger_type?: string;
          eligible_quantity_mode?: string;
          updated_at?: string;
          used_count?: number;
          visit_scope?: string;
        };
        Update: {
          activation_window_minutes?: number;
          audience_segment?: string | null;
          benefit_type?: string;
          campaign_kind?: string;
          counts_for_fofocometro?: boolean;
          counts_for_funnel?: boolean;
          created_at?: string;
          description?: string | null;
          discount_max_cents?: number | null;
          discount_type?: string | null;
          discount_value?: number | null;
          discount_percent?: number | null;
          ends_at?: string | null;
          event_id?: string | null;
          feed_priority?: number;
          feed_visible?: boolean;
          home_sort_order?: number | null;
          home_visible?: boolean;
          redemption_mode?: string;
          external_url?: string | null;
          external_button_label?: string;
          external_open_new_tab?: boolean;
          fixed_off_cents?: number | null;
          id?: string;
          instructions?: string | null;
          is_pinned?: boolean;
          internal_rules?: string | null;
          name?: string;
          per_user_limit?: number;
          product_category?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          progression_rule?: Json;
          public_copy?: string | null;
          public_rules?: string | null;
          public_title?: string | null;
          required_badge_id?: string | null;
          requires_checkin?: boolean;
          requires_min_profile?: boolean;
          requires_staff_validation?: boolean;
          redemption_window_minutes?: number;
          reward_valid_hours?: number;
          stacking_allowed?: boolean;
          starts_at?: string;
          status?: string;
          total_available?: number | null;
          trigger_category?: string | null;
          trigger_target?: number;
          trigger_type?: string;
          eligible_quantity_mode?: string;
          updated_at?: string;
          used_count?: number;
          visit_scope?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_link_clicks: {
        Row: {
          campaign_id: string;
          clicked_at: string;
          id: string;
          source: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          campaign_id: string;
          clicked_at?: string;
          id?: string;
          source?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          campaign_id?: string;
          clicked_at?: string;
          id?: string;
          source?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_link_clicks_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      checkins: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          method: string;
          notes: string | null;
          staff_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          method?: string;
          notes?: string | null;
          staff_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          method?: string;
          notes?: string | null;
          staff_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checkins_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_chat_blocks: {
        Row: {
          blocked_user_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          blocked_user_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          blocked_user_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      event_chat_messages: {
        Row: {
          body: string;
          created_at: string;
          deleted_at: string | null;
          event_id: string;
          id: string;
          moderated_by: string | null;
          moderation_reason: string | null;
          reply_to: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          event_id: string;
          id?: string;
          moderated_by?: string | null;
          moderation_reason?: string | null;
          reply_to?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          event_id?: string;
          id?: string;
          moderated_by?: string | null;
          moderation_reason?: string | null;
          reply_to?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_chat_messages_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_chat_reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          message_id: string;
          reason: string;
          reporter_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          message_id: string;
          reason: string;
          reporter_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          message_id?: string;
          reason?: string;
          reporter_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_chat_reports_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "event_chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          attraction: string | null;
          category: string;
          chat_closes_at: string | null;
          chat_enabled: boolean;
          chat_opens_at: string | null;
          checkin_closes_at: string | null;
          checkin_enabled: boolean;
          geofence_radius_m: number;
          geolocation_checkin_enabled: boolean;
          checkin_opens_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          experience_type: string;
          public_visible: boolean;
          id: string;
          image_url: string | null;
          max_location_accuracy_m: number;
          instructions: string | null;
          name: string;
          slug: string;
          starts_at: string;
          status: string;
          updated_at: string;
          venue_address: string | null;
          venue_google_place_id: string | null;
          venue_id: string | null;
          venue_latitude: number | null;
          venue_longitude: number | null;
          venue_name: string | null;
        };
        Insert: {
          attraction?: string | null;
          category: string;
          chat_closes_at?: string | null;
          chat_enabled?: boolean;
          chat_opens_at?: string | null;
          checkin_closes_at?: string | null;
          checkin_enabled?: boolean;
          geofence_radius_m?: number;
          geolocation_checkin_enabled?: boolean;
          checkin_opens_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          experience_type?: string;
          public_visible?: boolean;
          id?: string;
          image_url?: string | null;
          max_location_accuracy_m?: number;
          instructions?: string | null;
          name: string;
          slug: string;
          starts_at: string;
          status?: string;
          updated_at?: string;
          venue_address?: string | null;
          venue_google_place_id?: string | null;
          venue_id?: string | null;
          venue_latitude?: number | null;
          venue_longitude?: number | null;
          venue_name?: string | null;
        };
        Update: {
          attraction?: string | null;
          category?: string;
          chat_closes_at?: string | null;
          chat_enabled?: boolean;
          chat_opens_at?: string | null;
          checkin_closes_at?: string | null;
          checkin_enabled?: boolean;
          geofence_radius_m?: number;
          geolocation_checkin_enabled?: boolean;
          checkin_opens_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          experience_type?: string;
          public_visible?: boolean;
          id?: string;
          image_url?: string | null;
          max_location_accuracy_m?: number;
          instructions?: string | null;
          name?: string;
          slug?: string;
          starts_at?: string;
          status?: string;
          updated_at?: string;
          venue_address?: string | null;
          venue_google_place_id?: string | null;
          venue_id?: string | null;
          venue_latitude?: number | null;
          venue_longitude?: number | null;
          venue_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      feed_posts: {
        Row: {
          body: string | null;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          image_url: string | null;
          is_pinned: boolean;
          placement: string;
          post_type: string;
          priority: number;
          published_at: string | null;
          starts_at: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          image_url?: string | null;
          is_pinned?: boolean;
          placement?: string;
          post_type?: string;
          priority?: number;
          published_at?: string | null;
          starts_at?: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          image_url?: string | null;
          is_pinned?: boolean;
          placement?: string;
          post_type?: string;
          priority?: number;
          published_at?: string | null;
          starts_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      otp_attempts: {
        Row: {
          created_at: string;
          id: string;
          ip_address: string | null;
          kind: string;
          phone: string;
          succeeded: boolean;
        };
        Insert: {
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          kind: string;
          phone: string;
          succeeded?: boolean;
        };
        Update: {
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          kind?: string;
          phone?: string;
          succeeded?: boolean;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          benefits: Json;
          billing_period: string;
          code: Database["public"]["Enums"]["plan_code"];
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          is_active: boolean;
          is_featured: boolean;
          name: string;
          price_cents: number;
          sort_order: number;
          tagline: string | null;
          updated_at: string;
        };
        Insert: {
          benefits?: Json;
          billing_period?: string;
          code: Database["public"]["Enums"]["plan_code"];
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          name: string;
          price_cents?: number;
          sort_order?: number;
          tagline?: string | null;
          updated_at?: string;
        };
        Update: {
          benefits?: Json;
          billing_period?: string;
          code?: Database["public"]["Enums"]["plan_code"];
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          name?: string;
          price_cents?: number;
          sort_order?: number;
          tagline?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pilot_runs: {
        Row: {
          campaign_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_instructions: string | null;
          ended_at: string | null;
          event_id: string;
          expected_attendance: number;
          id: string;
          internal_notes: string | null;
          minimum_profile_percent: number;
          name: string;
          staff_ids: string[];
          started_at: string | null;
          status: string;
          target_checkins: number;
          target_redemptions: number;
          target_registrations: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          campaign_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_instructions?: string | null;
          ended_at?: string | null;
          event_id: string;
          expected_attendance?: number;
          id?: string;
          internal_notes?: string | null;
          minimum_profile_percent?: number;
          name: string;
          staff_ids?: string[];
          started_at?: string | null;
          status?: string;
          target_checkins?: number;
          target_redemptions?: number;
          target_registrations?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          campaign_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_instructions?: string | null;
          ended_at?: string | null;
          event_id?: string;
          expected_attendance?: number;
          id?: string;
          internal_notes?: string | null;
          minimum_profile_percent?: number;
          name?: string;
          staff_ids?: string[];
          started_at?: string | null;
          status?: string;
          target_checkins?: number;
          target_redemptions?: number;
          target_registrations?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pilot_runs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilot_runs_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active_title_id: string | null;
          avatar_url: string | null;
          bio: string | null;
          birth_date: string | null;
          city: string | null;
          created_at: string;
          deleted_at: string | null;
          display_name: string;
          first_checkin_at: string | null;
          first_name: string | null;
          gender_custom: string | null;
          gender_identity: string | null;
          how_found_us: string | null;
          id: string;
          is_over_18: boolean;
          is_public: boolean;
          last_purchase_at: string | null;
          last_reward_at: string | null;
          last_review_at: string | null;
          last_seen_at: string | null;
          last_checkin_at: string | null;
          last_name: string | null;
          lifetime_net_spend_cents: number;
          member_since: string;
          neighborhood: string | null;
          phone_e164: string | null;
          phone_verified_at: string | null;
          pronouns: string | null;
          current_segment: string;
          show_birth_month: boolean;
          show_city: boolean;
          show_checkin_count: boolean;
          show_event_preferences: boolean;
          show_gender: boolean;
          updated_at: string;
          username: string | null;
          visit_count: number;
          whatsapp: string | null;
        };
        Insert: {
          active_title_id?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          city?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name: string;
          first_checkin_at?: string | null;
          first_name?: string | null;
          gender_custom?: string | null;
          gender_identity?: string | null;
          how_found_us?: string | null;
          id: string;
          is_over_18?: boolean;
          is_public?: boolean;
          last_purchase_at?: string | null;
          last_reward_at?: string | null;
          last_review_at?: string | null;
          last_seen_at?: string | null;
          last_checkin_at?: string | null;
          last_name?: string | null;
          lifetime_net_spend_cents?: number;
          member_since?: string;
          neighborhood?: string | null;
          phone_e164?: string | null;
          phone_verified_at?: string | null;
          pronouns?: string | null;
          current_segment?: string;
          show_birth_month?: boolean;
          show_city?: boolean;
          show_checkin_count?: boolean;
          show_event_preferences?: boolean;
          show_gender?: boolean;
          updated_at?: string;
          username?: string | null;
          visit_count?: number;
          whatsapp?: string | null;
        };
        Update: {
          active_title_id?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          city?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          first_checkin_at?: string | null;
          first_name?: string | null;
          gender_custom?: string | null;
          gender_identity?: string | null;
          how_found_us?: string | null;
          id?: string;
          is_over_18?: boolean;
          is_public?: boolean;
          last_purchase_at?: string | null;
          last_reward_at?: string | null;
          last_review_at?: string | null;
          last_seen_at?: string | null;
          last_checkin_at?: string | null;
          last_name?: string | null;
          lifetime_net_spend_cents?: number;
          member_since?: string;
          neighborhood?: string | null;
          phone_e164?: string | null;
          phone_verified_at?: string | null;
          pronouns?: string | null;
          current_segment?: string;
          show_birth_month?: boolean;
          show_city?: boolean;
          show_checkin_count?: boolean;
          show_event_preferences?: boolean;
          show_gender?: boolean;
          updated_at?: string;
          username?: string | null;
          visit_count?: number;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_active_title_fk";
            columns: ["active_title_id"];
            isOneToOne: false;
            referencedRelation: "title_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_change_history: {
        Row: {
          id: string;
          campaign_id: string;
          field_name: string;
          old_value: Json | null;
          new_value: Json | null;
          reason: string | null;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          field_name: string;
          old_value?: Json | null;
          new_value?: Json | null;
          reason?: string | null;
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          field_name?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          reason?: string | null;
          changed_by?: string | null;
          changed_at?: string;
        };
        Relationships: [];
      };
      campaign_products: {
        Row: { campaign_id: string; product_id: string; is_primary: boolean; created_at: string };
        Insert: {
          campaign_id: string;
          product_id: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          campaign_id?: string;
          product_id?: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      crm_segment_memberships: {
        Row: {
          id: string;
          user_id: string;
          segment_key: string;
          active: boolean;
          entered_at: string;
          exited_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          segment_key: string;
          active?: boolean;
          entered_at?: string;
          exited_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          segment_key?: string;
          active?: boolean;
          entered_at?: string;
          exited_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          original_name: string;
          normalized_name: string;
          category: string;
          current_sale_price_cents: number;
          current_cost_cents: number;
          active: boolean;
          counts_for_funnel: boolean;
          discount_eligible: boolean;
          counts_for_fofocometro: boolean;
          max_discount_cents: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          original_name: string;
          normalized_name: string;
          category?: string;
          current_sale_price_cents?: number;
          current_cost_cents?: number;
          active?: boolean;
          counts_for_funnel?: boolean;
          discount_eligible?: boolean;
          counts_for_fofocometro?: boolean;
          max_discount_cents?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          original_name?: string;
          normalized_name?: string;
          category?: string;
          current_sale_price_cents?: number;
          current_cost_cents?: number;
          active?: boolean;
          counts_for_funnel?: boolean;
          discount_eligible?: boolean;
          counts_for_fofocometro?: boolean;
          max_discount_cents?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_change_history: {
        Row: {
          id: string;
          product_id: string;
          field_name: string;
          old_value: Json | null;
          new_value: Json | null;
          reason: string | null;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          field_name: string;
          old_value?: Json | null;
          new_value?: Json | null;
          reason?: string | null;
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          field_name?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          reason?: string | null;
          changed_by?: string | null;
          changed_at?: string;
        };
        Relationships: [];
      };
      customer_event_sessions: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          checkin_id: string | null;
          entered_at: string;
          exited_at: string | null;
          gross_total_cents: number;
          discount_total_cents: number;
          net_total_cents: number;
          funnel_net_total_cents: number;
          cost_total_cents: number;
          margin_total_cents: number;
          current_stage: number;
          last_purchase_at: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          checkin_id?: string | null;
          entered_at?: string;
          exited_at?: string | null;
          gross_total_cents?: number;
          discount_total_cents?: number;
          net_total_cents?: number;
          funnel_net_total_cents?: number;
          cost_total_cents?: number;
          margin_total_cents?: number;
          current_stage?: number;
          last_purchase_at?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          checkin_id?: string | null;
          entered_at?: string;
          exited_at?: string | null;
          gross_total_cents?: number;
          discount_total_cents?: number;
          net_total_cents?: number;
          funnel_net_total_cents?: number;
          cost_total_cents?: number;
          margin_total_cents?: number;
          current_stage?: number;
          last_purchase_at?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          session_id: string;
          status: string;
          source: string;
          external_reference: string | null;
          gross_total_cents: number;
          discount_total_cents: number;
          net_total_cents: number;
          funnel_eligible_net_cents: number;
          service_fee_cents: number;
          tip_cents: number;
          couvert_cents: number;
          cost_total_cents: number;
          margin_total_cents: number;
          created_by: string | null;
          cancelled_at: string | null;
          refunded_at: string | null;
          cancellation_reason: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          session_id: string;
          status?: string;
          source?: string;
          external_reference?: string | null;
          gross_total_cents?: number;
          discount_total_cents?: number;
          net_total_cents?: number;
          funnel_eligible_net_cents?: number;
          service_fee_cents?: number;
          tip_cents?: number;
          couvert_cents?: number;
          cost_total_cents?: number;
          margin_total_cents?: number;
          created_by?: string | null;
          cancelled_at?: string | null;
          refunded_at?: string | null;
          cancellation_reason?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          session_id?: string;
          status?: string;
          source?: string;
          external_reference?: string | null;
          gross_total_cents?: number;
          discount_total_cents?: number;
          net_total_cents?: number;
          funnel_eligible_net_cents?: number;
          service_fee_cents?: number;
          tip_cents?: number;
          couvert_cents?: number;
          cost_total_cents?: number;
          margin_total_cents?: number;
          created_by?: string | null;
          cancelled_at?: string | null;
          refunded_at?: string | null;
          cancellation_reason?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          catalog_sale_price_cents: number;
          unit_sale_price_cents: number;
          unit_cost_snapshot_cents: number;
          gross_value_cents: number;
          discount_type: string | null;
          configured_discount_value: number | null;
          discount_real_cents: number;
          net_paid_cents: number;
          estimated_margin_cents: number;
          campaign_id: string | null;
          reward_id: string | null;
          eligible_for_funnel: boolean;
          counts_for_fofocometro: boolean;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id: string;
          quantity?: number;
          catalog_sale_price_cents: number;
          unit_sale_price_cents: number;
          unit_cost_snapshot_cents: number;
          gross_value_cents: number;
          discount_type?: string | null;
          configured_discount_value?: number | null;
          discount_real_cents?: number;
          net_paid_cents: number;
          estimated_margin_cents: number;
          campaign_id?: string | null;
          reward_id?: string | null;
          eligible_for_funnel?: boolean;
          counts_for_fofocometro?: boolean;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string;
          quantity?: number;
          catalog_sale_price_cents?: number;
          unit_sale_price_cents?: number;
          unit_cost_snapshot_cents?: number;
          gross_value_cents?: number;
          discount_type?: string | null;
          configured_discount_value?: number | null;
          discount_real_cents?: number;
          net_paid_cents?: number;
          estimated_margin_cents?: number;
          campaign_id?: string | null;
          reward_id?: string | null;
          eligible_for_funnel?: boolean;
          counts_for_fofocometro?: boolean;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      event_funnel_rules: {
        Row: {
          id: string;
          event_id: string | null;
          name: string;
          active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id?: string | null;
          name?: string;
          active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string | null;
          name?: string;
          active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      funnel_stages: {
        Row: {
          id: string;
          rule_id: string;
          stage_order: number;
          trigger_type: string;
          threshold_cents: number;
          reward_campaign_id: string;
          title: string;
          progress_copy: string | null;
          unlocked_copy: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rule_id: string;
          stage_order: number;
          trigger_type: string;
          threshold_cents?: number;
          reward_campaign_id: string;
          title: string;
          progress_copy?: string | null;
          unlocked_copy?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rule_id?: string;
          stage_order?: number;
          trigger_type?: string;
          threshold_cents?: number;
          reward_campaign_id?: string;
          title?: string;
          progress_copy?: string | null;
          unlocked_copy?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_funnel_progress: {
        Row: {
          id: string;
          session_id: string;
          stage_id: string;
          reward_id: string | null;
          reached_at: string;
          reversed_at: string | null;
          reversal_reason: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          stage_id: string;
          reward_id?: string | null;
          reached_at?: string;
          reversed_at?: string | null;
          reversal_reason?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          stage_id?: string;
          reward_id?: string | null;
          reached_at?: string;
          reversed_at?: string | null;
          reversal_reason?: string | null;
        };
        Relationships: [];
      };
      collective_goals: {
        Row: {
          id: string;
          event_id: string;
          campaign_id: string | null;
          name: string;
          stage_order: number;
          target_count: number;
          current_count: number;
          status: string;
          starts_at: string | null;
          completed_at: string | null;
          reward_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          campaign_id?: string | null;
          name?: string;
          stage_order?: number;
          target_count: number;
          current_count?: number;
          status?: string;
          starts_at?: string | null;
          completed_at?: string | null;
          reward_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          campaign_id?: string | null;
          name?: string;
          stage_order?: number;
          target_count?: number;
          current_count?: number;
          status?: string;
          starts_at?: string | null;
          completed_at?: string | null;
          reward_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      collective_goal_contributions: {
        Row: {
          id: string;
          goal_id: string;
          event_id: string;
          user_id: string;
          reward_redemption_id: string;
          sale_id: string | null;
          product_id: string | null;
          gross_cents: number;
          discount_cents: number;
          net_cents: number;
          cost_cents: number;
          margin_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          event_id: string;
          user_id: string;
          reward_redemption_id: string;
          sale_id?: string | null;
          product_id?: string | null;
          gross_cents?: number;
          discount_cents?: number;
          net_cents?: number;
          cost_cents?: number;
          margin_cents?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          event_id?: string;
          user_id?: string;
          reward_redemption_id?: string;
          sale_id?: string | null;
          product_id?: string | null;
          gross_cents?: number;
          discount_cents?: number;
          net_cents?: number;
          cost_cents?: number;
          margin_cents?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      event_reviews: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          rating: number;
          service_rating: number | null;
          music_rating: number | null;
          atmosphere_rating: number | null;
          comment: string | null;
          would_return: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          rating: number;
          service_rating?: number | null;
          music_rating?: number | null;
          atmosphere_rating?: number | null;
          comment?: string | null;
          would_return?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          rating?: number;
          service_rating?: number | null;
          music_rating?: number | null;
          atmosphere_rating?: number | null;
          comment?: string | null;
          would_return?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      salve_requests: {
        Row: {
          id: string;
          event_id: string;
          sender_id: string;
          recipient_id: string;
          status: string;
          opener: string | null;
          created_at: string;
          expires_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          sender_id: string;
          recipient_id: string;
          status?: string;
          opener?: string | null;
          created_at?: string;
          expires_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          sender_id?: string;
          recipient_id?: string;
          status?: string;
          opener?: string | null;
          created_at?: string;
          expires_at?: string;
          responded_at?: string | null;
        };
        Relationships: [];
      };
      private_chat_threads: {
        Row: {
          id: string;
          event_id: string;
          salve_request_id: string;
          member_one_id: string;
          member_two_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          salve_request_id: string;
          member_one_id: string;
          member_two_id: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          salve_request_id?: string;
          member_one_id?: string;
          member_two_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      private_chat_messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          thread_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      qr_tokens: {
        Row: {
          created_at: string;
          expires_at: string;
          purpose: string;
          ref_id: string | null;
          short_code: string;
          token: string;
          used_at: string | null;
          used_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          purpose: string;
          ref_id?: string | null;
          short_code: string;
          token?: string;
          used_at?: string | null;
          used_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          purpose?: string;
          ref_id?: string | null;
          short_code?: string;
          token?: string;
          used_at?: string | null;
          used_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      reward_redemptions: {
        Row: {
          id: string;
          notes: string | null;
          redeemed_at: string;
          reward_id: string;
          staff_id: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          notes?: string | null;
          redeemed_at?: string;
          reward_id: string;
          staff_id?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          notes?: string | null;
          redeemed_at?: string;
          reward_id?: string;
          staff_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey";
            columns: ["reward_id"];
            isOneToOne: true;
            referencedRelation: "user_rewards";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancel_at: string | null;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          external_reference: string | null;
          id: string;
          metadata: Json;
          plan_id: string;
          source: Database["public"]["Enums"]["payment_source"];
          started_at: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          external_reference?: string | null;
          id?: string;
          metadata?: Json;
          plan_id: string;
          source?: Database["public"]["Enums"]["payment_source"];
          started_at?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          external_reference?: string | null;
          id?: string;
          metadata?: Json;
          plan_id?: string;
          source?: Database["public"]["Enums"]["payment_source"];
          started_at?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      title_definitions: {
        Row: {
          auto_rule: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          linked_badge_id: string | null;
          name: string;
          rule: string | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          auto_rule?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          linked_badge_id?: string | null;
          name: string;
          rule?: string | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          auto_rule?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          linked_badge_id?: string | null;
          name?: string;
          rule?: string | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_definitions_linked_badge_id_fkey";
            columns: ["linked_badge_id"];
            isOneToOne: false;
            referencedRelation: "badge_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_badges: {
        Row: {
          awarded_at: string;
          awarded_by: string | null;
          badge_id: string;
          id: string;
          is_featured: boolean;
          is_hidden: boolean;
          user_id: string;
        };
        Insert: {
          awarded_at?: string;
          awarded_by?: string | null;
          badge_id: string;
          id?: string;
          is_featured?: boolean;
          is_hidden?: boolean;
          user_id: string;
        };
        Update: {
          awarded_at?: string;
          awarded_by?: string | null;
          badge_id?: string;
          id?: string;
          is_featured?: boolean;
          is_hidden?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badge_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_consents: {
        Row: {
          accepted: boolean;
          created_at: string;
          id: string;
          ip_address: string | null;
          kind: string;
          user_agent: string | null;
          user_id: string;
          version: string;
        };
        Insert: {
          accepted: boolean;
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          kind: string;
          user_agent?: string | null;
          user_id: string;
          version?: string;
        };
        Update: {
          accepted?: boolean;
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          kind?: string;
          user_agent?: string | null;
          user_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          created_at: string;
          drink_preferences: string[];
          event_categories: string[];
          food_preferences: string[];
          marketing_opt_in: boolean;
          notify_email: boolean;
          notify_in_app: boolean;
          notify_push: boolean;
          notify_whatsapp: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          drink_preferences?: string[];
          event_categories?: string[];
          food_preferences?: string[];
          marketing_opt_in?: boolean;
          notify_email?: boolean;
          notify_in_app?: boolean;
          notify_push?: boolean;
          notify_whatsapp?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          drink_preferences?: string[];
          event_categories?: string[];
          food_preferences?: string[];
          marketing_opt_in?: boolean;
          notify_email?: boolean;
          notify_in_app?: boolean;
          notify_push?: boolean;
          notify_whatsapp?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_rewards: {
        Row: {
          activated_at: string | null;
          activation_expires_at: string | null;
          campaign_id: string;
          checkin_id: string | null;
          created_at: string;
          event_id: string | null;
          expires_at: string | null;
          granted_at: string;
          id: string;
          reward_snapshot: Json;
          source_stage_id: string | null;
          status: string;
          updated_at: string;
          used_at: string | null;
          visit_scope: string;
          user_id: string;
        };
        Insert: {
          activated_at?: string | null;
          activation_expires_at?: string | null;
          campaign_id: string;
          checkin_id?: string | null;
          created_at?: string;
          event_id?: string | null;
          expires_at?: string | null;
          granted_at?: string;
          id?: string;
          reward_snapshot?: Json;
          source_stage_id?: string | null;
          status?: string;
          updated_at?: string;
          used_at?: string | null;
          visit_scope?: string;
          user_id: string;
        };
        Update: {
          activated_at?: string | null;
          activation_expires_at?: string | null;
          campaign_id?: string;
          checkin_id?: string | null;
          created_at?: string;
          event_id?: string | null;
          expires_at?: string | null;
          granted_at?: string;
          id?: string;
          reward_snapshot?: Json;
          source_stage_id?: string | null;
          status?: string;
          updated_at?: string;
          used_at?: string | null;
          visit_scope?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_rewards_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rewards_checkin_id_fkey";
            columns: ["checkin_id"];
            isOneToOne: false;
            referencedRelation: "checkins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rewards_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_titles: {
        Row: {
          awarded_at: string;
          id: string;
          title_id: string;
          user_id: string;
        };
        Insert: {
          awarded_at?: string;
          id?: string;
          title_id: string;
          user_id: string;
        };
        Update: {
          awarded_at?: string;
          id?: string;
          title_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_titles_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "title_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      security_controls: {
        Row: {
          category: string;
          completed: boolean;
          control_key: string;
          created_at: string;
          description: string;
          evidence: string | null;
          label: string;
          notes: string | null;
          required: boolean;
          reviewed_at: string | null;
          reviewed_by: string | null;
          updated_at: string;
        };
        Insert: {
          category: string;
          completed?: boolean;
          control_key: string;
          created_at?: string;
          description: string;
          evidence?: string | null;
          label: string;
          notes?: string | null;
          required?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: string;
          completed?: boolean;
          control_key?: string;
          created_at?: string;
          description?: string;
          evidence?: string | null;
          label?: string;
          notes?: string | null;
          required?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      security_events: {
        Row: {
          actor_id: string | null;
          category: string;
          created_at: string;
          details: Json;
          entity: string | null;
          entity_id: string | null;
          event_key: string;
          id: string;
          occurred_at: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: string;
          target_user_id: string | null;
          title: string;
        };
        Insert: {
          actor_id?: string | null;
          category: string;
          created_at?: string;
          details?: Json;
          entity?: string | null;
          entity_id?: string | null;
          event_key: string;
          id?: string;
          occurred_at?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity: string;
          target_user_id?: string | null;
          title: string;
        };
        Update: {
          actor_id?: string | null;
          category?: string;
          created_at?: string;
          details?: Json;
          entity?: string | null;
          entity_id?: string | null;
          event_key?: string;
          id?: string;
          occurred_at?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          target_user_id?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          address: string;
          created_at: string;
          created_by: string | null;
          default_geofence_radius_m: number;
          default_max_accuracy_m: number;
          google_place_id: string | null;
          id: string;
          is_active: boolean;
          latitude: number;
          longitude: number;
          name: string;
          updated_at: string;
        };
        Insert: {
          address: string;
          created_at?: string;
          created_by?: string | null;
          default_geofence_radius_m?: number;
          default_max_accuracy_m?: number;
          google_place_id?: string | null;
          id?: string;
          is_active?: boolean;
          latitude: number;
          longitude: number;
          name: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          created_at?: string;
          created_by?: string | null;
          default_geofence_radius_m?: number;
          default_max_accuracy_m?: number;
          google_place_id?: string | null;
          id?: string;
          is_active?: boolean;
          latitude?: number;
          longitude?: number;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          birth_month: number | null;
          city: string | null;
          display_name: string | null;
          id: string | null;
          is_public: boolean | null;
          member_since: string | null;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          birth_month?: never;
          city?: never;
          display_name?: string | null;
          id?: string | null;
          is_public?: boolean | null;
          member_since?: string | null;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          birth_month?: never;
          city?: never;
          display_name?: string | null;
          id?: string | null;
          is_public?: boolean | null;
          member_since?: string | null;
          username?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      checkin_with_geolocation: {
        Args: {
          _accuracy_m: number;
          _event_id: string;
          _latitude: number;
          _longitude: number;
        };
        Returns: Json;
      };
      my_house_session: { Args: never; Returns: Json };
      track_campaign_external_click: {
        Args: { _campaign_id: string; _source?: string };
        Returns: string;
      };
      my_fofoquinhas: {
        Args: never;
        Returns: {
          campaign_id: string;
          name: string;
          description: string | null;
          benefit_type: string;
          discount_percent: number | null;
          fixed_off_cents: number | null;
          product_name: string | null;
          public_rules: string | null;
          campaign_kind: string;
          trigger_type: string;
          trigger_target: number;
          progress_value: number;
          completed: boolean;
          reward_id: string | null;
          reward_status: string | null;
          reward_expires_at: string | null;
          starts_at: string;
          ends_at: string | null;
          is_pinned: boolean;
          feed_priority: number;
          public_title: string;
          public_copy: string | null;
          product_id: string | null;
          product_category: string | null;
          activation_expires_at: string | null;
          visit_scope: string;
          home_sort_order: number | null;
          home_visible: boolean;
          redemption_mode: string;
          external_url: string | null;
          external_button_label: string;
          external_open_new_tab: boolean;
        }[];
      };
      admin_change_sale_status: {
        Args: { _sale_id: string; _status: string; _reason?: string | null };
        Returns: Json;
      };
      admin_commercial_snapshot: { Args: never; Returns: Json };
      admin_configure_event_funnel: { Args: { _event_id: string; _config?: Json }; Returns: Json };
      admin_upsert_product: {
        Args: {
          _name: string;
          _category?: string;
          _sale_price_cents?: number;
          _cost_cents?: number;
          _reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["products"]["Row"];
      };
      event_fofocometro: { Args: { _event_id: string }; Returns: Json };
      inspect_commercial_qr: { Args: { _token: string }; Returns: Json };
      my_event_journey: { Args: never; Returns: Json };
      record_customer_sale: {
        Args: {
          _event_id: string;
          _items: Json;
          _commercial_token: string;
          _external_reference?: string | null;
          _source?: string;
          _service_fee_cents?: number;
          _tip_cents?: number;
          _couvert_cents?: number;
        };
        Returns: Json;
      };
      respond_salve_request: { Args: { _request_id: string; _accept: boolean }; Returns: Json };
      send_private_message: { Args: { _thread_id: string; _body: string }; Returns: string };
      send_salve_request: {
        Args: { _event_id: string; _recipient_id: string; _opener?: string | null };
        Returns: Json;
      };
      submit_event_review: {
        Args: {
          _event_id: string;
          _rating: number;
          _service_rating?: number | null;
          _music_rating?: number | null;
          _atmosphere_rating?: number | null;
          _comment?: string | null;
          _would_return?: boolean | null;
        };
        Returns: Json;
      };
      admin_prune_security_events: { Args: { _days?: number }; Returns: number };
      admin_resolve_security_event: {
        Args: { _event_id: string; _resolution_note?: string | null };
        Returns: undefined;
      };
      admin_security_snapshot: { Args: never; Returns: Json };
      admin_set_security_control: {
        Args: {
          _completed: boolean;
          _control_key: string;
          _evidence?: string | null;
          _notes?: string | null;
        };
        Returns: undefined;
      };
      admin_profile_completion_overview: {
        Args: never;
        Returns: {
          details: Json;
          percentage: number;
          user_id: string;
        }[];
      };
      admin_set_manual_badge: {
        Args: { _badge_slug: string; _enabled: boolean; _user_id: string };
        Returns: undefined;
      };
      admin_export_data: {
        Args: {
          _event_id?: string | null;
          _from?: string | null;
          _kind: string;
          _to?: string | null;
        };
        Returns: Json;
      };
      calculate_profile_completeness: {
        Args: { _user_id: string };
        Returns: number;
      };
      can_access_event_chat: {
        Args: { _event_id: string; _user_id: string };
        Returns: boolean;
      };
      create_my_qr_token: {
        Args: { _purpose: string; _ref_id?: string | null };
        Returns: {
          expires_at: string;
          short_code: string;
          token: string;
        }[];
      };
      current_user_roles: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"][];
      };
      close_event_checkin: { Args: { _event_id: string }; Returns: undefined };
      duplicate_event_with_campaigns: { Args: { _event_id: string }; Returns: string };
      delete_event_chat_message: { Args: { _message_id: string }; Returns: undefined };
      get_event_chat_feed: {
        Args: { _event_id: string; _limit?: number };
        Returns: {
          author_avatar_url: string | null;
          author_badges: Json;
          author_id: string;
          author_name: string;
          author_title: string | null;
          author_username: string | null;
          body: string;
          created_at: string;
          event_id: string;
          is_mine: boolean;
          message_id: string;
          reply_to: string | null;
        }[];
      };
      get_public_profile: { Args: { _username: string }; Returns: Json };
      grant_badge_by_slug: {
        Args: { _slug: string; _user_id: string };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_event_chat_blocked: {
        Args: { _author: string; _viewer: string };
        Returns: boolean;
      };
      moderate_event_chat_message: {
        Args: { _message_id: string; _reason?: string | null; _restore?: boolean };
        Returns: undefined;
      };
      my_event_chat_rooms: {
        Args: never;
        Returns: {
          category: string;
          chat_closes_at: string;
          ends_at: string | null;
          event_id: string;
          event_name: string;
          image_url: string | null;
          last_message_at: string | null;
          message_count: number;
          starts_at: string;
        }[];
      };
      my_event_chat_blocks: {
        Args: never;
        Returns: {
          avatar_url: string | null;
          blocked_at: string;
          blocked_user_id: string;
          display_name: string;
          is_public: boolean;
          username: string | null;
        }[];
      };
      my_profile_completion_details: { Args: never; Returns: Json };
      my_profile_completeness: { Args: never; Returns: number };
      profile_completion_details: { Args: { _user_id: string }; Returns: Json };
      refresh_my_reward_statuses: { Args: never; Returns: number };
      sync_event_statuses: { Args: never; Returns: number };
      report_event_chat_message: {
        Args: { _details?: string | null; _message_id: string; _reason: string };
        Returns: undefined;
      };
      send_event_chat_message: {
        Args: { _body: string; _event_id: string; _reply_to?: string | null };
        Returns: string;
      };
      set_my_preferences: {
        Args: {
          _event_categories?: string[];
          _drink_preferences?: string[];
          _food_preferences?: string[];
          _notify_in_app?: boolean;
          _notify_email?: boolean;
          _notify_whatsapp?: boolean;
          _notify_push?: boolean;
          _marketing_opt_in?: boolean;
          _consent_version?: string;
        };
        Returns: undefined;
      };
      my_auth_security_status: { Args: never; Returns: Json };
      set_event_chat_block: {
        Args: { _blocked: boolean; _blocked_user_id: string };
        Returns: undefined;
      };
      redeem_reward_qr: { Args: { _token: string }; Returns: Json };
      validate_checkin_qr: {
        Args: { _event_id: string; _token: string };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "visitante" | "gratuito" | "premium" | "equipe" | "moderador" | "admin";
      payment_source: "demo" | "stripe" | "manual" | "pix";
      plan_code: "gratuito" | "carteirinha_mensal" | "carteirinha_anual";
      subscription_status:
        "teste" | "ativa" | "pendente" | "vencida" | "cancelada" | "inadimplente" | "em_carencia";
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
      app_role: ["visitante", "gratuito", "premium", "equipe", "moderador", "admin"],
      payment_source: ["demo", "stripe", "manual", "pix"],
      plan_code: ["gratuito", "carteirinha_mensal", "carteirinha_anual"],
      subscription_status: [
        "teste",
        "ativa",
        "pendente",
        "vencida",
        "cancelada",
        "inadimplente",
        "em_carencia",
      ],
    },
  },
} as const;
