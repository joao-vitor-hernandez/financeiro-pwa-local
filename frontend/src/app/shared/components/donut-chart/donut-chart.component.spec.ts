import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DonutChartComponent } from './donut-chart.component';
import { CategoryExpenseSegment } from '../../../core/models/card-expenses.model';

describe('DonutChartComponent', () => {
  let component: DonutChartComponent;
  let fixture: ComponentFixture<DonutChartComponent>;

  const mockSegments: CategoryExpenseSegment[] = [
    { label: 'Alimentação', value: '500.00', color: '#1DCDFE', percentage: 50.0, count: 5 },
    { label: 'Transporte', value: '300.00', color: '#21D0B2', percentage: 30.0, count: 3 },
    { label: 'Lazer', value: '200.00', color: '#34F5C5', percentage: 20.0, count: 2 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DonutChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DonutChartComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.componentRef.setInput('data', mockSegments);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should correctly sum items when totalValue is not provided or is "0.00"', () => {
    fixture.componentRef.setInput('data', mockSegments);
    fixture.componentRef.setInput('totalValue', '0.00');
    fixture.detectChanges();

    // 500 + 300 + 200 = 1000
    expect(component.effectiveTotal()).toBe(1000);
  });

  it('should use explicit positive totalValue when provided', () => {
    fixture.componentRef.setInput('data', mockSegments);
    fixture.componentRef.setInput('totalValue', 2000);
    fixture.detectChanges();

    expect(component.effectiveTotal()).toBe(2000);
  });

  it('should calculate proportional segments with distinct strokeDasharray and negative offset', () => {
    fixture.componentRef.setInput('data', mockSegments);
    fixture.componentRef.setInput('gap', 3);
    fixture.detectChanges();

    const segments = component.calculatedSegments();
    expect(segments.length).toBe(3);

    // Segment 1 (50%)
    expect(segments[0].calculatedPercentage).toBe(50);
    expect(segments[0].strokeDashoffset).toBe(0);

    // Segment 2 (30%)
    expect(segments[1].calculatedPercentage).toBe(30);
    expect(segments[1].strokeDashoffset).toBeLessThan(0);

    // Segment 3 (20%)
    expect(segments[2].calculatedPercentage).toBe(20);
    expect(segments[2].strokeDashoffset).toBeLessThan(segments[1].strokeDashoffset);
  });

  it('should update activeLabel and activeValue on hover', () => {
    fixture.componentRef.setInput('data', mockSegments);
    fixture.detectChanges();

    expect(component.activeLabel()).toBe('Fatura Cartões');
    expect(component.activeValue()).toBe(1000);

    component.onSegmentHover(mockSegments[0]);
    fixture.detectChanges();

    expect(component.activeLabel()).toBe('Alimentação');
    expect(component.activeValue()).toBe('500.00');
    expect(component.activePercentage()).toBe('50.0');

    component.onMouseLeave();
    fixture.detectChanges();

    expect(component.activeLabel()).toBe('Fatura Cartões');
    expect(component.activeValue()).toBe(1000);
  });
});
