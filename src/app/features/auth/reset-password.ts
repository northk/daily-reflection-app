import { Component, OnDestroy, signal, effect } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatCardActions } from '@angular/material/card';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput, MatSuffix } from '@angular/material/input';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '@core/services/auth';
import { LoadingComponent } from '@shared/components/loading/loading';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatCardActions,
    MatFormField, MatLabel, MatError,
    MatInput, MatSuffix,
    MatButton, MatIconButton,
    MatIcon,
    LoadingComponent,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPasswordComponent implements OnDestroy {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly sessionReady = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  private timeoutId?: ReturnType<typeof setTimeout>;

  form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatch },
  );

  constructor(
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.timeoutId = setTimeout(() => {
      if (this.loading()) {
        this.loading.set(false);
        this.error.set('Invalid or expired reset link.');
      }
    }, 5000);

    // React to AuthService detecting PASSWORD_RECOVERY event.
    // effect() runs once eagerly (catches already-set signal) and on every subsequent change.
    effect(() => {
      if (this.auth.recoveryMode()) {
        clearTimeout(this.timeoutId);
        this.sessionReady.set(true);
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timeoutId);
    this.auth.clearRecoveryMode();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);

    try {
      await this.auth.updatePassword(this.form.getRawValue().password);
      this.snackBar.open('Password updated.', 'Dismiss', { duration: 4000 });
      await this.router.navigate(['/today']);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
