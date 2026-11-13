import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AttachmentModalComponent } from './attachment-modal.component';
import { ApiService } from '../../../core/services/api.service';
import { Transaction } from '../../../core/models/transaction.model';
import { TransactionAttachment } from '../../../core/models/attachment.model';

describe('AttachmentModalComponent', () => {
  let component: AttachmentModalComponent;
  let fixture: ComponentFixture<AttachmentModalComponent>;
  let mockApiService: any;

  const mockTx: Transaction = {
    id: 'tx-123',
    account_id: 'acc-1',
    description: 'Supermercado Mensal',
    amount: '450.00',
    transaction_date: '2026-11-13T10:00:00Z',
    type: 'EXPENSE',
    is_transfer: false,
    created_at: '2026-11-13T10:00:00Z',
  };

  const mockAttachment: TransactionAttachment = {
    id: 'att-1',
    transaction_id: 'tx-123',
    file_name: 'nota_fiscal.jpg',
    file_size_bytes: 204800,
    mime_type: 'image/jpeg',
    view_url: '/api/v1/attachments/att-1/file',
    created_at: '2026-11-13T10:05:00Z',
  };

  beforeEach(async () => {
    mockApiService = {
      getTransactionAttachments: vi.fn().mockReturnValue(
        of({ attachments: [mockAttachment], total_count: 1 })
      ),
      uploadAttachment: vi.fn().mockReturnValue(of(mockAttachment)),
      deleteAttachment: vi.fn().mockReturnValue(of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [AttachmentModalComponent],
      providers: [{ provide: ApiService, useValue: mockApiService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AttachmentModalComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.componentRef.setInput('transaction', null);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load attachments when opened with a transaction', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('transaction', mockTx);
    fixture.detectChanges();

    expect(mockApiService.getTransactionAttachments).toHaveBeenCalledWith('tx-123');
    expect(component.attachments().length).toBe(1);
    expect(component.attachments()[0].file_name).toBe('nota_fiscal.jpg');
  });

  it('should correctly format file sizes', () => {
    expect(component.formatSize(500)).toBe('500 B');
    expect(component.formatSize(204800)).toBe('200.0 KB');
    expect(component.formatSize(5242880)).toBe('5.0 MB');
  });

  it('should open and close preview dialog', () => {
    component.openPreview(mockAttachment);
    expect(component.previewAttachment()).toEqual(mockAttachment);

    component.closePreview();
    expect(component.previewAttachment()).toBeNull();
  });

  it('should identify image mime types correctly', () => {
    expect(component.isImage('image/jpeg')).toBe(true);
    expect(component.isImage('image/png')).toBe(true);
    expect(component.isImage('application/pdf')).toBe(false);
  });
});
