import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PrivacyService {
  private readonly STORAGE_KEY = 'financial_pwa_privacy_mode';
  
  // Signal reativo para controle do Modo Privacidade
  readonly isPrivate = signal<boolean>(this.loadInitialState());

  private loadInitialState(): boolean {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  }

  toggle(): void {
    const nextState = !this.isPrivate();
    this.isPrivate.set(nextState);
    try {
      localStorage.setItem(this.STORAGE_KEY, String(nextState));
    } catch {
      // Ignora erro em ambientes restritos de storage
    }
  }
}
