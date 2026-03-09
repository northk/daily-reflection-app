import { Component, Input, Output, EventEmitter } from '@angular/core';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import {
  MatChipGrid,
  MatChipRow,
  MatChipInput,
  MatChipRemove,
  MatChipInputEvent,
} from '@angular/material/chips';
import { MatFormField, MatLabel, MatHint } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-tag-chips',
  standalone: true,
  imports: [MatFormField, MatLabel, MatHint, MatChipGrid, MatChipRow, MatChipInput, MatChipRemove, MatIcon],
  templateUrl: './tag-chips.html',
  styleUrl: './tag-chips.scss',
})
export class TagChipsComponent {
  @Input() tags: string[] = [];
  @Output() tagsChange = new EventEmitter<string[]>();

  readonly separatorKeyCodes = [ENTER, COMMA] as const;

  addTag(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim().toLowerCase();
    if (value && !this.tags.includes(value)) {
      this.tagsChange.emit([...this.tags, value]);
    }
    event.chipInput?.clear();
  }

  removeTag(tag: string): void {
    this.tagsChange.emit(this.tags.filter(t => t !== tag));
  }
}
