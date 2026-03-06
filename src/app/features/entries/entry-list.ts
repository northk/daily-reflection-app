import { Component, DestroyRef, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatCardSubtitle } from '@angular/material/card';
import { EntriesService } from '@core/services/entries';
import { Entry } from '@core/models/entry';
import { LoadingComponent } from '@shared/components/loading/loading';
import { HeroBannerComponent } from '@shared/components/hero-banner/hero-banner';

@Component({
  selector: 'app-entry-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormField,
    MatLabel,
    MatSuffix,
    MatInput,
    MatIcon,
    MatIconButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatCardSubtitle,
    LoadingComponent,
    HeroBannerComponent,
  ],
  templateUrl: './entry-list.html',
  styleUrl: './entry-list.scss',
})
export class EntryListComponent {
  readonly entries = signal<Entry[]>([]);
  readonly loading = signal(true);

  readonly searchControl = new FormControl('');
  readonly tagFilter = new FormControl<string | null>(null);

  constructor(
    private entriesService: EntriesService,
    private destroyRef: DestroyRef,
    private snackBar: MatSnackBar,
  ) {
    merge(this.searchControl.valueChanges, this.tagFilter.valueChanges)
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadEntries());

    this.loadEntries();
  }

  setTagFilter(tag: string): void {
    const current = this.tagFilter.value;
    this.tagFilter.setValue(current === tag ? null : tag);
  }

  formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private async loadEntries(): Promise<void> {
    this.loading.set(true);
    try {
      this.entries.set(await this.entriesService.getEntries({
        q: this.searchControl.value || undefined,
        tag: this.tagFilter.value || undefined,
      }));
    } catch {
      this.snackBar.open('Could not load entries.', 'Dismiss', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }
}
