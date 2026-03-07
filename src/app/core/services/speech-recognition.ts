import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
  readonly supported: boolean =
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  private readonly _listening = signal(false);
  readonly listening = this._listening.asReadonly();

  private recognition: any = null;

  start(onSegment: (text: string) => void): void {
    if (!this.supported) return;
    const Impl =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    this.recognition = new Impl();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.onstart = () => this._listening.set(true);
    this.recognition.onend = () => this._listening.set(false);
    this.recognition.onerror = () => this._listening.set(false);
    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          onSegment(event.results[i][0].transcript);
        }
      }
    };
    this.recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
  }
}
