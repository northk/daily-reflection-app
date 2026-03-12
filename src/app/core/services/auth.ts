import { Injectable, signal, computed } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService } from '@core/services/supabase';
import { BrowserUiService } from '@core/services/browser-ui';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<Session | null>(null);
  private _recoveryMode = signal(false);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly recoveryMode = this._recoveryMode.asReadonly();

  constructor(
    private supabase: SupabaseService,
    private browserUi: BrowserUiService,
  ) {
    // Hydrate with the persisted session on startup
    this.supabase.client.auth.getSession().then(({ data }) => {
      this._session.set(data.session);
    });

    // Keep in sync with auth state changes (sign-in, sign-out, token refresh)
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        this._recoveryMode.set(true);
      }
      this._session.set(session);
    });
  }

  clearRecoveryMode(): void {
    this._recoveryMode.set(false);
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

  async resetPassword(email: string): Promise<void> {
    const origin = this.browserUi.getOrigin();
    if (!origin) throw new Error('Password reset is only available in the browser.');

    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) throw error;
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) throw error;
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
