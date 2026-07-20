export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string | null
          entity_id: string | null
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      badge_definitions: {
        Row: {
          auto_rule: string | null
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          rule: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          auto_rule?: string | null
          created_at?: string
          description: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          rule?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auto_rule?: string | null
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          rule?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      campaign_change_history: {
        Row: {
          campaign_id: string
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          campaign_id: string
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          campaign_id?: string
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_change_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_link_clicks: {
        Row: {
          campaign_id: string
          clicked_at: string
          id: string
          source: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string
          id?: string
          source?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string
          id?: string
          source?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_link_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_products: {
        Row: {
          campaign_id: string
          created_at: string
          is_primary: boolean
          product_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          is_primary?: boolean
          product_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_products_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          activation_window_minutes: number
          audience_segment: string | null
          benefit_type: string
          campaign_kind: string
          counts_for_fofocometro: boolean
          counts_for_funnel: boolean
          created_at: string
          description: string | null
          discount_max_cents: number | null
          discount_percent: number | null
          discount_type: string | null
          discount_value: number | null
          eligible_quantity_mode: string
          ends_at: string | null
          event_id: string | null
          external_button_label: string
          external_open_new_tab: boolean
          external_url: string | null
          feed_priority: number
          feed_visible: boolean
          fixed_off_cents: number | null
          home_sort_order: number | null
          home_visible: boolean
          id: string
          instructions: string | null
          internal_rules: string | null
          is_pinned: boolean
          name: string
          per_user_limit: number
          product_category: string | null
          product_id: string | null
          product_name: string | null
          progression_rule: Json
          public_copy: string | null
          public_rules: string | null
          public_title: string | null
          redemption_mode: string
          redemption_window_minutes: number
          required_badge_id: string | null
          requires_checkin: boolean
          requires_min_profile: boolean
          requires_staff_validation: boolean
          reward_valid_hours: number
          stacking_allowed: boolean
          starts_at: string
          status: string
          total_available: number | null
          trigger_category: string | null
          trigger_target: number
          trigger_type: string
          updated_at: string
          used_count: number
          visit_scope: string
        }
        Insert: {
          activation_window_minutes?: number
          audience_segment?: string | null
          benefit_type: string
          campaign_kind?: string
          counts_for_fofocometro?: boolean
          counts_for_funnel?: boolean
          created_at?: string
          description?: string | null
          discount_max_cents?: number | null
          discount_percent?: number | null
          discount_type?: string | null
          discount_value?: number | null
          eligible_quantity_mode?: string
          ends_at?: string | null
          event_id?: string | null
          external_button_label?: string
          external_open_new_tab?: boolean
          external_url?: string | null
          feed_priority?: number
          feed_visible?: boolean
          fixed_off_cents?: number | null
          home_sort_order?: number | null
          home_visible?: boolean
          id?: string
          instructions?: string | null
          internal_rules?: string | null
          is_pinned?: boolean
          name: string
          per_user_limit?: number
          product_category?: string | null
          product_id?: string | null
          product_name?: string | null
          progression_rule?: Json
          public_copy?: string | null
          public_rules?: string | null
          public_title?: string | null
          redemption_mode?: string
          redemption_window_minutes?: number
          required_badge_id?: string | null
          requires_checkin?: boolean
          requires_min_profile?: boolean
          requires_staff_validation?: boolean
          reward_valid_hours?: number
          stacking_allowed?: boolean
          starts_at?: string
          status?: string
          total_available?: number | null
          trigger_category?: string | null
          trigger_target?: number
          trigger_type?: string
          updated_at?: string
          used_count?: number
          visit_scope?: string
        }
        Update: {
          activation_window_minutes?: number
          audience_segment?: string | null
          benefit_type?: string
          campaign_kind?: string
          counts_for_fofocometro?: boolean
          counts_for_funnel?: boolean
          created_at?: string
          description?: string | null
          discount_max_cents?: number | null
          discount_percent?: number | null
          discount_type?: string | null
          discount_value?: number | null
          eligible_quantity_mode?: string
          ends_at?: string | null
          event_id?: string | null
          external_button_label?: string
          external_open_new_tab?: boolean
          external_url?: string | null
          feed_priority?: number
          feed_visible?: boolean
          fixed_off_cents?: number | null
          home_sort_order?: number | null
          home_visible?: boolean
          id?: string
          instructions?: string | null
          internal_rules?: string | null
          is_pinned?: boolean
          name?: string
          per_user_limit?: number
          product_category?: string | null
          product_id?: string | null
          product_name?: string | null
          progression_rule?: Json
          public_copy?: string | null
          public_rules?: string | null
          public_title?: string | null
          redemption_mode?: string
          redemption_window_minutes?: number
          required_badge_id?: string | null
          requires_checkin?: boolean
          requires_min_profile?: boolean
          requires_staff_validation?: boolean
          reward_valid_hours?: number
          stacking_allowed?: boolean
          starts_at?: string
          status?: string
          total_available?: number | null
          trigger_category?: string | null
          trigger_target?: number
          trigger_type?: string
          updated_at?: string
          used_count?: number
          visit_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          created_at: string
          event_id: string
          id: string
          method: string
          notes: string | null
          staff_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          method?: string
          notes?: string | null
          staff_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          method?: string
          notes?: string | null
          staff_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      collective_goal_contributions: {
        Row: {
          cost_cents: number
          created_at: string
          discount_cents: number
          event_id: string
          goal_id: string
          gross_cents: number
          id: string
          margin_cents: number
          net_cents: number
          product_id: string | null
          reward_redemption_id: string
          sale_id: string | null
          user_id: string
        }
        Insert: {
          cost_cents?: number
          created_at?: string
          discount_cents?: number
          event_id: string
          goal_id: string
          gross_cents?: number
          id?: string
          margin_cents?: number
          net_cents?: number
          product_id?: string | null
          reward_redemption_id: string
          sale_id?: string | null
          user_id: string
        }
        Update: {
          cost_cents?: number
          created_at?: string
          discount_cents?: number
          event_id?: string
          goal_id?: string
          gross_cents?: number
          id?: string
          margin_cents?: number
          net_cents?: number
          product_id?: string | null
          reward_redemption_id?: string
          sale_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collective_goal_contributions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "collective_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_goal_contributions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_goal_contributions_reward_redemption_id_fkey"
            columns: ["reward_redemption_id"]
            isOneToOne: false
            referencedRelation: "reward_redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_goal_contributions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      collective_goals: {
        Row: {
          campaign_id: string | null
          completed_at: string | null
          created_at: string
          current_count: number
          event_id: string
          id: string
          name: string
          reward_description: string | null
          stage_order: number
          starts_at: string | null
          status: string
          target_count: number
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_count?: number
          event_id: string
          id?: string
          name?: string
          reward_description?: string | null
          stage_order?: number
          starts_at?: string | null
          status?: string
          target_count: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_count?: number
          event_id?: string
          id?: string
          name?: string
          reward_description?: string | null
          stage_order?: number
          starts_at?: string | null
          status?: string
          target_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collective_goals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_goals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_segment_memberships: {
        Row: {
          active: boolean
          entered_at: string
          exited_at: string | null
          id: string
          segment_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          entered_at?: string
          exited_at?: string | null
          id?: string
          segment_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          entered_at?: string
          exited_at?: string | null
          id?: string
          segment_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_event_sessions: {
        Row: {
          checkin_id: string | null
          cost_total_cents: number
          created_at: string
          current_stage: number
          discount_total_cents: number
          entered_at: string
          event_id: string
          exited_at: string | null
          funnel_net_total_cents: number
          gross_total_cents: number
          id: string
          last_purchase_at: string | null
          margin_total_cents: number
          net_total_cents: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_id?: string | null
          cost_total_cents?: number
          created_at?: string
          current_stage?: number
          discount_total_cents?: number
          entered_at?: string
          event_id: string
          exited_at?: string | null
          funnel_net_total_cents?: number
          gross_total_cents?: number
          id?: string
          last_purchase_at?: string | null
          margin_total_cents?: number
          net_total_cents?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_id?: string | null
          cost_total_cents?: number
          created_at?: string
          current_stage?: number
          discount_total_cents?: number
          entered_at?: string
          event_id?: string
          exited_at?: string | null
          funnel_net_total_cents?: number
          gross_total_cents?: number
          id?: string
          last_purchase_at?: string | null
          margin_total_cents?: number
          net_total_cents?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_event_sessions_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_event_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_chat_blocks: {
        Row: {
          blocked_user_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_chat_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          moderated_by: string | null
          moderation_reason: string | null
          reply_to: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          moderated_by?: string | null
          moderation_reason?: string | null
          reply_to?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          moderated_by?: string | null
          moderation_reason?: string | null
          reply_to?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_chat_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "event_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_chat_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          message_id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          message_id: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "event_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_funnel_progress: {
        Row: {
          id: string
          reached_at: string
          reversal_reason: string | null
          reversed_at: string | null
          reward_id: string | null
          session_id: string
          stage_id: string
        }
        Insert: {
          id?: string
          reached_at?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reward_id?: string | null
          session_id: string
          stage_id: string
        }
        Update: {
          id?: string
          reached_at?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reward_id?: string | null
          session_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_funnel_progress_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "user_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_funnel_progress_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "customer_event_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_funnel_progress_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_funnel_rules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          ends_at: string | null
          event_id: string | null
          id: string
          name: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_funnel_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reviews: {
        Row: {
          atmosphere_rating: number | null
          comment: string | null
          created_at: string
          event_id: string
          id: string
          music_rating: number | null
          rating: number
          service_rating: number | null
          updated_at: string
          user_id: string
          would_return: boolean | null
        }
        Insert: {
          atmosphere_rating?: number | null
          comment?: string | null
          created_at?: string
          event_id: string
          id?: string
          music_rating?: number | null
          rating: number
          service_rating?: number | null
          updated_at?: string
          user_id: string
          would_return?: boolean | null
        }
        Update: {
          atmosphere_rating?: number | null
          comment?: string | null
          created_at?: string
          event_id?: string
          id?: string
          music_rating?: number | null
          rating?: number
          service_rating?: number | null
          updated_at?: string
          user_id?: string
          would_return?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_reviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attraction: string | null
          category: string
          chat_closes_at: string | null
          chat_enabled: boolean
          chat_opens_at: string | null
          checkin_closes_at: string | null
          checkin_enabled: boolean
          checkin_opens_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          experience_type: string
          geofence_radius_m: number
          geolocation_checkin_enabled: boolean
          id: string
          image_url: string | null
          instructions: string | null
          max_location_accuracy_m: number
          name: string
          public_visible: boolean
          slug: string
          starts_at: string
          status: string
          updated_at: string
          venue_address: string | null
          venue_google_place_id: string | null
          venue_id: string | null
          venue_latitude: number | null
          venue_longitude: number | null
          venue_name: string | null
        }
        Insert: {
          attraction?: string | null
          category: string
          chat_closes_at?: string | null
          chat_enabled?: boolean
          chat_opens_at?: string | null
          checkin_closes_at?: string | null
          checkin_enabled?: boolean
          checkin_opens_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          experience_type?: string
          geofence_radius_m?: number
          geolocation_checkin_enabled?: boolean
          id?: string
          image_url?: string | null
          instructions?: string | null
          max_location_accuracy_m?: number
          name: string
          public_visible?: boolean
          slug: string
          starts_at: string
          status?: string
          updated_at?: string
          venue_address?: string | null
          venue_google_place_id?: string | null
          venue_id?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
        }
        Update: {
          attraction?: string | null
          category?: string
          chat_closes_at?: string | null
          chat_enabled?: boolean
          chat_opens_at?: string | null
          checkin_closes_at?: string | null
          checkin_enabled?: boolean
          checkin_opens_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          experience_type?: string
          geofence_radius_m?: number
          geolocation_checkin_enabled?: boolean
          id?: string
          image_url?: string | null
          instructions?: string | null
          max_location_accuracy_m?: number
          name?: string
          public_visible?: boolean
          slug?: string
          starts_at?: string
          status?: string
          updated_at?: string
          venue_address?: string | null
          venue_google_place_id?: string | null
          venue_id?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_pinned: boolean
          placement: string
          post_type: string
          priority: number
          published_at: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          placement?: string
          post_type?: string
          priority?: number
          published_at?: string | null
          starts_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          placement?: string
          post_type?: string
          priority?: number
          published_at?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      funnel_stages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          progress_copy: string | null
          reward_campaign_id: string
          rule_id: string
          stage_order: number
          threshold_cents: number
          title: string
          trigger_type: string
          unlocked_copy: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          progress_copy?: string | null
          reward_campaign_id: string
          rule_id: string
          stage_order: number
          threshold_cents?: number
          title: string
          trigger_type: string
          unlocked_copy?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          progress_copy?: string | null
          reward_campaign_id?: string
          rule_id?: string
          stage_order?: number
          threshold_cents?: number
          title?: string
          trigger_type?: string
          unlocked_copy?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_reward_campaign_id_fkey"
            columns: ["reward_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stages_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "event_funnel_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          kind: string
          phone: string
          succeeded: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          kind: string
          phone: string
          succeeded?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          kind?: string
          phone?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      pilot_runs: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          customer_instructions: string | null
          ended_at: string | null
          event_id: string
          expected_attendance: number
          id: string
          internal_notes: string | null
          minimum_profile_percent: number
          name: string
          staff_ids: string[]
          started_at: string | null
          status: string
          target_checkins: number
          target_redemptions: number
          target_registrations: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_instructions?: string | null
          ended_at?: string | null
          event_id: string
          expected_attendance?: number
          id?: string
          internal_notes?: string | null
          minimum_profile_percent?: number
          name: string
          staff_ids?: string[]
          started_at?: string | null
          status?: string
          target_checkins?: number
          target_redemptions?: number
          target_registrations?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_instructions?: string | null
          ended_at?: string | null
          event_id?: string
          expected_attendance?: number
          id?: string
          internal_notes?: string | null
          minimum_profile_percent?: number
          name?: string
          staff_ids?: string[]
          started_at?: string | null
          status?: string
          target_checkins?: number
          target_redemptions?: number
          target_registrations?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          benefits: Json
          billing_period: string
          code: Database["public"]["Enums"]["plan_code"]
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          price_cents: number
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          benefits?: Json
          billing_period?: string
          code: Database["public"]["Enums"]["plan_code"]
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          price_cents?: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          benefits?: Json
          billing_period?: string
          code?: Database["public"]["Enums"]["plan_code"]
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      private_chat_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "private_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      private_chat_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          message_id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          message_id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          thread_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "private_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_chat_reports_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "private_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      private_chat_threads: {
        Row: {
          created_at: string
          event_id: string
          id: string
          member_one_id: string
          member_two_id: string
          salve_request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          member_one_id: string
          member_two_id: string
          salve_request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          member_one_id?: string
          member_two_id?: string
          salve_request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_chat_threads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_chat_threads_salve_request_id_fkey"
            columns: ["salve_request_id"]
            isOneToOne: true
            referencedRelation: "salve_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      product_change_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
          product_id: string
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          product_id: string
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_change_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          counts_for_fofocometro: boolean
          counts_for_funnel: boolean
          created_at: string
          created_by: string | null
          current_cost_cents: number
          current_sale_price_cents: number
          discount_eligible: boolean
          id: string
          max_discount_cents: number | null
          normalized_name: string
          notes: string | null
          original_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          counts_for_fofocometro?: boolean
          counts_for_funnel?: boolean
          created_at?: string
          created_by?: string | null
          current_cost_cents?: number
          current_sale_price_cents?: number
          discount_eligible?: boolean
          id?: string
          max_discount_cents?: number | null
          normalized_name: string
          notes?: string | null
          original_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          counts_for_fofocometro?: boolean
          counts_for_funnel?: boolean
          created_at?: string
          created_by?: string | null
          current_cost_cents?: number
          current_sale_price_cents?: number
          discount_eligible?: boolean
          id?: string
          max_discount_cents?: number | null
          normalized_name?: string
          notes?: string | null
          original_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_title_id: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          city: string | null
          created_at: string
          current_segment: string
          deleted_at: string | null
          display_name: string
          first_checkin_at: string | null
          first_name: string | null
          gender_custom: string | null
          gender_identity: string | null
          how_found_us: string | null
          id: string
          is_over_18: boolean
          is_public: boolean
          last_checkin_at: string | null
          last_name: string | null
          last_purchase_at: string | null
          last_review_at: string | null
          last_reward_at: string | null
          last_seen_at: string | null
          lifetime_net_spend_cents: number
          member_since: string
          neighborhood: string | null
          phone_e164: string | null
          phone_verified_at: string | null
          pronouns: string | null
          show_birth_month: boolean
          show_checkin_count: boolean
          show_city: boolean
          show_event_preferences: boolean
          show_gender: boolean
          updated_at: string
          username: string | null
          visit_count: number
          whatsapp: string | null
        }
        Insert: {
          active_title_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          current_segment?: string
          deleted_at?: string | null
          display_name: string
          first_checkin_at?: string | null
          first_name?: string | null
          gender_custom?: string | null
          gender_identity?: string | null
          how_found_us?: string | null
          id: string
          is_over_18?: boolean
          is_public?: boolean
          last_checkin_at?: string | null
          last_name?: string | null
          last_purchase_at?: string | null
          last_review_at?: string | null
          last_reward_at?: string | null
          last_seen_at?: string | null
          lifetime_net_spend_cents?: number
          member_since?: string
          neighborhood?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          pronouns?: string | null
          show_birth_month?: boolean
          show_checkin_count?: boolean
          show_city?: boolean
          show_event_preferences?: boolean
          show_gender?: boolean
          updated_at?: string
          username?: string | null
          visit_count?: number
          whatsapp?: string | null
        }
        Update: {
          active_title_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          current_segment?: string
          deleted_at?: string | null
          display_name?: string
          first_checkin_at?: string | null
          first_name?: string | null
          gender_custom?: string | null
          gender_identity?: string | null
          how_found_us?: string | null
          id?: string
          is_over_18?: boolean
          is_public?: boolean
          last_checkin_at?: string | null
          last_name?: string | null
          last_purchase_at?: string | null
          last_review_at?: string | null
          last_reward_at?: string | null
          last_seen_at?: string | null
          lifetime_net_spend_cents?: number
          member_since?: string
          neighborhood?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          pronouns?: string | null
          show_birth_month?: boolean
          show_checkin_count?: boolean
          show_city?: boolean
          show_event_preferences?: boolean
          show_gender?: boolean
          updated_at?: string
          username?: string | null
          visit_count?: number
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_title_fk"
            columns: ["active_title_id"]
            isOneToOne: false
            referencedRelation: "title_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_tokens: {
        Row: {
          created_at: string
          expires_at: string
          purpose: string
          ref_id: string | null
          short_code: string
          token: string
          used_at: string | null
          used_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          purpose: string
          ref_id?: string | null
          short_code: string
          token?: string
          used_at?: string | null
          used_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          purpose?: string
          ref_id?: string | null
          short_code?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          id: string
          notes: string | null
          redeemed_at: string
          reward_id: string
          staff_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          redeemed_at?: string
          reward_id: string
          staff_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          redeemed_at?: string
          reward_id?: string
          staff_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: true
            referencedRelation: "user_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          campaign_id: string | null
          catalog_sale_price_cents: number
          configured_discount_value: number | null
          counts_for_fofocometro: boolean
          created_at: string
          discount_real_cents: number
          discount_type: string | null
          eligible_for_funnel: boolean
          estimated_margin_cents: number
          gross_value_cents: number
          id: string
          net_paid_cents: number
          product_id: string
          quantity: number
          reward_id: string | null
          sale_id: string
          status: string
          unit_cost_snapshot_cents: number
          unit_sale_price_cents: number
        }
        Insert: {
          campaign_id?: string | null
          catalog_sale_price_cents: number
          configured_discount_value?: number | null
          counts_for_fofocometro?: boolean
          created_at?: string
          discount_real_cents?: number
          discount_type?: string | null
          eligible_for_funnel?: boolean
          estimated_margin_cents: number
          gross_value_cents: number
          id?: string
          net_paid_cents: number
          product_id: string
          quantity?: number
          reward_id?: string | null
          sale_id: string
          status?: string
          unit_cost_snapshot_cents: number
          unit_sale_price_cents: number
        }
        Update: {
          campaign_id?: string | null
          catalog_sale_price_cents?: number
          configured_discount_value?: number | null
          counts_for_fofocometro?: boolean
          created_at?: string
          discount_real_cents?: number
          discount_type?: string | null
          eligible_for_funnel?: boolean
          estimated_margin_cents?: number
          gross_value_cents?: number
          id?: string
          net_paid_cents?: number
          product_id?: string
          quantity?: number
          reward_id?: string | null
          sale_id?: string
          status?: string
          unit_cost_snapshot_cents?: number
          unit_sale_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "user_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cost_total_cents: number
          couvert_cents: number
          created_at: string
          created_by: string | null
          discount_total_cents: number
          event_id: string
          external_reference: string | null
          funnel_eligible_net_cents: number
          gross_total_cents: number
          id: string
          margin_total_cents: number
          metadata: Json
          net_total_cents: number
          refunded_at: string | null
          service_fee_cents: number
          session_id: string
          source: string
          status: string
          tip_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cost_total_cents?: number
          couvert_cents?: number
          created_at?: string
          created_by?: string | null
          discount_total_cents?: number
          event_id: string
          external_reference?: string | null
          funnel_eligible_net_cents?: number
          gross_total_cents?: number
          id?: string
          margin_total_cents?: number
          metadata?: Json
          net_total_cents?: number
          refunded_at?: string | null
          service_fee_cents?: number
          session_id: string
          source?: string
          status?: string
          tip_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cost_total_cents?: number
          couvert_cents?: number
          created_at?: string
          created_by?: string | null
          discount_total_cents?: number
          event_id?: string
          external_reference?: string | null
          funnel_eligible_net_cents?: number
          gross_total_cents?: number
          id?: string
          margin_total_cents?: number
          metadata?: Json
          net_total_cents?: number
          refunded_at?: string | null
          service_fee_cents?: number
          session_id?: string
          source?: string
          status?: string
          tip_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "customer_event_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      salve_requests: {
        Row: {
          created_at: string
          event_id: string
          expires_at: string
          id: string
          opener: string | null
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          expires_at?: string
          id?: string
          opener?: string | null
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          expires_at?: string
          id?: string
          opener?: string | null
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "salve_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      security_controls: {
        Row: {
          category: string
          completed: boolean
          control_key: string
          created_at: string
          description: string
          evidence: string | null
          label: string
          notes: string | null
          required: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          category: string
          completed?: boolean
          control_key: string
          created_at?: string
          description: string
          evidence?: string | null
          label: string
          notes?: string | null
          required?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          completed?: boolean
          control_key?: string
          created_at?: string
          description?: string
          evidence?: string | null
          label?: string
          notes?: string | null
          required?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          actor_id: string | null
          category: string
          created_at: string
          details: Json
          entity: string | null
          entity_id: string | null
          event_key: string
          id: string
          occurred_at: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          target_user_id: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          category: string
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          event_key: string
          id?: string
          occurred_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          target_user_id?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          category?: string
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          event_key?: string
          id?: string
          occurred_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_reference: string | null
          id: string
          metadata: Json
          plan_id: string
          source: Database["public"]["Enums"]["payment_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_reference?: string | null
          id?: string
          metadata?: Json
          plan_id: string
          source?: Database["public"]["Enums"]["payment_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_reference?: string | null
          id?: string
          metadata?: Json
          plan_id?: string
          source?: Database["public"]["Enums"]["payment_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      title_definitions: {
        Row: {
          auto_rule: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          linked_badge_id: string | null
          name: string
          rule: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          auto_rule?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          linked_badge_id?: string | null
          name: string
          rule?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auto_rule?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          linked_badge_id?: string | null
          name?: string
          rule?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_definitions_linked_badge_id_fkey"
            columns: ["linked_badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          badge_id: string
          id: string
          is_featured: boolean
          is_hidden: boolean
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: string
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: string
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted: boolean
          created_at: string
          id: string
          ip_address: string | null
          kind: string
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          kind: string
          user_agent?: string | null
          user_id: string
          version?: string
        }
        Update: {
          accepted?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          kind?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          drink_preferences: string[]
          event_categories: string[]
          food_preferences: string[]
          marketing_opt_in: boolean
          notify_email: boolean
          notify_in_app: boolean
          notify_push: boolean
          notify_whatsapp: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drink_preferences?: string[]
          event_categories?: string[]
          food_preferences?: string[]
          marketing_opt_in?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          notify_push?: boolean
          notify_whatsapp?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drink_preferences?: string[]
          event_categories?: string[]
          food_preferences?: string[]
          marketing_opt_in?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          notify_push?: boolean
          notify_whatsapp?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_rewards: {
        Row: {
          activated_at: string | null
          activation_expires_at: string | null
          campaign_id: string
          checkin_id: string | null
          created_at: string
          event_id: string | null
          expires_at: string | null
          granted_at: string
          id: string
          reward_snapshot: Json
          source_stage_id: string | null
          status: string
          updated_at: string
          used_at: string | null
          user_id: string
          visit_scope: string
        }
        Insert: {
          activated_at?: string | null
          activation_expires_at?: string | null
          campaign_id: string
          checkin_id?: string | null
          created_at?: string
          event_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          reward_snapshot?: Json
          source_stage_id?: string | null
          status?: string
          updated_at?: string
          used_at?: string | null
          user_id: string
          visit_scope?: string
        }
        Update: {
          activated_at?: string | null
          activation_expires_at?: string | null
          campaign_id?: string
          checkin_id?: string | null
          created_at?: string
          event_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          reward_snapshot?: Json
          source_stage_id?: string | null
          status?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
          visit_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rewards_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rewards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_titles: {
        Row: {
          awarded_at: string
          id: string
          title_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          id?: string
          title_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          id?: string
          title_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_titles_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "title_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string
          created_at: string
          created_by: string | null
          default_geofence_radius_m: number
          default_max_accuracy_m: number
          google_place_id: string | null
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          created_by?: string | null
          default_geofence_radius_m?: number
          default_max_accuracy_m?: number
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          created_by?: string | null
          default_geofence_radius_m?: number
          default_max_accuracy_m?: number
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_change_sale_status: {
        Args: { _reason?: string; _sale_id: string; _status: string }
        Returns: Json
      }
      admin_commercial_snapshot: { Args: never; Returns: Json }
      admin_configure_event_funnel: {
        Args: { _config?: Json; _event_id: string }
        Returns: Json
      }
      admin_export_data: {
        Args: {
          _event_id?: string
          _from?: string
          _kind: string
          _to?: string
        }
        Returns: Json
      }
      admin_private_chat_report_queue: {
        Args: never
        Returns: {
          author_name: string
          created_at: string
          details: string
          message_body: string
          message_id: string
          reason: string
          report_id: string
          reported_user_id: string
          reporter_id: string
          reporter_name: string
          status: string
          thread_id: string
        }[]
      }
      admin_profile_completion_overview: {
        Args: never
        Returns: {
          details: Json
          percentage: number
          user_id: string
        }[]
      }
      admin_prune_security_events: { Args: { _days?: number }; Returns: number }
      admin_resolve_security_event: {
        Args: { _event_id: string; _resolution_note?: string }
        Returns: undefined
      }
      admin_security_snapshot: { Args: never; Returns: Json }
      admin_set_manual_badge: {
        Args: { _badge_slug: string; _enabled: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_security_control: {
        Args: {
          _completed: boolean
          _control_key: string
          _evidence?: string
          _notes?: string
        }
        Returns: undefined
      }
      admin_upsert_product: {
        Args: {
          _category?: string
          _cost_cents?: number
          _name: string
          _reason?: string
          _sale_price_cents?: number
        }
        Returns: {
          active: boolean
          category: string
          counts_for_fofocometro: boolean
          counts_for_funnel: boolean
          created_at: string
          created_by: string | null
          current_cost_cents: number
          current_sale_price_cents: number
          discount_eligible: boolean
          id: string
          max_discount_cents: number | null
          normalized_name: string
          notes: string | null
          original_name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      award_profile_progress: { Args: { _user_id: string }; Returns: undefined }
      calculate_profile_completeness: {
        Args: { _user_id: string }
        Returns: number
      }
      campaign_progress_for_user: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: {
          completed: boolean
          progress_value: number
          target_value: number
        }[]
      }
      can_access_event_chat: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_event_chat: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      checkin_with_geolocation: {
        Args: {
          _accuracy_m: number
          _event_id: string
          _latitude: number
          _longitude: number
        }
        Returns: Json
      }
      close_event_checkin: { Args: { _event_id: string }; Returns: undefined }
      check_content_allowed: {
        Args: { _context?: string; _value: string }
        Returns: Json
      }
      create_my_qr_token: {
        Args: { _purpose: string; _ref_id?: string }
        Returns: {
          expires_at: string
          short_code: string
          token: string
        }[]
      }
      current_user_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      delete_event_chat_message: {
        Args: { _message_id: string }
        Returns: undefined
      }
      duplicate_event_with_campaigns: {
        Args: { _event_id: string }
        Returns: string
      }
      event_fofocometro: { Args: { _event_id: string }; Returns: Json }
      event_status_from_schedule: {
        Args: {
          _current_status: string
          _ends_at: string
          _reference_at?: string
          _starts_at: string
        }
        Returns: string
      }
      get_event_chat_feed: {
        Args: { _event_id: string; _limit?: number }
        Returns: {
          author_avatar_url: string
          author_badges: Json
          author_id: string
          author_name: string
          author_title: string
          author_username: string
          body: string
          created_at: string
          event_id: string
          is_mine: boolean
          message_id: string
          reply_to: string
        }[]
      }
      get_public_profile: { Args: { _username: string }; Returns: Json }
      grant_badge_by_slug: {
        Args: { _slug: string; _user_id: string }
        Returns: undefined
      }
      grant_event_campaign_rewards: {
        Args: { _checkin_id: string; _event_id: string; _user_id: string }
        Returns: number
      }
      grant_title_by_slug: {
        Args: { _slug: string; _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inspect_commercial_qr: { Args: { _token: string }; Returns: Json }
      is_event_chat_blocked: {
        Args: { _author: string; _viewer: string }
        Returns: boolean
      }
      is_verified_adult: { Args: { _user_id: string }; Returns: boolean }
      moderate_event_chat_message: {
        Args: { _message_id: string; _reason?: string; _restore?: boolean }
        Returns: undefined
      }
      moderate_private_chat_report: {
        Args: { _action: string; _report_id: string }
        Returns: undefined
      }
      my_auth_security_status: { Args: never; Returns: Json }
      my_event_chat_blocks: {
        Args: never
        Returns: {
          avatar_url: string
          blocked_at: string
          blocked_user_id: string
          display_name: string
          is_public: boolean
          username: string
        }[]
      }
      my_event_chat_rooms: {
        Args: never
        Returns: {
          category: string
          chat_closes_at: string
          ends_at: string
          event_id: string
          event_name: string
          image_url: string
          last_message_at: string
          message_count: number
          starts_at: string
        }[]
      }
      my_event_journey: { Args: never; Returns: Json }
      my_fofoquinhas: {
        Args: never
        Returns: {
          activation_expires_at: string
          benefit_type: string
          campaign_id: string
          campaign_kind: string
          completed: boolean
          description: string
          discount_percent: number
          ends_at: string
          external_button_label: string
          external_open_new_tab: boolean
          external_url: string
          feed_priority: number
          fixed_off_cents: number
          home_sort_order: number
          home_visible: boolean
          is_pinned: boolean
          name: string
          product_category: string
          product_id: string
          product_name: string
          progress_value: number
          public_copy: string
          public_rules: string
          public_title: string
          redemption_mode: string
          reward_expires_at: string
          reward_id: string
          reward_status: string
          starts_at: string
          trigger_target: number
          trigger_type: string
          visit_scope: string
        }[]
      }
      my_house_session: { Args: never; Returns: Json }
      my_profile_completeness: { Args: never; Returns: number }
      my_profile_completion_details: { Args: never; Returns: Json }
      my_salve_requests: {
        Args: { _event_id: string }
        Returns: {
          created_at: string
          id: string
          opener: string
          other_user_id: string
          recipient_id: string
          recipient_name: string
          sender_id: string
          sender_name: string
          status: string
          thread_id: string
        }[]
      }
      normalize_product_name: { Args: { _name: string }; Returns: string }
      open_customer_event_session: {
        Args: { _checkin_id?: string; _event_id: string; _user_id: string }
        Returns: string
      }
      profile_completion_details: { Args: { _user_id: string }; Returns: Json }
      recalculate_customer_event_session: {
        Args: { _session_id: string }
        Returns: {
          checkin_id: string | null
          cost_total_cents: number
          created_at: string
          current_stage: number
          discount_total_cents: number
          entered_at: string
          event_id: string
          exited_at: string | null
          funnel_net_total_cents: number
          gross_total_cents: number
          id: string
          last_purchase_at: string | null
          margin_total_cents: number
          net_total_cents: number
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_event_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_customer_sale: {
        Args: {
          _commercial_token: string
          _couvert_cents?: number
          _event_id: string
          _external_reference?: string
          _items: Json
          _service_fee_cents?: number
          _source?: string
          _tip_cents?: number
        }
        Returns: Json
      }
      record_security_event: {
        Args: {
          _actor_id?: string
          _category: string
          _details?: Json
          _entity?: string
          _entity_id?: string
          _event_key: string
          _severity: string
          _target_user_id?: string
          _title: string
        }
        Returns: string
      }
      redeem_reward_qr: { Args: { _token: string }; Returns: Json }
      refresh_customer_funnel: {
        Args: { _event_id: string; _user_id: string }
        Returns: number
      }
      refresh_my_reward_statuses: { Args: never; Returns: number }
      refresh_profile_crm: { Args: { _user_id: string }; Returns: string }
      refresh_user_milestone_rewards: {
        Args: { _user_id: string }
        Returns: number
      }
      report_event_chat_message: {
        Args: { _details?: string; _message_id: string; _reason: string }
        Returns: undefined
      }
      report_private_chat_message: {
        Args: { _details?: string; _message_id: string; _reason: string }
        Returns: string
      }
      respond_salve_request: {
        Args: { _accept: boolean; _request_id: string }
        Returns: Json
      }
      send_event_chat_message: {
        Args: { _body: string; _event_id: string; _reply_to?: string }
        Returns: string
      }
      send_private_message: {
        Args: { _body: string; _thread_id: string }
        Returns: string
      }
      send_salve_request: {
        Args: { _event_id: string; _opener?: string; _recipient_id: string }
        Returns: Json
      }
      set_event_chat_block: {
        Args: { _blocked: boolean; _blocked_user_id: string }
        Returns: undefined
      }
      set_my_preferences: {
        Args: {
          _consent_version?: string
          _drink_preferences?: string[]
          _event_categories?: string[]
          _food_preferences?: string[]
          _marketing_opt_in?: boolean
          _notify_email?: boolean
          _notify_in_app?: boolean
          _notify_push?: boolean
          _notify_whatsapp?: boolean
        }
        Returns: undefined
      }
      submit_event_review: {
        Args: {
          _atmosphere_rating?: number
          _comment?: string
          _event_id: string
          _music_rating?: number
          _rating: number
          _service_rating?: number
          _would_return?: boolean
        }
        Returns: Json
      }
      sync_event_statuses: { Args: never; Returns: number }
      track_campaign_external_click: {
        Args: { _campaign_id: string; _source?: string }
        Returns: string
      }
      validate_checkin_qr: {
        Args: { _event_id?: string; _token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "visitante"
        | "gratuito"
        | "premium"
        | "equipe"
        | "moderador"
        | "admin"
      payment_source: "demo" | "stripe" | "manual" | "pix"
      plan_code: "gratuito" | "carteirinha_mensal" | "carteirinha_anual"
      subscription_status:
        | "teste"
        | "ativa"
        | "pendente"
        | "vencida"
        | "cancelada"
        | "inadimplente"
        | "em_carencia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "visitante",
        "gratuito",
        "premium",
        "equipe",
        "moderador",
        "admin",
      ],
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
} as const
