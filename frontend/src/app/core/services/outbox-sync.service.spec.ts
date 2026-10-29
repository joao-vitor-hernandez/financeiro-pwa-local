import { TestBed } from '@angular/core/testing';
import { OutboxSyncService } from './outbox-sync.service';
import { OfflineDbService, OutboxItem } from './offline-db.service';
import { ApiService } from './api.service';
import { FinanceSyncService } from './finance-sync.service';
import { TransactionCreate } from '../models/transaction.model';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OutboxSyncService', () => {
  let service: OutboxSyncService;

  let mockOfflineDb: {
    addOutboxItem: ReturnType<typeof vi.fn>;
    getPendingOutboxItems: ReturnType<typeof vi.fn>;
    updateOutboxItem: ReturnType<typeof vi.fn>;
    deleteOutboxItem: ReturnType<typeof vi.fn>;
  };

  let mockApiService: {
    createTransaction: ReturnType<typeof vi.fn>;
  };

  let mockFinanceSync: {
    notifyDataChanged: ReturnType<typeof vi.fn>;
  };

  const samplePayload: TransactionCreate = {
    account_id: 'acc-1',
    description: 'Padaria da Esquina',
    amount: '18.50',
    transaction_date: '2026-10-29',
    type: 'EXPENSE',
  };

  beforeEach(() => {
    mockOfflineDb = {
      addOutboxItem: vi.fn().mockResolvedValue(1),
      getPendingOutboxItems: vi.fn().mockResolvedValue([]),
      updateOutboxItem: vi.fn().mockResolvedValue(1),
      deleteOutboxItem: vi.fn().mockResolvedValue(undefined),
    };

    mockApiService = {
      createTransaction: vi.fn().mockReturnValue(of([{ id: 'tx-created-1' }])),
    };

    mockFinanceSync = {
      notifyDataChanged: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        OutboxSyncService,
        { provide: OfflineDbService, useValue: mockOfflineDb },
        { provide: ApiService, useValue: mockApiService },
        { provide: FinanceSyncService, useValue: mockFinanceSync },
      ],
    });

    service = TestBed.inject(OutboxSyncService);
  });

  it('should be created and have initial online status', () => {
    expect(service).toBeTruthy();
    expect(service.pendingCount()).toBe(0);
  });

  it('should enqueue transaction into Dexie outbox with client_tx_id', async () => {
    const record = await service.enqueue(samplePayload, 'Nubank Conta', 'Alimentação');

    expect(mockOfflineDb.addOutboxItem).toHaveBeenCalled();
    expect(record.client_tx_id).toBeTruthy();
    expect(record.payload.client_tx_id).toBe(record.client_tx_id);
    expect(record.account_name).toBe('Nubank Conta');
    expect(record.category_name).toBe('Alimentação');
    expect(record.status).toBe('PENDING');
  });

  it('should process pending outbox items sequentially and delete from outbox upon success', async () => {
    const pendingItem: OutboxItem = {
      id: 42,
      client_tx_id: 'offline-uuid-42',
      payload: { ...samplePayload, client_tx_id: 'offline-uuid-42' },
      account_name: 'Nubank Conta',
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'PENDING',
    };

    mockOfflineDb.getPendingOutboxItems.mockResolvedValueOnce([pendingItem]);

    const result = await service.syncPending();

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockOfflineDb.updateOutboxItem).toHaveBeenCalledWith(42, { status: 'SYNCING' });
    expect(mockApiService.createTransaction).toHaveBeenCalledWith(pendingItem.payload);
    expect(mockOfflineDb.deleteOutboxItem).toHaveBeenCalledWith(42);
    expect(mockFinanceSync.notifyDataChanged).toHaveBeenCalled();
  });

  it('should halt syncing and keep item PENDING if network drops (status 0)', async () => {
    const pendingItem: OutboxItem = {
      id: 55,
      client_tx_id: 'offline-uuid-55',
      payload: { ...samplePayload, client_tx_id: 'offline-uuid-55' },
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'PENDING',
    };

    mockOfflineDb.getPendingOutboxItems.mockResolvedValueOnce([pendingItem]);
    mockApiService.createTransaction.mockReturnValueOnce(
      throwError(() => ({ status: 0, message: 'Network disconnected' }))
    );

    const result = await service.syncPending();

    expect(result.synced).toBe(0);
    expect(mockOfflineDb.updateOutboxItem).toHaveBeenCalledWith(55, { status: 'PENDING' });
    expect(service.isOnline()).toBe(false);
  });

  it('should mark item as FAILED if 400 validation error occurs without crashing the queue', async () => {
    const pendingItem: OutboxItem = {
      id: 66,
      client_tx_id: 'offline-uuid-66',
      payload: { ...samplePayload, client_tx_id: 'offline-uuid-66' },
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'PENDING',
    };

    mockOfflineDb.getPendingOutboxItems.mockResolvedValueOnce([pendingItem]);
    mockApiService.createTransaction.mockReturnValueOnce(
      throwError(() => ({ status: 400, error: { detail: 'Conta inexistente' } }))
    );

    const result = await service.syncPending();

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(mockOfflineDb.updateOutboxItem).toHaveBeenCalledWith(66, {
      status: 'FAILED',
      retry_count: 1,
      error_message: 'Conta inexistente',
    });
  });
});

