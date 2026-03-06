import { Injectable, signal, computed } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService } from '@core/services/supabase';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<Session | null>(null);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);

  constructor(private supabase: SupabaseService) {
    // Hydrate with the persisted session on startup
    this.supabase.client.auth.getSession().then(({ data }) => {
      this._session.set(data.session);
    });

    // Keep in sync with auth state changes (sign-in, sign-out, token refresh)
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
    });
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) throw error;
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async deleteAccount(): Promise<void> {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${environment.supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? 'Account deletion failed');
    }

    await this.signOut();
  }
}
