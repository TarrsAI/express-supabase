/**
 * Auto-generated Supabase types live here. Regenerate after every
 * schema change:
 *
 *   pnpm db:types
 *
 * (Requires `supabase link --project-ref <ref>` once on this machine.)
 *
 * The hand-written placeholder below lets `pnpm typecheck` pass before
 * you've linked a real Supabase project. Replace it with the generator
 * output as soon as you have one — the service layer expects the real
 * Database['public']['Tables'] shape.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      posts: {
        Row: {
          id: string;
          title: string;
          body: string;
          author_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          author_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          author_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
