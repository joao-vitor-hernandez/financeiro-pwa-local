import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SavingsEvolutionChartComponent } from './savings-evolution-chart.component';
import { SavingsPoint } from '../../../core/models/savings-evolution.model';

describe('SavingsEvolutionChartComponent', () => {
  let component: SavingsEvolutionChartComponent;
  let fixture: ComponentFixture<SavingsEvolutionChartComponent>;

  const mockPoints: SavingsPoint[] = [
    { date: '2026-05', label: 'Mai', checking: 2000, savings: 3000, investment: 5000, total: 10000 },
    { date: '2026-06', label: 'Jun', checking: 2500, savings: 3500, investment: 6000, total: 12000 },
    { date: '2026-07', label: 'Jul', checking: 3000, savings: 4000, investment: 8000, total: 15000 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavingsEvolutionChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SavingsEvolutionChartComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.componentRef.setInput('data', mockPoints);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should scale points properly with valid coordinates', () => {
    fixture.componentRef.setInput('data', mockPoints);
    fixture.detectChanges();

    const scaled = component.scaledPoints();
    expect(scaled.length).toBe(3);

    // X coordinates must increase strictly monotonically
    expect(scaled[0].x).toBeLessThan(scaled[1].x);
    expect(scaled[1].x).toBeLessThan(scaled[2].x);

    // Y coordinates should be within canvas bounds
    scaled.forEach((pt) => {
      expect(pt.yTotal).toBeGreaterThanOrEqual(component.paddingTop);
      expect(pt.yTotal).toBeLessThanOrEqual(component.zeroY);
    });
  });

  it('should switch view modes correctly', () => {
    fixture.componentRef.setInput('data', mockPoints);
    fixture.detectChanges();

    // Mode 'all'
    component.setViewMode('all');
    expect(component.isTotalVisible()).toBe(true);
    expect(component.isCheckingVisible()).toBe(true);
    expect(component.isSavingsVisible()).toBe(true);
    expect(component.isInvestmentVisible()).toBe(true);

    // Mode 'total'
    component.setViewMode('total');
    expect(component.isTotalVisible()).toBe(true);
    expect(component.isCheckingVisible()).toBe(false);
    expect(component.isSavingsVisible()).toBe(false);
    expect(component.isInvestmentVisible()).toBe(false);

    // Mode 'lines'
    component.setViewMode('lines');
    expect(component.isTotalVisible()).toBe(false);
    expect(component.isCheckingVisible()).toBe(true);
    expect(component.isSavingsVisible()).toBe(true);
    expect(component.isInvestmentVisible()).toBe(true);
  });

  it('should allow toggling individual line series via chips', () => {
    fixture.componentRef.setInput('data', mockPoints);
    fixture.detectChanges();

    component.toggleLine('savings');
    expect(component.toggleSavings()).toBe(false);

    component.toggleLine('savings');
    expect(component.toggleSavings()).toBe(true);
  });

  it('should compute latest values correctly for legend and summary', () => {
    fixture.componentRef.setInput('data', mockPoints);
    fixture.detectChanges();

    expect(component.latestTotal()).toBe(15000);
    expect(component.latestChecking()).toBe(3000);
    expect(component.latestSavings()).toBe(4000);
    expect(component.latestInvestment()).toBe(8000);
  });
});
