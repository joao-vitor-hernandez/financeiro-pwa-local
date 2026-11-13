from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AssetAllocationTargetUpdate(BaseModel):
    """
    Schema para atualização das metas de alocação patrimonial e taxa do CDI.
    Segue a skill api-design-standards com extra='forbid' e validação estrita.
    """

    model_config = ConfigDict(extra="forbid")

    checking_target_pct: Decimal = Field(
        ...,
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Percentual alvo para Conta Corrente e Dinheiro Líquido",
    )
    savings_target_pct: Decimal = Field(
        ...,
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Percentual alvo para Cofrinhos e Reserva de Emergência",
    )
    investment_target_pct: Decimal = Field(
        ...,
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Percentual alvo para Contas de Investimento",
    )
    cdi_annual_rate: Decimal = Field(
        default=Decimal("11.25"),
        ge=Decimal("0.00"),
        le=Decimal("100.00"),
        description="Taxa anual do CDI (%) para benchmark",
    )

    @model_validator(mode="after")
    def validate_sum_is_100(self) -> "AssetAllocationTargetUpdate":
        total_pct = self.checking_target_pct + self.savings_target_pct + self.investment_target_pct
        if round(total_pct, 2) != Decimal("100.00"):
            raise ValueError(
                f"A soma dos percentuais alvo deve ser exatamente 100.00%. Soma recebida: {total_pct}%"
            )
        return self


class AssetAllocationTargetResponse(BaseModel):
    """
    Schema de resposta para as metas salvas.
    """

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    checking_target_pct: Decimal
    savings_target_pct: Decimal
    investment_target_pct: Decimal
    cdi_annual_rate: Decimal
    updated_at: datetime | None = None


class AssetClassBreakdown(BaseModel):
    """
    Detalhamento de cada classe de ativo com valores reais, metas e rebalanceamento.
    """

    model_config = ConfigDict(extra="forbid")

    asset_class: str  # CHECKING, SAVINGS, INVESTMENT
    label: str
    current_amount: Decimal
    current_pct: Decimal
    target_pct: Decimal
    target_amount: Decimal
    rebalance_diff: Decimal  # Valor a aportar (+) ou desalocar (-)
    status: str  # BALANCED, UNDERWEIGHT, OVERWEIGHT


class CDIBenchmarkSummary(BaseModel):
    """
    Métricas e projeções de rentabilidade baseadas no CDI e comparativo com Poupança.
    """

    model_config = ConfigDict(extra="forbid")

    annual_rate_pct: Decimal
    monthly_rate_pct: Decimal
    daily_rate_pct: Decimal
    savings_balance: Decimal
    daily_estimated_yield: Decimal
    monthly_estimated_yield: Decimal
    annual_estimated_yield: Decimal
    poupanca_annual_yield: Decimal
    extra_vs_poupanca_annual: Decimal
    inflation_ipca_projected: Decimal
    real_annual_yield_pct: Decimal


class AssetAllocationSummaryResponse(BaseModel):
    """
    Resposta completa consolidando distribuição real, metas, rebalanceamento e benchmark CDI.
    """

    model_config = ConfigDict(extra="forbid")

    total_patrimony: Decimal
    classes: list[AssetClassBreakdown]
    targets: AssetAllocationTargetResponse
    cdi_benchmark: CDIBenchmarkSummary
