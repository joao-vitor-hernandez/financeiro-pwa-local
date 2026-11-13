from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.models.account import Account, AccountType
from app.models.asset_allocation import AssetAllocationTarget
from app.schemas.asset_allocation import (
    AssetAllocationTargetUpdate,
)
from app.services.asset_allocation_service import AssetAllocationService


def test_target_update_validation_valid():
    """
    Fase 8.4: Valida criação com soma exata de 100.00%.
    """
    target = AssetAllocationTargetUpdate(
        checking_target_pct=Decimal("20.00"),
        savings_target_pct=Decimal("40.00"),
        investment_target_pct=Decimal("40.00"),
        cdi_annual_rate=Decimal("11.25"),
    )
    assert target.checking_target_pct == Decimal("20.00")
    assert target.savings_target_pct == Decimal("40.00")
    assert target.investment_target_pct == Decimal("40.00")
    assert target.cdi_annual_rate == Decimal("11.25")


def test_target_update_validation_fractional_100():
    """
    Fase 8.4: Valida soma com centésimos exatos totalizando 100.00%.
    """
    target = AssetAllocationTargetUpdate(
        checking_target_pct=Decimal("33.33"),
        savings_target_pct=Decimal("33.33"),
        investment_target_pct=Decimal("33.34"),
        cdi_annual_rate=Decimal("12.50"),
    )
    assert (
        target.checking_target_pct + target.savings_target_pct + target.investment_target_pct
        == Decimal("100.00")
    )


def test_target_update_validation_invalid_sum_raises():
    """
    Fase 8.4: Rejeita com ValidationError se a soma for diferente de 100%.
    """
    with pytest.raises(ValidationError) as exc:
        AssetAllocationTargetUpdate(
            checking_target_pct=Decimal("20.00"),
            savings_target_pct=Decimal("40.00"),
            investment_target_pct=Decimal("30.00"),  # Soma 90%
            cdi_annual_rate=Decimal("11.25"),
        )
    assert "A soma dos percentuais alvo deve ser exatamente 100.00%" in str(exc.value)


def test_target_update_extra_fields_forbidden():
    """
    Fase 8.4: Impõe api-design-standards com extra='forbid'.
    """
    with pytest.raises(ValidationError):
        AssetAllocationTargetUpdate(
            checking_target_pct=Decimal("20.00"),
            savings_target_pct=Decimal("40.00"),
            investment_target_pct=Decimal("40.00"),
            cdi_annual_rate=Decimal("11.25"),
            extra_field="malicious",  # Proibido
        )


@pytest.mark.asyncio
async def test_asset_allocation_service_zero_patrimony():
    """
    Fase 8.4: Testa sumário de alocação quando não há saldo ou contas cadastradas.
    """
    mock_session = AsyncMock()

    # Mock get_or_create_targets
    target = AssetAllocationTarget(
        checking_target_pct=Decimal("20.00"),
        savings_target_pct=Decimal("40.00"),
        investment_target_pct=Decimal("40.00"),
        cdi_annual_rate=Decimal("11.25"),
    )
    mock_targets_result = MagicMock()
    mock_targets_result.first.return_value = target

    mock_accounts_result = MagicMock()
    mock_accounts_result.all.return_value = []

    mock_session.scalars.side_effect = [mock_targets_result, mock_accounts_result]

    summary = await AssetAllocationService.get_allocation_summary(mock_session)

    assert summary.total_patrimony == Decimal("0.00")
    assert len(summary.classes) == 3
    for c in summary.classes:
        assert c.current_amount == Decimal("0.00")
        assert c.current_pct == Decimal("0.00")
        assert c.target_amount == Decimal("0.00")
        assert c.rebalance_diff == Decimal("0.00")

    # Verifica CDI benchmark com saldo 0
    cdi = summary.cdi_benchmark
    assert cdi.annual_rate_pct == Decimal("11.25")
    assert cdi.monthly_rate_pct > Decimal("0.00")
    assert cdi.daily_rate_pct > Decimal("0.00")
    assert cdi.savings_balance == Decimal("0.00")
    assert cdi.daily_estimated_yield == Decimal("0.00")
    assert cdi.monthly_estimated_yield == Decimal("0.00")
    assert cdi.annual_estimated_yield == Decimal("0.00")
    assert cdi.real_annual_yield_pct > Decimal("0.00")


