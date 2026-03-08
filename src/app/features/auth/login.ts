import { Component, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatCardActions } from '@angular/material/card';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput, MatSuffix } from '@angular/material/input';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { AuthService } from '@core/services/auth';
import { LoadingComponent } from '@shared/components/loading/loading';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatCardActions,
    MatFormField, MatLabel, MatError,
    MatInput, MatSuffix,
    MatButton, MatIconButton,
    MatIcon,
    LoadingComponent,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  readonly mode = signal<'signin' | 'signup'>('signin');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly confirmationSent = signal(false);
  readonly showPassword = signal(false);

  form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  constructor(private auth: AuthService, private router: Router) {}

  get isSignUp(): boolean {
    return this.mode() === 'signup';
  }

  toggleMode(): void {
    this.mode.update(m => m === 'signup' ? 'signin' : 'signup');
    this.error.set(null);
    this.confirmationSent.set(false);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();

    try {
      if (this.isSignUp) {
        await this.auth.signUp(email, password);
        // If Supabase auto-confirms (e.g. local dev), a session exists immediately.
        // Otherwise the user must click their confirmation email before signing in.
        const token = await this.auth.getAccessToken();
        if (token) {
          await this.router.navigate(['/today']);
        } else {
          this.confirmationSent.set(true);
        }
      } else {
        await this.auth.signIn(email, password);
        await this.router.navigate(['/today']);
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
