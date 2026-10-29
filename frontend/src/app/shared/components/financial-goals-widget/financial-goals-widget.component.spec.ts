import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinancialGoalsWidgetComponent } from './financial-goals-widget.component';
import { FinancialGoalSummaryResponse, FinancialGoal } from '../../../core/models/goal.model';
import { Account } from '../../../core/models/account.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('FinancialGoalsWidgetComponent', () => {
  let component: FinancialGoalsWidgetComponent;
  let fixture: ComponentFixture<FinancialGoalsWidgetComponent>;

  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Reserva Nubank',
      type: 'SAVINGS',
      currency: 'BRL',
      balance: '5000.00',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-2',
      name: 'Tesouro Selic',
      type: 'INVESTMENT',
      currency: 'BRL',
      balance: '12000.00',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-3',
      name: 'Conta Corrente Itaú',
      type: 'CHECKING',
      currency: 'BRL',
      balance: '2300.00',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  const mockGoal1: FinancialGoal = {
    id: 'goal-1',
    name: 'Reserva de Emergência',
    description: '6 meses de custo fixo',
    target_amount: '30000.00',
    current_amount: '15000.00',
    deadline_date: '2027-12-31',
    account_id: 'acc-1',
    account_name: 'Reserva Nubank',
    auto_sync_account: true,
    color: '#21D0B2',
    icon: 'shield',
    status: 'IN_PROGRESS',
    percentage: '50.0',
    remaining_amount: '15000.00',
    days_remaining: 428,
    monthly_pace_needed: '1000.00',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    contributions: [],
  };

  const mockGoal2: FinancialGoal = {
    id: 'goal-2',
    name: 'Novo Computador M3',
    description: 'Workstation principal',
    target_amount: '12000.00',
    current_amount: '12000.00',
    deadline_date: '2026-11-30',
    account_id: null,
    account_name: null,
    auto_sync_account: false,
    color: '#1DCDFE',
    icon: 'laptop',
    status: 'COMPLETED',
    percentage: '100.0',
    remaining_amount: '0.00',
    days_remaining: 32,
    monthly_pace_needed: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-10-29T00:00:00Z',
    contributions: [],
  };

  const mockSummary: FinancialGoalSummaryResponse = {
    total_target: '42000.00',
    total_current: '27000.00',
    overall_percentage: '64.3',
    goals_completed_count: 1,
    goals_in_progress_count: 1,
    goals: [mockGoal1, mockGoal2],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialGoalsWidgetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FinancialGoalsWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should filter only SAVINGS and INVESTMENT accounts for cofrinhos linking', () => {
    fixture.componentRef.setInput('accounts', mockAccounts);
    fixture.detectChanges();

    const filtered = component.savingsAccounts();
    expect(filtered.length).toBe(2);
    expect(filtered.some((a) => a.id === 'acc-1')).toBe(true);
    expect(filtered.some((a) => a.id === 'acc-2')).toBe(true);
    expect(filtered.some((a) => a.id === 'acc-3')).toBe(false);
  });

  it('should calculate progress bar width capped between 0 and 100', () => {
    expect(component.calcProgressBarWidth('64.3')).toBe(64.3);
    expect(component.calcProgressBarWidth('125.0')).toBe(100);
    expect(component.calcProgressBarWidth('-10.0')).toBe(0);
    expect(component.calcProgressBarWidth('')).toBe(0);
  });

  it('should validate form and show error message if name or target amount is missing', () => {
    component.openCreateModal();
    component.formName = '';
    component.formTargetAmount = null;
    component.submitGoalModal();

    expect(component.formErrorMessage()).toBe('Informe o nome da meta.');

    component.formName = 'Viagem de Férias';
    component.formTargetAmount = -50;
    component.submitGoalModal();

    expect(component.formErrorMessage()).toBe('Informe um valor alvo positivo.');
  });

  it('should emit onCreateGoal when submitting a new valid goal', () => {
    const createSpy = vi.fn();
    component.onCreateGoal.subscribe(createSpy);

    component.openCreateModal();
    component.formName = 'Curso de Especialização';
    component.formDescription = 'Certificação Cloud';
    component.formTargetAmount = 2500;
    component.formInitialAmount = 500;
    component.formDeadlineDate = '2027-06-30';
    component.formAccountId = 'acc-1';
    component.formAutoSync = true;
    component.formColor = '#34F5C5';
    component.formIcon = 'book';

    component.submitGoalModal();

    expect(createSpy).toHaveBeenCalledWith({
      name: 'Curso de Especialização',
      description: 'Certificação Cloud',
      target_amount: '2500.00',
      initial_amount: '500.00',
      deadline_date: '2027-06-30',
      account_id: 'acc-1',
      auto_sync_account: true,
      color: '#34F5C5',
      icon: 'book',
    });
    expect(component.isGoalModalOpen()).toBe(false);
  });

  it('should emit onUpdateGoal when editing an existing goal', () => {
    const updateSpy = vi.fn();
    component.onUpdateGoal.subscribe(updateSpy);

    component.openEditModal(mockGoal1);
    component.formName = 'Reserva de Emergência Atualizada';
    component.formTargetAmount = 35000;
    component.submitGoalModal();

    expect(updateSpy).toHaveBeenCalledWith({
      id: 'goal-1',
      data: {
        name: 'Reserva de Emergência Atualizada',
        description: '6 meses de custo fixo',
        target_amount: '35000.00',
        deadline_date: '2027-12-31',
        account_id: 'acc-1',
        auto_sync_account: true,
        color: '#21D0B2',
        icon: 'shield',
      },
    });
  });

  it('should emit onContribute with positive amount for DEPOSIT and negative for WITHDRAW', () => {
    const contributeSpy = vi.fn();
    component.onContribute.subscribe(contributeSpy);

    // Test deposit
    component.openContributeModal(mockGoal1);
    component.contributionType = 'DEPOSIT';
    component.contributionAmount = 500;
    component.contributionNotes = 'Aporte décimo terceiro';
    component.submitContribution();

    expect(contributeSpy).toHaveBeenCalledWith({
      id: 'goal-1',
      data: {
        amount: '500.00',
        notes: 'Aporte décimo terceiro',
      },
    });

    // Test withdraw
    component.openContributeModal(mockGoal1);
    component.contributionType = 'WITHDRAW';
    component.contributionAmount = 200;
    component.contributionNotes = 'Resgate imprevisto';
    component.submitContribution();

    expect(contributeSpy).toHaveBeenCalledWith({
      id: 'goal-1',
      data: {
        amount: '-200.00',
        notes: 'Resgate imprevisto',
      },
    });
  });

  it('should emit onDeleteGoal after confirmation', () => {
    const deleteSpy = vi.fn();
    component.onDeleteGoal.subscribe(deleteSpy);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.requestDelete('goal-1');
    expect(deleteSpy).toHaveBeenCalledWith('goal-1');
  });
});
