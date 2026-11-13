import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashFlowForecastWidgetComponent } from './cash-flow-forecast-widget.component';
import { CashFlowForecastResponse } from '../../../core/models/forecast.model';

describe('CashFlowForecastWidgetComponent', () => {
  let component: CashFlowForecastWidgetComponent;
  let fixture: ComponentFixture<CashFlowForecastWidgetComponent>;

  const mockForecast: CashFlowForecastResponse = {
    start_date: '2026-11-13',
    end_date: '2026-12-13',
    initial_balance: '2500.00',
    thirty_days_balance: '3100.00',
    end_of_month_balance: '2200.00',
    lowest_projected_balance: '1800.00',
    has_deficit_risk: false,
    deficit_date: null,
    points: [
      {
        date: '2026-11-13',
        label: '13/Nov',
        day_number: 13,
        projected_balance: '2500.00',
        inflow: '0.00',
        outflow: '0.00',
        is_negative: false,
      },
      {
        date: '2026-11-14',
        label: '14/Nov',
        day_number: 14,
        projected_balance: '2465.00',
        inflow: '0.00',
        outflow: '35.00',
        is_negative: false,
      },
    ],
    safe_to_spend: {
      daily_amount: '65.00',
      days_remaining: 18,
      disposable_month_amount: '1170.00',
      upcoming_bills_amount: '1330.00',
      current_checking_balance: '2500.00',
      status: 'HEALTHY',
      message: 'Ritmo diário seguro sem comprometer faturas ou saldo de fechamento.',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashFlowForecastWidgetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CashFlowForecastWidgetComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.componentRef.setInput('forecast', mockForecast);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should compute statusClass and statusLabel correctly for HEALTHY', () => {
    fixture.componentRef.setInput('forecast', mockForecast);
    fixture.detectChanges();

    expect(component.statusClass()).toBe('status-healthy');
    expect(component.statusLabel()).toBe('Livre para Gastar');
    expect(component.isThirtyDaysNegative()).toBe(false);
  });

  it('should switch to simulation mode when simulateData is called', () => {
    component.simulateData();
    expect(component.isSimulating()).toBe(true);
    expect(component.activeForecast()?.points.length).toBe(31);

    component.resetSimulation();
    expect(component.isSimulating()).toBe(false);
  });

  it('should detect deficit risk when status is CRITICAL and balance is negative', () => {
    const deficitMock: CashFlowForecastResponse = {
      ...mockForecast,
      has_deficit_risk: true,
      deficit_date: '2026-11-20',
      thirty_days_balance: '-350.00',
      safe_to_spend: {
        ...mockForecast.safe_to_spend,
        daily_amount: '0.00',
        status: 'CRITICAL',
      },
    };

    fixture.componentRef.setInput('forecast', deficitMock);
    fixture.detectChanges();

    expect(component.statusClass()).toBe('status-critical');
    expect(component.isThirtyDaysNegative()).toBe(true);
    expect(component.activeForecast()?.has_deficit_risk).toBe(true);
  });
});
