import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthStatusResponse {
  is_setup: boolean;
  email: string;
}

const TOKEN_KEY = 'fin_access_token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  isAuthenticated = signal<boolean>(false);
  isSetup = signal<boolean>(true);
  isLoading = signal<boolean>(true);
  userEmail = signal<string>('jvhernandez.dev@gmail.com');

  constructor() {
    this.checkInitialStatus();
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }

  private clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  checkInitialStatus(): void {
    this.isLoading.set(true);
    const token = this.getToken();

    this.http.get<AuthStatusResponse>(`${this.apiUrl}/status`).pipe(
      catchError(() => of({ is_setup: true, email: 'jvhernandez.dev@gmail.com' }))
    ).subscribe((status) => {
      this.isSetup.set(status.is_setup);
      this.userEmail.set(status.email);

      if (!status.is_setup) {
        // Precisa configurar o primeiro PIN
        this.isAuthenticated.set(false);
        this.isLoading.set(false);
        return;
      }

      if (!token) {
        this.isAuthenticated.set(false);
        this.isLoading.set(false);
        return;
      }

      // Valida o token existente chamando /auth/me
      this.http.get(`${this.apiUrl}/me`).subscribe({
        next: () => {
          this.isAuthenticated.set(true);
          this.isLoading.set(false);
        },
        error: () => {
          this.clearToken();
          this.isAuthenticated.set(false);
          this.isLoading.set(false);
        },
      });
    });
  }

  setupPin(pin: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/setup`, { pin }).pipe(
      tap((res) => {
        this.setToken(res.access_token);
        this.isSetup.set(true);
        this.isAuthenticated.set(true);
      })
    );
  }

  loginWithPin(pin: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/login`, { pin }).pipe(
      tap((res) => {
        this.setToken(res.access_token);
        this.isAuthenticated.set(true);
      })
    );
  }

  logout(): void {
    this.clearToken();
    this.isAuthenticated.set(false);
  }
}
