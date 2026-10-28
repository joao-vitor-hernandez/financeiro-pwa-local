'use client';

import * as React from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

// Configuração de cores e rótulos ClariFin Theme
const chartConfig = {
  total: {
    label: 'Total Consolidado',
    color: '#34F5C5',
  },
  checking: {
    label: 'Conta Parado',
    color: '#38bdf8',
  },
  savings: {
    label: 'Cofrinhos',
    color: '#21D0B2',
  },
  investment: {
    label: 'Investido',
    color: '#1DCDFE',
  },
} satisfies ChartConfig;

// Dados de evolução do patrimônio guardado (Exemplo ClariFin)
const savingsEvolutionData = [
  { month: 'Mai', checking: 2100.0, savings: 3500.0, investment: 4000.0, total: 9600.0 },
  { month: 'Jun', checking: 1850.0, savings: 4200.0, investment: 4800.0, total: 10850.0 },
  { month: 'Jul', checking: 2400.0, savings: 5100.0, investment: 5500.0, total: 13000.0 },
  { month: 'Ago', checking: 1950.0, savings: 5900.0, investment: 6300.0, total: 14150.0 },
  { month: 'Set', checking: 2300.0, savings: 6700.0, investment: 7100.0, total: 16100.0 },
  { month: 'Out', checking: 2750.0, savings: 7650.0, investment: 8100.0, total: 18500.0 },
];

export function SavingsEvolutionChartDemo() {
  const [viewMode, setViewMode] = React.useState<'all' | 'total' | 'lines'>('all');

  return (
    <Card className="w-full bg-zinc-950 text-zinc-100 border-zinc-800 shadow-xl rounded-2xl p-6">
      <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold tracking-tight">Evolução do Dinheiro Guardado</CardTitle>
          <CardDescription className="text-xs text-zinc-400 mt-1">
            Dinheiro em conta, cofrinhos (Mercado Pago) e investimentos
          </CardDescription>
        </div>

        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'all' ? 'bg-zinc-800 text-teal-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tudo
          </button>
          <button
            onClick={() => setViewMode('total')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'total' ? 'bg-zinc-800 text-teal-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Total
          </button>
          <button
            onClick={() => setViewMode('lines')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'lines' ? 'bg-zinc-800 text-teal-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Linhas
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart data={savingsEvolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              stroke="rgba(255, 255, 255, 0.4)"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              stroke="rgba(255, 255, 255, 0.4)"
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />

            {/* Linhas / Áreas condicionais */}
            {(viewMode === 'all' || viewMode === 'total') && (
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--color-total)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#fillTotal)"
              />
            )}
            {(viewMode === 'all' || viewMode === 'lines') && (
              <>
                <Line
                  type="monotone"
                  dataKey="checking"
                  stroke="var(--color-checking)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="savings"
                  stroke="var(--color-savings)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="investment"
                  stroke="var(--color-investment)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </>
            )}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export default SavingsEvolutionChartDemo;
