import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { User } from '@supabase/supabase-js';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { EntriesService } from '@core/services/entries';
import { AuthService } from '@core/services/auth';
import { AiService } from '@core/services/ai';
import { Entry } from '@core/models/entry';
import type { ReflectDeeperResponse } from '@core/models/ai';
import { EntryEditorComponent } from '@shared/components/entry-editor/entry-editor';
import { LoadingComponent } from '@shared/components/loading/loading';
import { HeroBannerComponent } from '@shared/components/hero-banner/hero-banner';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [
    MatButton,
    MatIcon,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    EntryEditorComponent,
    HeroBannerComponent,
    LoadingComponent,
  ],
  templateUrl: './today.html',
  styleUrl: './today.scss',
})
export class TodayComponent implements OnInit {
  entry: Entry | null = null;
  loading = true;
  saving = false;
  reflecting = false;
  reflectResult: ReflectDeeperResponse | null = null;

  // Use local date parts to avoid UTC-vs-local timezone shift
  readonly todayDate: string = this.getLocalDateString();

  constructor(
    private entries: EntriesService,
    private auth: AuthService,
    private aiService: AiService,
    private snackBar: MatSnackBar,
  ) {}

  get todayLabel(): string {
    const [y, m, d] = this.todayDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  ngOnInit(): void {
    this.loadEntry();
  }

  async onSave(formValue: Partial<Entry>): Promise<void> {
    this.saving = true;
    try {
      const user = await firstValueFrom(
        this.auth.user$.pipe(filter((u): u is User => u !== null)),
      );
      const payload: Entry = {
        id: this.entry?.id,
        user_id: user.id,
        entry_date: this.todayDate,
        title: formValue.title ?? null,
        body: formValue.body ?? '',
        mood: formValue.mood ?? null,
        tags: formValue.tags ?? [],
        created_at: this.entry?.created_at,
        updated_at: this.entry?.updated_at,
      };
      this.entry = await this.entries.upsertEntry(payload);
      this.snackBar.open('Entry saved.', undefined, { duration: 2000 });
    } catch {
      this.snackBar.open('Could not save. Please try again.', 'Dismiss', { duration: 4000 });
    } finally {
      this.saving = false;
    }
  }

  async onReflectDeeper(): Promise<void> {
    const entry = this.entry;
    if (!entry) return;
    this.reflecting = true;
    this.reflectResult = null;
    try {
      this.reflectResult = await this.aiService.reflectDeeper(entry);
    } catch {
      this.snackBar.open('Could not generate reflection. Please try again.', 'Dismiss', { duration: 4000 });
    } finally {
      this.reflecting = false;
    }
  }

  private async loadEntry(): Promise<void> {
    try {
      this.entry = await this.entries.getEntryByDate(this.todayDate);
    } catch {
      this.snackBar.open('Could not load today\'s entry.', 'Dismiss', { duration: 4000 });
    } finally {
      this.loading = false;
    }
  }

  private getLocalDateString(): string {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
