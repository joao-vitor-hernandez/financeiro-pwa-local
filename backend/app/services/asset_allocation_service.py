from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.asset_allocation import AssetAllocationTarget
from app.schemas.asset_allocation import (
    AssetAllocationSummaryResponse,
    AssetAllocationTargetResponse,
    AssetAllocationTargetUpdate,
    AssetClassBreakdown,
    CDIBenchmarkSummary,
)


class AssetAllocationService:
    """
    Serviço de Alocação de Ativos e Benchmark CDI (Fase 8.4 - Inspirado no Ghostfolio).
    Calcula o rebalanceamento patrimonial e compara o rendimento dos cofrinhos contra o CDI.
    """

    DEFAULT_CHECKING_PCT = Decimal("20.00")
    DEFAULT_SAVINGS_PCT = Decimal("40.00")
    DEFAULT_INVESTMENT_PCT = Decimal("40.00")
    DEFAULT_CDI_RATE = Decimal("11.25")
    POUPANCA_ANNUAL_RATE = Decimal("6.17")  # Rendimento médio anual da caderneta de poupança
    IPCA_BENCHMARK_RATE = Decimal("4.00")  # Meta/Projeção de inflação anual de referência

    @classmethod
    async def get_or_create_targets(cls, session: AsyncSession) -> AssetAllocationTarget:
        """
        Recupera as metas configuradas ou inicializa com os valores padrão.
        """
        result = await session.scalars(
            select(AssetAllocationTarget).order_by(AssetAllocationTarget.created_at)
        )
        target = result.first()
        if not target:
            target = AssetAllocationTarget(
                checking_target_pct=cls.DEFAULT_CHECKING_PCT,
                savings_target_pct=cls.DEFAULT_SAVINGS_PCT,
                investment_target_pct=cls.DEFAULT_INVESTMENT_PCT,
                cdi_annual_rate=cls.DEFAULT_CDI_RATE,
            )
            session.add(target)
            await session.commit()
            await session.refresh(target)
        return target

    @classmethod
    async def update_targets(
        cls, session: AsyncSession, payload: AssetAllocationTargetUpdate
    ) -> AssetAllocationTargetResponse:
        """
        Atualiza as metas de alocação patrimonial e a taxa CDI.
        """
        target = await cls.get_or_create_targets(session)
        target.checking_target_pct = payload.checking_target_pct
        target.savings_target_pct = payload.savings_target_pct
        target.investment_target_pct = payload.investment_target_pct
        target.cdi_annual_rate = payload.cdi_annual_rate
        target.updated_at = datetime.now(UTC)

        await session.commit()
        await session.refresh(target)

        return AssetAllocationTargetResponse.model_validate(target)

    @classmethod
    async def get_allocation_summary(cls, session: AsyncSession) -> AssetAllocationSummaryResponse:
        """
        Gera o sumário completo de alocação de ativos, diferenças de rebalanceamento e benchmark CDI.
        """
        targets = await cls.get_or_create_targets(session)

        # Buscar contas ativas
        accounts_result = await session.scalars(select(Account).where(Account.is_active.is_(True)))
        accounts = accounts_result.all()

        checking_balance = Decimal("0.00")
        savings_balance = Decimal("0.00")
        investment_balance = Decimal("0.00")

        for acc in accounts:
            if acc.type in (AccountType.CHECKING, AccountType.CASH):
                checking_balance += acc.balance
            elif acc.type == AccountType.SAVINGS:
                savings_balance += acc.balance
            elif acc.type == AccountType.INVESTMENT:
                investment_balance += acc.balance

        # Não consideramos saldos negativos para alocação patrimonial de ativos
        checking_balance = max(Decimal("0.00"), checking_balance)
        savings_balance = max(Decimal("0.00"), savings_balance)
        investment_balance = max(Decimal("0.00"), investment_balance)

        total_patrimony = checking_balance + savings_balance + investment_balance

        # Construção dos breakdowns
        classes_data = [
            ("CHECKING", "Caixa & Liquidez Imediata", checking_balance, targets.checking_target_pct),
            ("SAVINGS", "Cofrinhos & Reserva", savings_balance, targets.savings_target_pct),
            ("INVESTMENT", "Investimentos & Longo Prazo", investment_balance, targets.investment_target_pct),
        ]

        breakdowns: list[AssetClassBreakdown] = []

        for code, label, current_val, target_pct in classes_data:
            if total_patrimony > Decimal("0.00"):
                current_pct = round((current_val / total_patrimony) * Decimal("100.00"), 2)
                target_amount = round(total_patrimony * (target_pct / Decimal("100.00")), 2)
                rebalance_diff = target_amount - current_val
            else:
                current_pct = Decimal("0.00")
                target_amount = Decimal("0.00")
                rebalance_diff = Decimal("0.00")

            pct_diff = current_pct - target_pct
            if abs(pct_diff) <= Decimal("2.00"):
                status = "BALANCED"
            elif pct_diff < Decimal("0.00"):
                status = "UNDERWEIGHT"
            else:
                status = "OVERWEIGHT"

            breakdowns.append(
                AssetClassBreakdown(
                    asset_class=code,
                    label=label,
                    current_amount=current_val,
                    current_pct=current_pct,
                    target_pct=target_pct,
                    target_amount=target_amount,
                    rebalance_diff=rebalance_diff,
                    status=status,
                )
            )

        # Benchmark CDI
        cdi_annual = targets.cdi_annual_rate
        r_annual = float(cdi_annual) / 100.0
        # Taxa mensal equivalente: (1 + r)^(1/12) - 1
        r_monthly = ((1.0 + r_annual) ** (1.0 / 12.0)) - 1.0 if r_annual >= 0 else 0.0
        # Taxa diária equivalente: (1 + r)^(1/252) - 1 (252 dias úteis)
        r_daily = ((1.0 + r_annual) ** (1.0 / 252.0)) - 1.0 if r_annual >= 0 else 0.0

        daily_rate_pct = Decimal(str(round(r_daily * 100.0, 4)))
        monthly_rate_pct = Decimal(str(round(r_monthly * 100.0, 4)))

        # Estimativas de rendimento sobre o saldo dos cofrinhos (savings)
        savings_flt = float(savings_balance)
        daily_yield = Decimal(str(round(savings_flt * r_daily, 2)))
        monthly_yield = Decimal(str(round(savings_flt * r_monthly, 2)))
        annual_yield = Decimal(str(round(savings_flt * r_annual, 2)))

        # Comparativo com a Caderneta de Poupança (6.17% a.a.)
        r_poupanca = float(cls.POUPANCA_ANNUAL_RATE) / 100.0
        poupanca_annual_yield = Decimal(str(round(savings_flt * r_poupanca, 2)))
        extra_vs_poupanca = max(Decimal("0.00"), annual_yield - poupanca_annual_yield)

        # Ganho real líquido sobre a inflação (Equação de Fisher: (1 + r_cdi)/(1 + r_ipca) - 1)
        r_ipca = float(cls.IPCA_BENCHMARK_RATE) / 100.0
        r_real = ((1.0 + r_annual) / (1.0 + r_ipca)) - 1.0 if (1.0 + r_ipca) > 0 else 0.0
        real_annual_yield_pct = Decimal(str(round(r_real * 100.0, 2)))

        cdi_summary = CDIBenchmarkSummary(
            annual_rate_pct=cdi_annual,
            monthly_rate_pct=monthly_rate_pct,
            daily_rate_pct=daily_rate_pct,
            savings_balance=savings_balance,
            daily_estimated_yield=daily_yield,
            monthly_estimated_yield=monthly_yield,
            annual_estimated_yield=annual_yield,
            poupanca_annual_yield=poupanca_annual_yield,
            extra_vs_poupanca_annual=extra_vs_poupanca,
            inflation_ipca_projected=cls.IPCA_BENCHMARK_RATE,
            real_annual_yield_pct=real_annual_yield_pct,
        )

        return AssetAllocationSummaryResponse(
            total_patrimony=total_patrimony,
            classes=breakdowns,
            targets=AssetAllocationTargetResponse.model_validate(targets),
            cdi_benchmark=cdi_summary,
        )
