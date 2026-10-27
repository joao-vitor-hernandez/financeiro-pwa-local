import { inject, Pipe, PipeTransform } from '@angular/core';
import { PrivacyService } from '../services/privacy.service';

@Pipe({
  name: 'privacyCurrency',
  standalone: true,
  pure: false, // Reavalia automaticamente quando o signal do PrivacyService é alterado
})
export class PrivacyCurrencyPipe implements PipeTransform {
  private privacy = inject(PrivacyService);

  transform(value: string | number | null | undefined, showSymbol: boolean = true): string {
    if (this.privacy.isPrivate()) {
      return showSymbol ? 'R$ •••••' : '•••••';
    }

    if (value === null || value === undefined || value === '') {
      return showSymbol ? 'R$ 0,00' : '0,00';
    }

    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) {
      return showSymbol ? 'R$ 0,00' : '0,00';
    }

    const formatted = new Intl.NumberFormat('pt-BR', {
      style: showSymbol ? 'currency' : 'decimal',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);

    return formatted;
  }
}
