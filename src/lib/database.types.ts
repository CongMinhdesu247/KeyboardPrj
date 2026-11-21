
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_members": {
                  Row: {
                    "active": boolean,"created_at": string,"email": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"email": string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"email"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"home_banners": {
                  Row: {
                    "active": boolean,"image_path": string | null,"product_id": number | null,"slot": number,"subtitle": string,"title": string,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"image_path"?: string | null,"product_id"?: number | null,"slot": number,"subtitle"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "active"?: boolean,"image_path"?: string | null,"product_id"?: number | null,"slot"?: number,"subtitle"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "home_banners_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products_services"
      referencedColumns: ["id"]
    }
                  ]
                },"products_services": {
                  Row: {
                    "active": boolean,"archived_at": string | null,"category_slug": string,"created_at": string,"description": string,"id": number,"image_path": string | null,"image_paths": (string)[],"lube_package": string | null,"name": string,"price_vnd": number | null,"stock_quantity": number | null,"type": string,"unit": string,"updated_at": string,"version": number,"video_path": string | null,"video_url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"archived_at"?: string | null,"category_slug": string,"created_at"?: string,"description"?: string,"id"?: never,"image_path"?: string | null,"image_paths"?: (string)[],"lube_package"?: string | null,"name": string,"price_vnd"?: number | null,"stock_quantity"?: number | null,"type": string,"unit": string,"updated_at"?: string,"version"?: number,"video_path"?: string | null,"video_url"?: string
                  }
                  Update: {
                    "active"?: boolean,"archived_at"?: string | null,"category_slug"?: string,"created_at"?: string,"description"?: string,"id"?: never,"image_path"?: string | null,"image_paths"?: (string)[],"lube_package"?: string | null,"name"?: string,"price_vnd"?: number | null,"stock_quantity"?: number | null,"type"?: string,"unit"?: string,"updated_at"?: string,"version"?: number,"video_path"?: string | null,"video_url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_services_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "service_categories"
      referencedColumns: ["slug"]
    }
                  ]
                },"service_categories": {
                  Row: {
                    "active": boolean,"description": string,"id": number,"position": number,"slug": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"description"?: string,"id"?: never,"position": number,"slug": string,"title": string
                  }
                  Update: {
                    "active"?: boolean,"description"?: string,"id"?: never,"position"?: number,"slug"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "account_growth":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"account_report":
{ Args: { "p_offset"?: number,"p_query"?: string,"p_status"?: string }; Returns: Json
                           },
"adjust_inventory":
{ Args: { "p_delta": number,"p_id": number,"p_reason": string,"p_request_id": string }; Returns: Json
                           },
"admin_chat":
{ Args: { "p_id"?: string }; Returns: Json
                           },
"admin_inbox":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_unread"?: boolean }; Returns: Json
                           },
"admin_notifications":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"archive_catalog_item":
{ Args: { "p_id": number,"p_version": number }; Returns: Json
                           },
"begin_chat":
{ Args: { "p_hash": string,"p_id": string,"p_text": string }; Returns: Json
                           },
"bootstrap_first_admin":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"cash_report":
{ Args: { "p_from": string,"p_group"?: string,"p_page"?: number,"p_to": string }; Returns: Json
                           },
"chat_history":
{ Args: { "p_hash": string }; Returns: Json
                           },
"claim_notifications":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"consume_request_budget":
{ Args: { "p_key": string }; Returns: boolean
                           },
"create_admin_invite":
{ Args: { "p_token_hash": string }; Returns: Json
                           },
"customer_orders":
{ Args: { "p_user": string }; Returns: Json
                           },
"finish_chat":
{ Args: { "p_hash": string,"p_id": string,"p_lease": string,"p_mode": string,"p_text": string }; Returns: boolean
                           },
"finish_notification":
{ Args: { "p_error"?: string,"p_id": string,"p_lease": string,"p_retry"?: number }; Returns: boolean
                           },
"handoff_chat":
{ Args: { "p_hash": string }; Returns: boolean
                           },
"has_live_session":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_admin_invites":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_catalog_admin":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_custom_requests":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_inventory_movements":
{ Args: { "p_id": number }; Returns: Json
                           },
"list_orders":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_portfolio_admin":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"lookup_checkout":
{ Args: { "p_hash": string,"p_request": string }; Returns: Json
                           },
"lookup_request_submission":
{ Args: { "p_hash": string,"p_id": string }; Returns: Json
                           },
"manage_account":
{ Args: { "p_action": string,"p_id": string,"p_reason": string,"p_version": number }; Returns: Json
                           },
"my_orders":
{ Args: { "p_offset"?: number }; Returns: Json
                           },
"order_command":
{ Args: { "p": Json }; Returns: Json
                           },
"read_admin_notifications":
{ Args: { "p_before"?: string,"p_ids"?: (string)[] }; Returns: number
                           },
"read_order":
{ Args: { "p_id": string }; Returns: Json
                           },
"read_published_portfolio":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"redeem_admin_invite":
{ Args: { "p_token_hash": string }; Returns: Json
                           },
"retry_failed_notifications":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"revoke_admin_invite":
{ Args: { "p_id": number }; Returns: Json
                           },
"save_catalog_item":
{ Args: { "p_item": Json }; Returns: Json
                           },
"save_home_banner":
{ Args: { "p_active": boolean,"p_clear"?: boolean,"p_image": string,"p_product": number,"p_slot": number,"p_subtitle": string,"p_title": string,"p_version": number }; Returns: Json
                           },
"save_portfolio":
{ Args: { "p": Json }; Returns: Json
                           },
"set_admin_active":
{ Args: { "p_active": boolean,"p_user_id": string }; Returns: Json
                           },
"set_catalog_media":
{ Args: { "p_id": number,"p_images": (string)[],"p_version": number,"p_video_path": string,"p_video_url": string }; Returns: Json
                           },
"submit_account_order":
{ Args: { "p": Json }; Returns: Json
                           },
"submit_custom_request":
{ Args: { "p": Json }; Returns: Json
                           },
"submit_customer_order":
{ Args: { "p": Json }; Returns: Json
                           },
"touch_account":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"track_order":
{ Args: { "p_code": string }; Returns: Json
                           },
"update_custom_request":
{ Args: { "p_id": string,"p_note": string,"p_status": string,"p_version": number }; Returns: Json
                           },
"update_customer_profile":
{ Args: { "p_address": string,"p_name": string,"p_phone": string,"p_version": number }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
