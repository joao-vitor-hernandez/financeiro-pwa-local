import { TestBed } from '@angular/core/testing';
import { WebPushService, urlBase64ToUint8Array } from './web-push.service';
import { ApiService } from './api.service';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('WebPushService', () => {
  let service: WebPushService;

  let mockApiService: {
    getVapidPublicKey: ReturnType<typeof vi.fn>;
    subscribePush: ReturnType<typeof vi.fn>;
    unsubscribePush: ReturnType<typeof vi.fn>;
    sendTestPush: ReturnType<typeof vi.fn>;
    triggerDueBillsCheck: ReturnType<typeof vi.fn>;
  };

  const sampleVapidKey = 'BOEKyXax1uxbQU6nAzsi5Bw4grKDBKh7vqSimWdkdRdrxWbcqQLGs6OzOpivWwA_WvgUV_LXxaxeKjhi_ZgOxZs';

  beforeEach(() => {
    mockApiService = {
      getVapidPublicKey: vi.fn().mockReturnValue(of({ public_key: sampleVapidKey })),
      subscribePush: vi.fn().mockReturnValue(of({ id: 'sub-1', endpoint: 'https://push.test/endpoint', is_active: true })),
      unsubscribePush: vi.fn().mockReturnValue(of({ success: true, message: 'OK' })),
      sendTestPush: vi.fn().mockReturnValue(of({ success: true, details: { total: 1, sent: 1, failed: 0 } })),
      triggerDueBillsCheck: vi.fn().mockReturnValue(of({ success: true, alerts_dispatched_count: 2, alerts: [] })),
    };

    TestBed.configureTestingModule({
      providers: [
        WebPushService,
        { provide: ApiService, useValue: mockApiService },
      ],
    });

    service = TestBed.inject(WebPushService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve converter chave VAPID Base64URL em Uint8Array corretamente', () => {
    const uint8 = urlBase64ToUint8Array(sampleVapidKey);
    expect(uint8).toBeInstanceOf(Uint8Array);
    expect(uint8.length).toBeGreaterThan(0);
  });

  it('deve identificar se o ambiente suporta Web Push no init', () => {
    expect(service.state()).toBeDefined();
    expect(typeof service.state().supported).toBe('boolean');
    expect(typeof service.state().isSubscribed).toBe('boolean');
  });

  it('deve retornar false caso Web Push não seja suportado ao tentar se inscrever', async () => {
    service.state.set({
      supported: false,
      permission: 'unsupported',
      isSubscribed: false,
      isLoading: false,
      error: null,
    });

    const success = await service.subscribe();
    expect(success).toBe(false);
    expect(service.state().error).toContain('não são suportadas');
  });

  it('deve orquestrar a inscrição completa no PushManager e registro no backend', async () => {
    service.state.set({
      supported: true,
      permission: 'default',
      isSubscribed: false,
      isLoading: false,
      error: null,
    });

    // Mock Notification API
    globalThis.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as typeof Notification;

    // Mock PushManager & ServiceWorkerRegistration
    const mockSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      toJSON: () => ({
        keys: {
          p256dh: 'p256dh-mock-key',
          auth: 'auth-mock-key',
        },
      }),
    };

    const mockPushManager = {
      subscribe: vi.fn().mockResolvedValue(mockSubscription),
      getSubscription: vi.fn().mockResolvedValue(null),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({ pushManager: mockPushManager }),
        getRegistration: vi.fn().mockResolvedValue({ pushManager: mockPushManager }),
      },
      configurable: true,
      writable: true,
    });

    const result = await service.subscribe();
    expect(result).toBe(true);
    expect(mockApiService.getVapidPublicKey).toHaveBeenCalled();
    expect(mockPushManager.subscribe).toHaveBeenCalled();
    expect(mockApiService.subscribePush).toHaveBeenCalledWith({
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      keys: { p256dh: 'p256dh-mock-key', auth: 'auth-mock-key' },
      user_agent: navigator.userAgent,
    });
    expect(service.state().isSubscribed).toBe(true);
  });

  it('deve desinscrever no backend e no PushManager com sucesso', async () => {
    const mockSub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      unsubscribe: vi.fn().mockResolvedValue(true),
    };

    const mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(mockSub),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue({ pushManager: mockPushManager }),
      },
      configurable: true,
      writable: true,
    });

    service.state.set({
      supported: true,
      permission: 'granted',
      isSubscribed: true,
      isLoading: false,
      error: null,
    });

    const result = await service.unsubscribe();
    expect(result).toBe(true);
    expect(mockApiService.unsubscribePush).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/test-endpoint');
    expect(mockSub.unsubscribe).toHaveBeenCalled();
    expect(service.state().isSubscribed).toBe(false);
  });

  it('deve disparar push de teste chamando ApiService', async () => {
    const res = await service.sendTestPush();
    expect(mockApiService.sendTestPush).toHaveBeenCalled();
    expect(res.success).toBe(true);
  });

  it('deve acionar checagem de faturas D-0 e D-1 chamando ApiService', async () => {
    const res = await service.triggerDueCheck();
    expect(mockApiService.triggerDueBillsCheck).toHaveBeenCalled();
    expect(res.alerts_dispatched_count).toBe(2);
  });
});
