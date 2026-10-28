import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrivacyCurrencyPipe } from '../../../core/pipes/privacy-currency.pipe';
import { CategoryExpenseSegment } from '../../../core/models/card-expenses.model';

export interface CalculatedSegment extends CategoryExpenseSegment {
  numericValue: number;
  calculatedPercentage: number;
  strokeDasharray: string;
  strokeDashoffset: number;
}

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule, PrivacyCurrencyPipe],
  template: `
    <div class="donut-chart-wrapper">
      <!-- SVG Donut Chart -->
      <div
        class="chart-container"
        [style.width.px]="size()"
        [style.height.px]="size()"
        (mouseleave)="onMouseLeave()"
      >
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
          class="donut-svg"
        >
          <!-- Base background ring -->
          <circle
            [attr.cx]="size() / 2"
            [attr.cy]="size() / 2"
            [attr.r]="radius()"
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            [attr.stroke-width]="strokeWidth()"
          />

          <!-- Segments -->
          @for (segment of calculatedSegments(); track segment.label) {
            <circle
              [attr.cx]="size() / 2"
              [attr.cy]="size() / 2"
              [attr.r]="radius()"
              fill="transparent"
              [attr.stroke]="segment.color"
              [attr.stroke-width]="isHovered(segment) ? strokeWidth() + 4 : strokeWidth()"
              [attr.stroke-dasharray]="segment.strokeDasharray"
              [attr.stroke-dashoffset]="segment.strokeDashoffset"
              stroke-linecap="round"
              class="donut-segment"
              [class.active]="isHovered(segment)"
              [style.filter]="isHovered(segment) ? 'drop-shadow(0px 0px 8px ' + segment.color + ') brightness(1.15)' : 'none'"
              (mouseenter)="onSegmentHover(segment)"
            />
          }
        </svg>

        <!-- Center Content (Dinâmico ao passar o mouse ou tocar) -->
        <div
          class="center-content"
          [style.width.px]="centerSize()"
          [style.height.px]="centerSize()"
        >
          <span class="center-label truncate">
            {{ activeLabel() }}
          </span>
          <span class="center-value currency-val tabular-nums text-expense">
            {{ activeValue() | privacyCurrency }}
          </span>
          @if (hoveredSegment()) {
            <span class="center-badge">
              {{ activePercentage() }}% do total
            </span>
          } @else {
            <span class="center-subtext">Total Consolidado</span>
          }
        </div>
      </div>

      <!-- Lista Dinâmica de Sessões / Categorias com Indicador de Cor -->
      @if (showLegend() && calculatedSegments().length > 0) {
        <div class="legend-list">
          @for (segment of calculatedSegments(); track segment.label) {
            <div
              class="legend-item"
              [class.hovered]="isHovered(segment)"
              (mouseenter)="onSegmentHover(segment)"
              (mouseleave)="onMouseLeave()"
            >
              <div class="legend-left">
                <span
                  class="color-dot"
                  [style.background-color]="segment.color"
                  [style.box-shadow]="isHovered(segment) ? '0 0 8px ' + segment.color : 'none'"
                ></span>
                <span class="legend-name">{{ segment.label }}</span>
                @if (segment.count > 0) {
                  <span class="tx-badge">{{ segment.count }}x</span>
                }
              </div>

              <div class="legend-right">
                <span class="legend-pct tabular-nums">{{ segment.calculatedPercentage.toFixed(0) }}%</span>
                <span class="legend-val currency-val tabular-nums">
                  {{ segment.numericValue | privacyCurrency }}
                </span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .donut-chart-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }

    .chart-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 12px 0 16px;
    }

    .donut-svg {
      overflow: visible;
      transform: rotate(-90deg); /* Começa no topo (12 horas) */
      transform-origin: center;
    }

    .donut-segment {
      transform-origin: center;
      transition: stroke-width 0.2s ease, filter 0.2s ease, transform 0.2s ease;
      cursor: pointer;

      &:hover, &.active {
        transform: scale(1.025);
      }
    }

    .center-content {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      pointer-events: none;
      padding: 0 12px;
      z-index: 10;

      .center-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        max-width: 140px;
        margin-bottom: 2px;
      }

      .center-value {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      .center-badge {
        font-size: 11px;
        font-weight: 600;
        color: var(--color-accent);
        background: var(--color-accent-bg);
        padding: 2px 8px;
        border-radius: var(--radius-full);
        margin-top: 4px;
      }

      .center-subtext {
        font-size: 10px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-top: 4px;
      }
    }

    .text-expense {
      color: var(--color-expense) !important;
    }

    .legend-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      padding-top: 14px;
      border-top: 1px solid var(--border-subtle);
    }

    .legend-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      transition: all 0.15s ease;
      cursor: pointer;
      user-select: none;

      &:hover, &.hovered {
        background-color: var(--bg-hover);
      }

      .legend-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .color-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        shrink: 0;
        transition: box-shadow 0.2s ease;
      }

      .legend-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .tx-badge {
        font-size: 10px;
        color: var(--text-muted);
        background: var(--bg-surface-elevated);
        padding: 1px 5px;
        border-radius: var(--radius-sm);
      }

      .legend-right {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }

      .legend-pct {
        font-size: 11px;
        font-weight: 500;
        color: var(--text-muted);
      }

      .legend-val {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }
    }
  `,
})
export class DonutChartComponent {
  data = input.required<CategoryExpenseSegment[]>();
  totalValue = input<number | string | null>(null);
  size = input<number>(240);
  strokeWidth = input<number>(24);
  defaultLabel = input<string>('Fatura Cartões');
  showLegend = input<boolean>(true);

