import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { MatButton } from '@angular/material/button';
import { Entry } from '@core/models/entry';
import { TagChipsComponent } from '@shared/components/tag-chips/tag-chips';
import { LoadingComponent } from '@shared/components/loading/loading';

@Component({
  selector: 'app-entry-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormField, MatLabel, MatError,
    MatInput,
    MatSelect, MatOption,
    MatButton,
    TagChipsComponent,
    LoadingComponent,
  ],
  templateUrl: './entry-editor.html',
  styleUrl: './entry-editor.scss',
})
export class EntryEditorComponent implements OnChanges {
  @Input() entry: Entry | null = null;
  @Input() saving = false;
  @Output() save = new EventEmitter<Partial<Entry>>();

  readonly moodOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  form = new FormGroup({
    title: new FormControl<string>(''),
    body: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    mood: new FormControl<number | null>(null),
    tags: new FormControl<string[]>([], { nonNullable: true }),
  });

  ngOnChanges(changes: SimpleChanges): void {
    const prev = changes['entry']?.previousValue as Entry | null;
    if (this.entry && prev?.id !== this.entry.id) {
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

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;
    this.save.emit(this.form.getRawValue());
  }
}
