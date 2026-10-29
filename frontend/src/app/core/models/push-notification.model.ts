export interface VapidPublicKeyResponse {
  public_key: string;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionCreate {
  endpoint: string;
  keys: PushSubscriptionKeys;
  user_agent?: string;
}

export interface PushSubscriptionResponse {
  id: string;
  endpoint: string;
  user_agent?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PushTestRequest {
  title?: string;
  body?: string;
}

export interface PushTestResponse {
  success: boolean;
  details: {
    total: number;
    sent: number;
    failed: number;
  };
}

export type PushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface PushNotificationState {
  supported: boolean;
  permission: PushPermissionStatus;
  isSubscribed: boolean;
  isLoading: boolean;
  error?: string | null;
}
