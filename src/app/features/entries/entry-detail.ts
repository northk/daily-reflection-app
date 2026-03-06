import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  selector: 'app-entry-detail',
  standalone: true,
  imports: [
    RouterLink,
    MatButton,
    MatIcon,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    EntryEditorComponent,
    LoadingComponent,
    HeroBannerComponent,
  ],
  templateUrl: './entry-detail.html',
  styleUrl: './entry-detail.scss',
})
export class EntryDetailComponent {
  readonly entry = signal<Entry | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly reflecting = signal(false);
  readonly reflectResult = signal<ReflectDeeperResponse | null>(null);
  readonly showDeleteConfirm = signal(false);

  private readonly id: string | null;

  constructor(
    private entriesService: EntriesService,
    private auth: AuthService,
    private aiService: AiService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.id = this.route.snapshot.paramMap.get('id');
    if (!this.id) {
      this.router.navigate(['/entries']);
    } else {
      this.loadEntry();
    }
  }

  async onSave(formValue: Partial<Entry>): Promise<void> {
    const entry = this.entry();
    if (!entry) return;
    this.saving.set(true);
    try {
      const user = this.auth.user()!;
      const payload: Entry = {
        id: entry.id,
        user_id: user.id,
        entry_date: entry.entry_date,
        title: formValue.title ?? null,
        body: formValue.body ?? '',
        mood: formValue.mood ?? null,
        tags: formValue.tags ?? [],
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      };
      this.entry.set(await this.entriesService.upsertEntry(payload));
      this.snackBar.open('Entry saved.', undefined, { duration: 2000 });
    } catch {
      this.snackBar.open('Could not save. Please try again.', 'Dismiss', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  async onReflectDeeper(): Promise<void> {
    const entry = this.entry();
    if (!entry) return;
    this.reflecting.set(true);
    this.reflectResult.set(null);
    try {
      this.reflectResult.set(await this.aiService.reflectDeeper(entry));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate reflection. Please try again.';
      this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
    } finally {
      this.reflecting.set(false);
    }
  }

  onDeleteRequest(): void {
    this.showDeleteConfirm.set(true);
  }

  onDeleteCancel(): void {
    this.showDeleteConfirm.set(false);
  }

  async onDeleteConfirm(): Promise<void> {
    if (!this.id) return;
    try {
      await this.entriesService.deleteEntry(this.id);
      this.snackBar.open('Entry deleted.', undefined, { duration: 2000 });
      this.router.navigate(['/entries']);
    } catch {
      this.snackBar.open('Could not delete. Please try again.', 'Dismiss', { duration: 4000 });
      this.showDeleteConfirm.set(false);
    }
  }

  private async loadEntry(): Promise<void> {
    try {
      this.entry.set(await this.entriesService.getEntryById(this.id!));
      if (!this.entry()) {
        this.snackBar.open('Entry not found.', 'Dismiss', { duration: 4000 });
        this.router.navigate(['/entries']);
      }
    } catch {
      this.snackBar.open('Could not load entry.', 'Dismiss', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }
}
