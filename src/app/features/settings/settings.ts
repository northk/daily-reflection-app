import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatDivider } from '@angular/material/divider';
import { EntriesService } from '@core/services/entries';
import { AuthService } from '@core/services/auth';
import { HeroBannerComponent } from '@shared/components/hero-banner/hero-banner';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatProgressSpinner,
    MatDivider,
    HeroBannerComponent,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsComponent {
  readonly downloadingCsv = signal(false);
  readonly deletingEntries = signal(false);
  readonly deletingAccount = signal(false);
  readonly confirmDeleteEntries = signal(false);
  readonly confirmDeleteAccount = signal(false);

  constructor(
    private entriesService: EntriesService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  async onDownloadCsv(): Promise<void> {
    this.downloadingCsv.set(true);
    try {
      await this.entriesService.downloadEntriesAsCsv();
    } catch {
      this.snackBar.open('Export failed. Please try again.', 'Dismiss', { duration: 4000 });
    } finally {
      this.downloadingCsv.set(false);
    }
  }

  async onDeleteEntries(): Promise<void> {
    this.deletingEntries.set(true);
    try {
      await this.entriesService.deleteAllEntries();
      this.snackBar.open('All entries deleted.', 'OK', { duration: 4000 });
      this.confirmDeleteEntries.set(false);
    } catch {
      this.snackBar.open('Delete failed. Please try again.', 'Dismiss', { duration: 4000 });
    } finally {
      this.deletingEntries.set(false);
    }
  }

  async onDeleteAccount(): Promise<void> {
    this.deletingAccount.set(true);
    try {
      await this.authService.deleteAccount();
      this.router.navigateByUrl('/login');
    } catch {
      this.snackBar.open('Account deletion failed. Please try again.', 'Dismiss', { duration: 4000 });
      this.deletingAccount.set(false);
    }
  }
}