  hoveredSegment = signal<CategoryExpenseSegment | null>(null);
  segmentHovered = output<CategoryExpenseSegment | null>();

  radius = computed(() => this.size() / 2 - this.strokeWidth() / 2);
  circumference = computed(() => 2 * Math.PI * this.radius());
  centerSize = computed(() => this.size() - this.strokeWidth() * 2.6);

  effectiveTotal = computed(() => {
    const propTotal = this.totalValue();
    if (propTotal !== null && propTotal !== undefined) {
      return parseFloat(propTotal.toString()) || 0;
    }
    return this.data().reduce((acc, seg) => acc + (parseFloat(seg.value.toString()) || 0), 0);
  });

  calculatedSegments = computed<CalculatedSegment[]>(() => {
    const list = this.data();
    const total = this.effectiveTotal();
    const circ = this.circumference();

    let cumulativePercentage = 0;
    return list.map((seg) => {
      const numVal = parseFloat(seg.value.toString()) || 0;
      const percentage = total > 0 ? (numVal / total) * 100 : 0;
      const strokeDasharray = `${(percentage / 100) * circ} ${circ}`;
      const strokeDashoffset = -((cumulativePercentage / 100) * circ);

      cumulativePercentage += percentage;

      return {
        ...seg,
        numericValue: numVal,
        calculatedPercentage: percentage,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  });

  activeLabel = computed(() => {
    return this.hoveredSegment()?.label || this.defaultLabel();
  });

  activeValue = computed(() => {
    const hovered = this.hoveredSegment();
    if (hovered) {
      return hovered.value;
    }
    return this.effectiveTotal();
  });

  activePercentage = computed(() => {
    const hovered = this.hoveredSegment();
    if (!hovered) return '100';
    const total = this.effectiveTotal();
    const num = parseFloat(hovered.value.toString()) || 0;
    return total > 0 ? ((num / total) * 100).toFixed(1) : '0.0';
  });

  isHovered(segment: CategoryExpenseSegment): boolean {
    return this.hoveredSegment()?.label === segment.label;
  }

  onSegmentHover(segment: CategoryExpenseSegment): void {
    this.hoveredSegment.set(segment);
    this.segmentHovered.emit(segment);
  }

  onMouseLeave(): void {
    this.hoveredSegment.set(null);
    this.segmentHovered.emit(null);
  }
}
