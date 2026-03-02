import { Injectable } from '@angular/core';
import { AuthService } from '@core/services/auth';
import { Entry } from '@core/models/entry';
import type { ReflectDeeperResponse, WeeklySummaryResponse } from '@core/models/ai';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class AiService {
  constructor(private auth: AuthService) {}

  async reflectDeeper(entry: Entry): Promise<ReflectDeeperResponse> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(
      `${environment.supabaseUrl}/functions/v1/reflect-deeper`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ entry }),
      }
    );

    if (!response.ok) {
      throw new Error(`Reflect Deeper failed (${response.status}): ${response.statusText}`);
    }

    return response.json();
  }

  async weeklySummary(entries: Entry[]): Promise<WeeklySummaryResponse> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(
      `${environment.supabaseUrl}/functions/v1/weekly-summary`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ entries }),
      }
    );

    if (!response.ok) {
      throw new Error(`Weekly Summary failed (${response.status}): ${response.statusText}`);
    }

    return response.json();
  }
}
