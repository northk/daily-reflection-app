import { Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase';
import { Entry } from '@core/models/entry';

@Injectable({ providedIn: 'root' })
export class EntriesService {
  constructor(private supabase: SupabaseService) {}

  async getEntryByDate(date: string): Promise<Entry | null> {
    const { data, error } = await this.supabase.client
      .from('entries')
      .select('*')
      .eq('entry_date', date)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // NOTE: caller is responsible for setting entry.user_id to the current user's id
  // before calling this method, to satisfy the RLS WITH CHECK constraint.
  async upsertEntry(entry: Entry): Promise<Entry> {
    const { data, error } = await this.supabase.client
      .from('entries')
      .upsert(entry, { onConflict: 'user_id,entry_date' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getEntries(params: {
    q?: string;
    tag?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Entry[]> {
    let query = this.supabase.client
      .from('entries')
      .select('*')
      .order('entry_date', { ascending: false });

    if (params.q) {
      query = query.or(`title.ilike.%${params.q}%,body.ilike.%${params.q}%`);
    }
    if (params.tag) {
      query = query.contains('tags', [params.tag]);
    }
    if (params.limit !== undefined) {
      query = query.limit(params.limit);
    }
    if (params.offset !== undefined && params.limit !== undefined) {
      query = query.range(params.offset, params.offset + params.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getEntryById(id: string): Promise<Entry | null> {
    const { data, error } = await this.supabase.client
      .from('entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('entries')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async getEntriesInRange(startDate: string, endDate: string): Promise<Entry[]> {
    const { data, error } = await this.supabase.client
      .from('entries')
      .select('*')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}
