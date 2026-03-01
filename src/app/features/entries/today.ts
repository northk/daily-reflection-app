import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { User } from '@supabase/supabase-js';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EntriesService } from '@core/services/entries';
import { AuthService } from '@core/services/auth';
import { Entry } from '@core/models/entry';
import { EntryEditorComponent } from '@shared/components/entry-editor/entry-editor';
import { LoadingComponent } from '@shared/components/loading/loading';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [EntryEditorComponent, LoadingComponent],
  templateUrl: './today.html',
  styleUrl: './today.scss',
})
export class TodayComponent implements OnInit {
  entry: Entry | null = null;
  loading = true;
  saving = false;

  // Use local date parts to avoid UTC-vs-local timezone shift
  readonly todayDate: string = this.getLocalDateString();

  constructor(
    private entries: EntriesService,
    private auth: AuthService,
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
