import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import {
  PushNotificationState,
  PushPermissionStatus,
  PushTestResponse,
} from '../models/push-notification.model';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

@Injectable({
  providedIn: 'root',
})
export class WebPushService {
  private api = inject(ApiService);

  readonly state = signal<PushNotificationState>({
    supported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: false,
    error: null,
  });

  constructor() {
    this.init();
  }

  async init(): Promise<void> {
    const isSupported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    if (!isSupported) {
      this.state.update((s) => ({
        ...s,
        supported: false,
        permission: 'unsupported',
      }));
      return;
    }

    const permission = Notification.permission as PushPermissionStatus;
    let isSubscribed = false;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        isSubscribed = !!subscription;
      }
    } catch (err) {
      console.warn('Erro ao verificar inscrição push existente:', err);
    }

    this.state.set({
      supported: true,
      permission,
      isSubscribed,
      isLoading: false,
      error: null,
    });
  }

  async subscribe(): Promise<boolean> {
    if (!this.state().supported) {
      this.state.update((s) => ({
        ...s,
        error: 'Notificações push não são suportadas neste navegador.',
      }));
      return false;
    }

    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // 1. Solicita permissão se ainda não concedida
      let currentPermission = Notification.permission;
      if (currentPermission !== 'granted') {
        currentPermission = await Notification.requestPermission();
      }

      if (currentPermission !== 'granted') {
        this.state.update((s) => ({
          ...s,
          permission: currentPermission as PushPermissionStatus,
          isLoading: false,
          error: 'Permissão para notificações foi negada pelo usuário.',
        }));
        return false;
      }

      // 2. Busca chave pública VAPID do backend
      const { public_key } = await firstValueFrom(this.api.getVapidPublicKey());
      if (!public_key) {
        throw new Error('Chave pública VAPID não retornada pelo servidor.');
      }

      // 3. Obtém o Service Worker e inscreve no PushManager
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(public_key);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.['p256dh'] || '';
      const auth = subJson.keys?.['auth'] || '';

      if (!p256dh || !auth) {
        throw new Error('Falha ao extrair chaves de criptografia da inscrição Web Push.');
      }

      // 4. Registra no backend PostgreSQL
      await firstValueFrom(
        this.api.subscribePush({
          endpoint: subscription.endpoint,
          keys: { p256dh, auth },
          user_agent: navigator.userAgent,
        })
      );

      this.state.update((s) => ({
        ...s,
        permission: 'granted',
        isSubscribed: true,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Falha desconhecida ao ativar notificações Web Push.';
      console.error('Erro na ativação de Web Push:', err);
      this.state.update((s) => ({
        ...s,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Desativa no backend
          try {
            await firstValueFrom(this.api.unsubscribePush(subscription.endpoint));
          } catch (apiErr) {
            console.warn('Aviso ao desinscrever no backend:', apiErr);
          }
          // Remove inscrição no navegador
          await subscription.unsubscribe();
        }
      }

      this.state.update((s) => ({
        ...s,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Falha ao desativar notificações.';
      this.state.update((s) => ({
        ...s,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }

  async sendTestPush(): Promise<PushTestResponse> {
    return firstValueFrom(this.api.sendTestPush());
  }

  async triggerDueCheck(): Promise<any> {
    return firstValueFrom(this.api.triggerDueBillsCheck());
  }
}
