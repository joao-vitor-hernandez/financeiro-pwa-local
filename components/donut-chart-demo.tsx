// components/donut-chart-demo.tsx
"use client";

import React, { useState } from "react";
import { DonutChart, DonutChartSegment } from "@/components/ui/donut-chart";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Gastos de Cartão de Crédito agrupados por Categorias / Sessões (ClariFin Theme)
const creditCardExpenses: DonutChartSegment[] = [
  { value: 1240.50, color: "#1DCDFE", label: "Alimentação & Mercado" },
  { value: 680.00, color: "#21D0B2", label: "Assinaturas & SaaS" },
  { value: 430.20, color: "#34F5C5", label: "Transporte & Mobilidade" },
  { value: 310.00, color: "#fbbf24", label: "Lazer & Restaurantes" },
  { value: 189.90, color: "#f43f5e", label: "Saúde & Farmácia" },
  { value: 95.00, color: "#a1a1aa", label: "Outros Lançamentos" },
];

const totalCardExpenses = creditCardExpenses.reduce((sum, d) => sum + d.value, 0);

export default function CardExpensesDonutDemo() {
  const [hoveredSegment, setHoveredSegment] = useState<DonutChartSegment | null>(null);

  // Segmento ativo no hover ou valor total consolidado
  const displayValue = hoveredSegment ? hoveredSegment.value : totalCardExpenses;
  const displayLabel = hoveredSegment ? hoveredSegment.label : "Fatura Cartões";
  const displayPercentage = hoveredSegment
    ? (hoveredSegment.value / totalCardExpenses) * 100
    : 100;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  return (
    <Card className="p-6 md:p-8 w-full max-w-md mx-auto flex flex-col items-center justify-center space-y-6 bg-zinc-950 text-zinc-100 border-zinc-800 shadow-2xl rounded-2xl">
      <CardHeader className="p-0 text-center space-y-1">
        <CardTitle className="text-xl font-bold tracking-tight text-zinc-100">
          Gastos por Categoria (Cartões)
        </CardTitle>
        <CardDescription className="text-xs text-zinc-400">
          Passe o mouse ou toque nos setores para inspecionar cada área de gasto
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 flex flex-col items-center w-full space-y-6">
        <div className="relative flex items-center justify-center">
          <DonutChart
            data={creditCardExpenses}
            size={260}
            strokeWidth={28}
            animationDuration={1.2}
            animationDelayPerSegment={0.06}
            highlightOnHover={true}
            onSegmentHover={setHoveredSegment}
            centerContent={
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayLabel}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex flex-col items-center justify-center text-center px-4"
                >
                  <p className="text-zinc-400 text-xs font-medium truncate max-w-[150px]">
                    {displayLabel}
                  </p>
                  <p className="text-2xl font-extrabold text-zinc-100 tracking-tight">
                    {formatCurrency(displayValue)}
                  </p>
                  {hoveredSegment ? (
                    <p className="text-sm font-semibold text-emerald-400">
                      {displayPercentage.toFixed(1)}% do total
                    </p>
                  ) : (
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Total consolidado
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            }
          />
        </div>

        {/* Lista Dinâmica de Sessões / Categorias com Indicador de Cor */}
        <div className="flex flex-col space-y-2 w-full pt-4 border-t border-zinc-800">
          {creditCardExpenses.map((segment, index) => {
            const isHovered = hoveredSegment?.label === segment.label;
            const pct = (segment.value / totalCardExpenses) * 100;

            return (
              <motion.div
                key={segment.label}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.08, duration: 0.35 }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 cursor-pointer",
                  isHovered ? "bg-zinc-900 border border-zinc-700" : "hover:bg-zinc-900/50"
                )}
                onMouseEnter={() => setHoveredSegment(segment)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-sm font-medium text-zinc-200">
                    {segment.label}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-zinc-500 font-mono">
                    {pct.toFixed(0)}%
                  </span>
                  <span className="text-sm font-semibold text-zinc-300 font-mono">
                    {formatCurrency(segment.value)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

