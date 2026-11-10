import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OfxImportModalComponent } from './ofx-import-modal.component';
import { ApiService } from '../../../core/services/api.service';
import { OFXImportResponse, OFXPreviewResponse } from '../../../core/models/transaction.model';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OfxImportModalComponent', () => {
  let component: OfxImportModalComponent;
  let fixture: ComponentFixture<OfxImportModalComponent>;

  const mockApiService = {
    previewOFXImport: vi.fn(),
    importOFX: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [OfxImportModalComponent],
      providers: [{ provide: ApiService, useValue: mockApiService }],
    }).compileComponents();

    fixture = TestBed.createComponent(OfxImportModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve inicializar fechado e na etapa de upload', () => {
    expect(component.step()).toBe('UPLOAD');
    expect(component.selectedFile()).toBeNull();
    expect(component.isDragging()).toBe(false);
  });

  it('deve rejeitar arquivos com extensões não permitidas', () => {
    const invalidFile = new File(['dummy'], 'documento.pdf', { type: 'application/pdf' });
    component.handleFile(invalidFile);

    expect(component.selectedFile()).toBeNull();
    expect(component.errorMessage()).toContain('Selecione um arquivo de extrato válido');
  });

  it('deve aceitar arquivos .ofx e .csv válidos', () => {
    const ofxFile = new File(['dummy ofx content'], 'extrato_nubank.ofx', {
      type: 'application/x-ofx',
    });
    component.handleFile(ofxFile);

    expect(component.selectedFile()).toBe(ofxFile);
    expect(component.errorMessage()).toBeNull();
  });

  it('deve avançar para a etapa de preview após analisar o arquivo com sucesso', () => {
    const ofxFile = new File(['dummy'], 'extrato.ofx', { type: 'application/x-ofx' });
    component.selectedFile.set(ofxFile);
    component.selectedAccountId.set('acc-123');

    const mockPreview: OFXPreviewResponse = {
      total_found: 3,
      new_count: 2,
      duplicated_count: 1,
      transactions: [
        {
          fitid: 'TX-1',
          description: 'Padaria',
          amount: '15.50',
          transaction_date: '2026-11-06T12:00:00Z',
          type: 'EXPENSE',
          is_duplicate: false,
        },
        {
          fitid: 'TX-2',
          description: 'Salário',
          amount: '4000.00',
          transaction_date: '2026-11-06T10:00:00Z',
          type: 'INCOME',
          is_duplicate: false,
        },
        {
          fitid: 'TX-DUP',
          description: 'Gasolina',
          amount: '100.00',
          transaction_date: '2026-11-05T15:00:00Z',
          type: 'EXPENSE',
          is_duplicate: true,
        },
      ],
    };

    mockApiService.previewOFXImport.mockReturnValue(of(mockPreview));

    component.analyzeFile();

    expect(mockApiService.previewOFXImport).toHaveBeenCalledWith(ofxFile, 'acc-123');
    expect(component.step()).toBe('PREVIEW');
    expect(component.previewData()).toEqual(mockPreview);
  });

  it('deve executar a importação definitiva e avançar para a etapa de sucesso', () => {
    const ofxFile = new File(['dummy'], 'extrato.ofx', { type: 'application/x-ofx' });
    component.selectedFile.set(ofxFile);
    component.selectedAccountId.set('acc-123');

    const mockImportRes: OFXImportResponse = {
      import_batch_id: 'batch-999',
      total_found: 2,
      imported_count: 2,
      duplicated_count: 0,
      transactions: [],
    };

    mockApiService.importOFX.mockReturnValue(of(mockImportRes));

    component.confirmImport();

    expect(mockApiService.importOFX).toHaveBeenCalledWith(ofxFile, 'acc-123');
    expect(component.step()).toBe('SUCCESS');
    expect(component.importResult()).toEqual(mockImportRes);
  });

  it('deve redefinir o estado ao fechar o modal', () => {
    component.step.set('SUCCESS');
    component.selectedFile.set(new File([], 'test.ofx'));
    component.errorMessage.set('Erro');

    component.onClose();

    expect(component.step()).toBe('UPLOAD');
    expect(component.selectedFile()).toBeNull();
    expect(component.errorMessage()).toBeNull();
  });
});
