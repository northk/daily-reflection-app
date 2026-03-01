import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatCardActions } from '@angular/material/card';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { AuthService } from '@core/services/auth';
import { LoadingComponent } from '@shared/components/loading/loading';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatCardActions,
    MatFormField, MatLabel, MatError,
    MatInput,
    MatButton,
    LoadingComponent,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  mode: 'signin' | 'signup' = 'signin';
  loading = false;
  error: string | null = null;
  confirmationSent = false;

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
    return this.mode === 'signup';
  }

  toggleMode(): void {
    this.mode = this.isSignUp ? 'signin' : 'signup';
    this.error = null;
    this.confirmationSent = false;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    this.error = null;

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
          this.confirmationSent = true;
        }
      } else {
        await this.auth.signIn(email, password);
        await this.router.navigate(['/today']);
      }
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
