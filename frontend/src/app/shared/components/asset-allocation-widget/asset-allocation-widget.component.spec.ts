import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssetAllocationWidgetComponent } from './asset-allocation-widget.component';
import { AssetAllocationSummary } from '../../../core/models/asset-allocation.model';

describe('AssetAllocationWidgetComponent', () => {
  let component: AssetAllocationWidgetComponent;
  let fixture: ComponentFixture<AssetAllocationWidgetComponent>;

  const mockAllocation: AssetAllocationSummary = {
    total_patrimony: 10000,
    classes: [
      {
        asset_class: 'CHECKING',
        label: 'Caixa & Liquidez Imediata',
        current_amount: 1000,
        current_pct: 10,
        target_pct: 20,
        target_amount: 2000,
        rebalance_diff: 1000,
        status: 'UNDERWEIGHT',
      },
      {
        asset_class: 'SAVINGS',
        label: 'Cofrinhos & Reserva',
        current_amount: 5000,
        current_pct: 50,
        target_pct: 40,
        target_amount: 4000,
        rebalance_diff: -1000,
        status: 'OVERWEIGHT',
      },
      {
        asset_class: 'INVESTMENT',
        label: 'Investimentos & Longo Prazo',
        current_amount: 4000,
        current_pct: 40,
        target_pct: 40,
        target_amount: 4000,
        rebalance_diff: 0,
        status: 'BALANCED',
      },
    ],
    targets: {
      checking_target_pct: 20,
      savings_target_pct: 40,
      investment_target_pct: 40,
      cdi_annual_rate: 11.25,
      updated_at: '2026-11-13T17:00:00Z',
    },
    cdi_benchmark: {
      annual_rate_pct: 11.25,
      monthly_rate_pct: 0.8903,
      daily_rate_pct: 0.0423,
      savings_balance: 5000,
      daily_estimated_yield: 2.12,
      monthly_estimated_yield: 44.52,
      annual_estimated_yield: 562.5,
      poupanca_annual_yield: 308.5,
      extra_vs_poupanca_annual: 254.0,
      inflation_ipca_projected: 4.0,
      real_annual_yield_pct: 6.97,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetAllocationWidgetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetAllocationWidgetComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.componentRef.setInput('allocation', mockAllocation);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should compute totalPatrimony and targets correctly', () => {
    fixture.componentRef.setInput('allocation', mockAllocation);
    fixture.detectChanges();

    expect(component.totalPatrimony()).toBe(10000);
    expect(component.checkingTarget()).toBe(20);
    expect(component.savingsTarget()).toBe(40);
    expect(component.investmentTarget()).toBe(40);
  });

  it('should identify specific asset classes correctly', () => {
    fixture.componentRef.setInput('allocation', mockAllocation);
    fixture.detectChanges();

    expect(component.checkingClass()?.status).toBe('UNDERWEIGHT');
    expect(component.savingsClass()?.status).toBe('OVERWEIGHT');
    expect(component.investmentClass()?.status).toBe('BALANCED');
  });

  it('should validate totalEditSum correctly', () => {
    fixture.componentRef.setInput('allocation', mockAllocation);
    fixture.detectChanges();

    component.editCheckingPct.set(20);
    component.editSavingsPct.set(40);
    component.editInvestmentPct.set(40);

    expect(component.totalEditSum()).toBe(100);
    expect(component.isSumValid()).toBe(true);

    component.editInvestmentPct.set(30); // Soma = 90%
    expect(component.totalEditSum()).toBe(90);
    expect(component.isSumValid()).toBe(false);
  });

  it('should emit onUpdateTargets when saving valid targets', () => {
    fixture.componentRef.setInput('allocation', mockAllocation);
    fixture.detectChanges();

    let emittedPayload: any = null;
    component.onUpdateTargets.subscribe((payload) => {
      emittedPayload = payload;
    });

    component.editCheckingPct.set(25);
    component.editSavingsPct.set(35);
    component.editInvestmentPct.set(40);
    component.editCdiRate.set(12.0);

    component.saveTargets();

    expect(emittedPayload).toEqual({
      checking_target_pct: 25,
      savings_target_pct: 35,
      investment_target_pct: 40,
      cdi_annual_rate: 12.0,
    });
    expect(component.isModalOpen()).toBe(false);
  });

  it('should open and close the edit modal', () => {
    fixture.componentRef.setInput('allocation', mockAllocation);
    fixture.detectChanges();

    expect(component.isModalOpen()).toBe(false);
    component.openEditModal();
    expect(component.isModalOpen()).toBe(true);
    expect(component.editCheckingPct()).toBe(20);

    component.closeEditModal();
    expect(component.isModalOpen()).toBe(false);
  });
});
