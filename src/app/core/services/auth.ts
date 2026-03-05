import { Injectable } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '@core/services/supabase';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sessionSubject = new BehaviorSubject<Session | null>(null);

  session$: Observable<Session | null> = this.sessionSubject.asObservable();

  user$: Observable<User | null> = this.session$.pipe(
    map(session => session?.user ?? null)
  );

  constructor(private supabase: SupabaseService) {
    // Hydrate with the persisted session on startup
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.sessionSubject.next(data.session);
    });

    // Keep in sync with auth state changes (sign-in, sign-out, token refresh)
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.sessionSubject.next(session);
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
