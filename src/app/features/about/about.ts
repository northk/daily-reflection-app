import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { HeroBannerComponent } from '@shared/components/hero-banner/hero-banner';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, MatCard, MatCardContent, MatCardHeader, MatCardTitle, HeroBannerComponent],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class AboutComponent {}
