import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { User } from '@supabase/supabase-js';
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
export class EntryDetailComponent implements OnInit {
  entry: Entry | null = null;
  loading = true;
  saving = false;
  reflecting = false;
  reflectResult: ReflectDeeperResponse | null = null;
  showDeleteConfirm = false;

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
  }

  ngOnInit(): void {
    if (!this.id) {
      this.router.navigate(['/entries']);
      return;
    }
    this.loadEntry();
  }

  async onSave(formValue: Partial<Entry>): Promise<void> {
    const entry = this.entry;
    if (!entry) return;
    this.saving = true;
    try {
      const user = await firstValueFrom(
        this.auth.user$.pipe(filter((u): u is User => u !== null)),
      );
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
      this.entry = await this.entriesService.upsertEntry(payload);
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

  onDeleteRequest(): void {
    this.showDeleteConfirm = true;
  }

  onDeleteCancel(): void {
    this.showDeleteConfirm = false;
  }

  async onDeleteConfirm(): Promise<void> {
    if (!this.id) return;
    try {
      await this.entriesService.deleteEntry(this.id);
      this.snackBar.open('Entry deleted.', undefined, { duration: 2000 });
      this.router.navigate(['/entries']);
    } catch {
      this.snackBar.open('Could not delete. Please try again.', 'Dismiss', { duration: 4000 });
      this.showDeleteConfirm = false;
    }
  }

  private async loadEntry(): Promise<void> {
    try {
      this.entry = await this.entriesService.getEntryById(this.id!);
      if (!this.entry) {
        this.snackBar.open('Entry not found.', 'Dismiss', { duration: 4000 });
        this.router.navigate(['/entries']);
      }
    } catch {
      this.snackBar.open('Could not load entry.', 'Dismiss', { duration: 4000 });
    } finally {
      this.loading = false;
    }
  }
}