@pytest.mark.asyncio
async def test_asset_allocation_service_rebalance_and_cdi_yield():
    """
    Fase 8.4: Testa alocação real vs meta, diferenças de rebalanceamento e projeções do CDI.
    """
    mock_session = AsyncMock()

    target = AssetAllocationTarget(
        checking_target_pct=Decimal("20.00"),
        savings_target_pct=Decimal("40.00"),
        investment_target_pct=Decimal("40.00"),
        cdi_annual_rate=Decimal("11.25"),
    )
    mock_targets_result = MagicMock()
    mock_targets_result.first.return_value = target

    # Contas:
    # Checking: 1.000,00 (10% de 10.000)
    # Savings: 5.000,00 (50% de 10.000)
    # Investment: 4.000,00 (40% de 10.000)
    acc_checking = Account(
        name="Conta Corrente",
        type=AccountType.CHECKING,
        balance=Decimal("1000.00"),
        is_active=True,
    )
    acc_savings = Account(
        name="Cofrinho Reserva",
        type=AccountType.SAVINGS,
        balance=Decimal("5000.00"),
        is_active=True,
    )
    acc_investment = Account(
        name="Investimentos",
        type=AccountType.INVESTMENT,
        balance=Decimal("4000.00"),
        is_active=True,
    )

    mock_accounts_result = MagicMock()
    mock_accounts_result.all.return_value = [acc_checking, acc_savings, acc_investment]

    mock_session.scalars.side_effect = [mock_targets_result, mock_accounts_result]

    summary = await AssetAllocationService.get_allocation_summary(mock_session)

    assert summary.total_patrimony == Decimal("10000.00")

    classes_by_code = {c.asset_class: c for c in summary.classes}

    # Checking: meta é 20% (R$ 2.000,00), atual é 10% (R$ 1.000,00) -> Aporte de +R$ 1.000,00
    chk = classes_by_code["CHECKING"]
    assert chk.current_amount == Decimal("1000.00")
    assert chk.current_pct == Decimal("10.00")
    assert chk.target_amount == Decimal("2000.00")
    assert chk.rebalance_diff == Decimal("1000.00")
    assert chk.status == "UNDERWEIGHT"

    # Savings: meta é 40% (R$ 4.000,00), atual é 50% (R$ 5.000,00) -> Excesso de -R$ 1.000,00
    svg = classes_by_code["SAVINGS"]
    assert svg.current_amount == Decimal("5000.00")
    assert svg.current_pct == Decimal("50.00")
    assert svg.target_amount == Decimal("4000.00")
    assert svg.rebalance_diff == Decimal("-1000.00")
    assert svg.status == "OVERWEIGHT"

    # Investment: meta é 40% (R$ 4.000,00), atual é 40% (R$ 4.000,00) -> Balanceado
    inv = classes_by_code["INVESTMENT"]
    assert inv.current_amount == Decimal("4000.00")
    assert inv.current_pct == Decimal("40.00")
    assert inv.target_amount == Decimal("4000.00")
    assert inv.rebalance_diff == Decimal("0.00")
    assert inv.status == "BALANCED"

    # CDI Benchmark para R$ 5.000,00 em cofrinho
    cdi = summary.cdi_benchmark
    assert cdi.savings_balance == Decimal("5000.00")
    assert cdi.annual_rate_pct == Decimal("11.25")
    # Rendimento anual projetado a 11.25%: 5000 * 0.1125 = 562.50
    assert cdi.annual_estimated_yield == Decimal("562.50")
    # Poupança anual a 6.17%: 5000 * 0.0617 = 308.50
    assert cdi.poupanca_annual_yield == Decimal("308.50")
    # Ganho extra vs poupança: 562.50 - 308.50 = 254.00
    assert cdi.extra_vs_poupanca_annual == Decimal("254.00")
    assert cdi.daily_estimated_yield > Decimal("0.00")
    assert cdi.monthly_estimated_yield > Decimal("0.00")
    # Rendimento real acima do IPCA (4.00%): Fisher ((1.1125 / 1.04) - 1) * 100 = 6.97%
    assert cdi.real_annual_yield_pct == Decimal("6.97")


@pytest.mark.asyncio
async def test_update_targets_service():
    """
    Fase 8.4: Testa atualização de targets via serviço.
    """
    mock_session = AsyncMock()

    target = AssetAllocationTarget(
        checking_target_pct=Decimal("20.00"),
        savings_target_pct=Decimal("40.00"),
        investment_target_pct=Decimal("40.00"),
        cdi_annual_rate=Decimal("11.25"),
    )
    mock_targets_result = MagicMock()
    mock_targets_result.first.return_value = target
    mock_session.scalars.return_value = mock_targets_result

    payload = AssetAllocationTargetUpdate(
        checking_target_pct=Decimal("25.00"),
        savings_target_pct=Decimal("35.00"),
        investment_target_pct=Decimal("40.00"),
        cdi_annual_rate=Decimal("12.00"),
    )

    res = await AssetAllocationService.update_targets(mock_session, payload)

    assert res.checking_target_pct == Decimal("25.00")
    assert res.savings_target_pct == Decimal("35.00")
    assert res.investment_target_pct == Decimal("40.00")
    assert res.cdi_annual_rate == Decimal("12.00")
    assert mock_session.commit.called
