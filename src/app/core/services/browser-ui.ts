import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, Renderer2, RendererFactory2, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BrowserUiService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly rendererFactory = inject(RendererFactory2);
  private readonly renderer: Renderer2 = this.rendererFactory.createRenderer(null, null);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  getOrigin(): string {
    if (!this.isBrowser) return '';
    return this.document.location?.origin ?? '';
  }

  getLocalStorageItem(key: string): string | null {
    if (!this.isBrowser) return null;
    return this.document.defaultView?.localStorage.getItem(key) ?? null;
  }

  setLocalStorageItem(key: string, value: string): void {
    if (!this.isBrowser) return;
    this.document.defaultView?.localStorage.setItem(key, value);
  }

  scrollToElement(element: HTMLElement, offset = 0): void {
    if (!this.isBrowser) return;
    const win = this.document.defaultView;
    if (!win) return;
    const top = element.getBoundingClientRect().top + win.pageYOffset - offset;
    win.scrollTo(0, Math.max(0, top));
  }

  downloadBlob(blob: Blob, filename: string): void {
    if (!this.isBrowser || !this.document.body) return;
    const urlApi = this.document.defaultView?.URL;
    if (!urlApi) return;

    const objectUrl = urlApi.createObjectURL(blob);
    const a = this.renderer.createElement('a') as HTMLAnchorElement;
    this.renderer.setStyle(a, 'display', 'none');
    this.renderer.setAttribute(a, 'href', objectUrl);
    this.renderer.setAttribute(a, 'download', filename);
    this.renderer.appendChild(this.document.body, a);
    a.click();
    this.renderer.removeChild(this.document.body, a);
    urlApi.revokeObjectURL(objectUrl);
  }
}
