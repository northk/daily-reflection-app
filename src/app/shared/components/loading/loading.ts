import { Component, Input } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [MatProgressSpinner],
  templateUrl: './loading.html',
  styleUrl: './loading.scss',
})
export class LoadingComponent {
  @Input() diameter = 40;
}
