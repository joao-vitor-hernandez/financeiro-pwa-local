import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryBudgetsWidgetComponent } from './category-budgets-widget.component';
import { BudgetSummaryResponse } from '../../../core/models/budget.model';
import { Category } from '../../../core/models/category.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CategoryBudgetsWidgetComponent', () => {
  let component: CategoryBudgetsWidgetComponent;
  let fixture: ComponentFixture<CategoryBudgetsWidgetComponent>;

  const mockCategories: Category[] = [
    {
      id: 'cat-1',
      name: 'Supermercado',
      type: 'EXPENSE',
      icon: 'shopping-cart',
      color: '#21D0B2',
      is_active: true,
      subcategories: [],
    },
    {
      id: 'cat-2',
      name: 'Restaurantes',
      type: 'EXPENSE',
      icon: 'coffee',
      color: '#eab308',
      is_active: true,
      subcategories: [],
    },
    {
      id: 'cat-3',
      name: 'Salário',
      type: 'INCOME',
      icon: 'wallet',
      color: '#1DCDFE',
      is_active: true,
      subcategories: [],
    },
  ];

  const mockSummary: BudgetSummaryResponse = {
    month: 10,
    year: 2026,
    total_budgeted: '1500.00',
    total_spent: '1200.00',
    total_remaining: '300.00',
    overall_percentage: '80.0',
    warning_count: 1,
    exceeded_count: 0,
    budgets: [
      {
        id: 'b-1',
        category_id: 'cat-1',
        category_name: 'Supermercado',
        category_icon: 'shopping-cart',
        category_color: '#21D0B2',
        month: 10,
        year: 2026,
        limit_amount: '1000.00',
        spent_amount: '750.00',
        remaining_amount: '250.00',
        percentage: '75.0',
        status: 'SAFE',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'b-2',
        category_id: 'cat-2',
        category_name: 'Restaurantes',
        category_icon: 'coffee',
        category_color: '#eab308',
        month: 10,
        year: 2026,
        limit_amount: '500.00',
        spent_amount: '450.00',
        remaining_amount: '50.00',
        percentage: '90.0',
        status: 'WARNING',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryBudgetsWidgetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryBudgetsWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should format period correctly', () => {
    fixture.componentRef.setInput('summary', mockSummary);
    fixture.detectChanges();
    expect(component.formattedPeriod()).toBe('10/2026');
  });

  it('should identify overall semaphoric status based on percentage', () => {
    fixture.componentRef.setInput('summary', mockSummary);
    fixture.detectChanges();
    expect(component.summaryOverallStatus()).toBe('WARNING');
    expect(component.summaryProgressBarWidth()).toBe(80);
  });

  it('should filter available expense categories excluding already budgeted ones', () => {
    fixture.componentRef.setInput('categories', mockCategories);
    fixture.componentRef.setInput('summary', mockSummary);
    fixture.detectChanges();

    // cat-1 and cat-2 are already budgeted. cat-3 is INCOME.
    // So available should be empty
    expect(component.availableExpenseCategories().length).toBe(0);
  });

  it('should emit onSaveBudget when submitting valid budget modal', () => {
    fixture.componentRef.setInput('summary', mockSummary);
    fixture.detectChanges();

    const saveSpy = vi.fn();
    component.onSaveBudget.subscribe(saveSpy);

    component.openCreateModal();
    component.modalCategoryId = 'cat-new';
    component.modalLimitAmount = 600.0;
    component.submitBudgetModal();

    expect(saveSpy).toHaveBeenCalledWith({
      category_id: 'cat-new',
      limit_amount: '600.00',
      month: 10,
      year: 2026,
    });
    expect(component.isModalOpen()).toBe(false);
  });

  it('should calculate exceeded absolute difference correctly', () => {
    expect(component.calcExceededAbs('-75.50')).toBe('75.50');
    expect(component.calcBarWidth('120.0')).toBe(100);
    expect(component.calcBarWidth('45.5')).toBe(45.5);
  });
});
