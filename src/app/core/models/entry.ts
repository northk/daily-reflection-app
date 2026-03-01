export interface Entry {
  id?: string;
  user_id?: string;
  entry_date: string; // YYYY-MM-DD
  title?: string | null;
  body: string;
  tags: string[];
  mood?: number | null; // 1–10
  created_at?: string;
  updated_at?: string;
}
