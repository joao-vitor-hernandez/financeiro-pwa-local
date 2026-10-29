import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RulesComponent } from './rules.component';
import { ApiService } from '../../core/services/api.service';
import { CategorizationRule, RuleSimulationResponse } from '../../core/models/rule.model';
import { Category } from '../../core/models/category.model';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('RulesComponent', () => {
  let component: RulesComponent;
  let fixture: ComponentFixture<RulesComponent>;

  const mockCategories: Category[] = [
    {
      id: 'cat-transporte',
      name: 'Transporte',
      type: 'EXPENSE',
      icon: 'truck',
      color: '#1DCDFE',
      is_active: true,
      subcategories: [],
    },
    {
      id: 'cat-refeicao',
      name: 'Alimentação',
      type: 'EXPENSE',
      icon: 'coffee',
      color: '#21D0B2',
      is_active: true,
      subcategories: [],
    },
  ];

  const mockRules: CategorizationRule[] = [
    {
      id: 'rule-1',
      name: 'Uber Corridas',
      pattern: 'uber',
      clean_description: 'Uber Viagens',
      category_id: 'cat-transporte',
      priority: 10,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      category_name: 'Transporte',
      category_color: '#1DCDFE',
      category_icon: 'truck',
    },
    {
      id: 'rule-2',
      name: 'iFood Refeições',
      pattern: 'ifood',
      clean_description: 'iFood Delivery',
      category_id: 'cat-refeicao',
      priority: 20,
      is_active: false,
      created_at: '2026-01-02T00:00:00Z',
      category_name: 'Alimentação',
      category_color: '#21D0B2',
      category_icon: 'coffee',
    },
  ];

  const mockSimResult: RuleSimulationResponse = {
    raw_text: 'PAG*Uber*BR Trip',
    sanitized_text: 'Uber*BR Trip',
    is_match: true,
    matched_rule_id: 'rule-1',
    matched_rule_name: 'Uber Corridas',
    matched_rule_priority: 10,
    category_id: 'cat-transporte',
    category_name: 'Transporte',
    category_color: '#1DCDFE',
    category_icon: 'truck',
    final_description: 'Uber Viagens',
  };

  let mockApiService: {
    getCategories: ReturnType<typeof vi.fn>;
    getRules: ReturnType<typeof vi.fn>;
    simulateRule: ReturnType<typeof vi.fn>;
    createRule: ReturnType<typeof vi.fn>;
    updateRule: ReturnType<typeof vi.fn>;
    deleteRule: ReturnType<typeof vi.fn>;
    reorderRules: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockApiService = {
      getCategories: vi.fn().mockReturnValue(of(mockCategories)),
      getRules: vi.fn().mockReturnValue(of(mockRules)),
      simulateRule: vi.fn().mockReturnValue(of(mockSimResult)),
      createRule: vi.fn().mockImplementation((data) => of({ id: 'rule-new', ...data })),
      updateRule: vi.fn().mockImplementation((id, data) => of({ id, ...data })),
      deleteRule: vi.fn().mockReturnValue(of(undefined)),
      reorderRules: vi.fn().mockImplementation(({ rule_ids }) => of(mockRules)),
    };

    await TestBed.configureTestingModule({
      imports: [RulesComponent],
      providers: [{ provide: ApiService, useValue: mockApiService }],
    }).compileComponents();

    fixture = TestBed.createComponent(RulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and load rules and simulation on init', () => {
    expect(component).toBeTruthy();
    expect(mockApiService.getCategories).toHaveBeenCalled();
    expect(mockApiService.getRules).toHaveBeenCalled();
    expect(component.rules().length).toBe(2);
    expect(component.simResult()).toEqual(mockSimResult);
  });

  it('should run simulation when applyPreset is triggered', () => {
    component.applyPreset('NETFLIX.COM SAO PAULO');
    expect(component.simRawText).toBe('NETFLIX.COM SAO PAULO');
    expect(mockApiService.simulateRule).toHaveBeenCalledWith({
      raw_text: 'NETFLIX.COM SAO PAULO',
    });
  });

  it('should reorder rules when moveRule is called', () => {
    // Move rule at index 0 down (delta = 1)
    component.moveRule(0, 1);
    expect(mockApiService.reorderRules).toHaveBeenCalledWith({
      rule_ids: ['rule-2', 'rule-1'],
    });
  });

  it('should toggle rule active state', () => {
    component.toggleRuleActive(mockRules[0]);
    expect(mockApiService.updateRule).toHaveBeenCalledWith('rule-1', {
      is_active: false,
    });
  });

  it('should open create modal with defaulted form fields', () => {
    component.openCreateModal();
    expect(component.isModalOpen()).toBe(true);
    expect(component.editingRule()).toBeNull();
    expect(component.formCategoryId).toBe('cat-transporte');
    expect(component.formPriority).toBe(30); // highest + 10
  });

  it('should open edit modal populated with rule data', () => {
    component.openEditModal(mockRules[0]);
    expect(component.isModalOpen()).toBe(true);
    expect(component.editingRule()?.id).toBe('rule-1');
    expect(component.formName).toBe('Uber Corridas');
    expect(component.formPattern).toBe('uber');
  });

  it('should validate in-modal regex pattern syntax and live test', () => {
    component.formPattern = '[invalid(';
    component.validateInModalRegex();
    expect(component.modalRegexError()).toBe('Sintaxe de Regex inválida');

    component.formPattern = 'uber|99';
    component.modalTestText = 'Viagem de 99Pop';
    component.validateInModalRegex();
    expect(component.modalRegexError()).toBe('');
    expect(component.modalTestResult()).toBe(true);
  });

  it('should submit new rule when modal is valid', () => {
    component.openCreateModal();
    component.formName = 'Nova Regra Mercado';
    component.formPattern = 'carrefour|paodeacucar';
    component.formCategoryId = 'cat-refeicao';
    component.formCleanDescription = 'Supermercado';

    component.submitRuleModal();

    expect(mockApiService.createRule).toHaveBeenCalledWith({
      name: 'Nova Regra Mercado',
      pattern: 'carrefour|paodeacucar',
      category_id: 'cat-refeicao',
      clean_description: 'Supermercado',
      priority: 30,
      is_active: true,
    });
    expect(component.isModalOpen()).toBe(false);
  });

  it('should delete rule after user confirms', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.requestDeleteRule('rule-1');
    expect(mockApiService.deleteRule).toHaveBeenCalledWith('rule-1');
  });
});

