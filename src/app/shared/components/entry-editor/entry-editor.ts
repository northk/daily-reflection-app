import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Entry } from '@core/models/entry';
import { TagChipsComponent } from '@shared/components/tag-chips/tag-chips';
import { LoadingComponent } from '@shared/components/loading/loading';
import { SpeechRecognitionService } from '@core/services/speech-recognition';

@Component({
  selector: 'app-entry-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormField, MatLabel, MatError,
    MatInput,
    MatSelect, MatOption,
    MatButton, MatIconButton,
    MatIcon,
    MatTooltip,
    TagChipsComponent,
    LoadingComponent,
  ],
  templateUrl: './entry-editor.html',
  styleUrl: './entry-editor.scss',
})
export class EntryEditorComponent implements OnChanges {
  @Input() entry: Entry | null = null;
  @Input() date: string | null = null;
  @Input() saving = false;
  @Output() save = new EventEmitter<Partial<Entry>>();

  private readonly speech = inject(SpeechRecognitionService);
  readonly speechSupported = this.speech.supported;
  readonly listening = this.speech.listening;

  get dateLabel(): string {
    if (!this.date) return '';
    const [y, m, d] = this.date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  private lastPatchedId: string | undefined;

  readonly moodOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  form = new FormGroup({
    title: new FormControl<string>(''),
    body: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    mood: new FormControl<number | null>(null),
    tags: new FormControl<string[]>([], { nonNullable: true }),
  });

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.entry && this.entry.id !== this.lastPatchedId) {
      this.lastPatchedId = this.entry.id;
      this.form.patchValue({
        title: this.entry.title ?? '',
        body: this.entry.body,
        mood: this.entry.mood ?? null,
        tags: [...this.entry.tags],
      });
    }
  }

  onTagsChange(tags: string[]): void {
    this.form.controls.tags.setValue(tags);
  }

  onMicClick(): void {
    if (this.speech.listening()) {
      this.speech.stop();
      return;
    }
    this.speech.start((segment: string) => {
      const current = this.form.controls.body.value ?? '';
      const separator = current && !current.endsWith(' ') ? ' ' : '';
      this.form.controls.body.setValue(current + separator + segment);
    });
  }

  onClearBody(): void {
    this.form.controls.body.setValue('');
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;
    this.save.emit(this.form.getRawValue());
  }
}
