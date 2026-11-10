from __future__ import annotations

import csv
import hashlib
import io
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_EVEN, Decimal

from fastapi import HTTPException, status
from ofxparse import OfxParser
from ofxparse.ofxparse import OfxParserException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.transaction import Transaction, TransactionType
from app.schemas.transaction import (
    OFXImportResponse,
    OFXPreviewResponse,
    OFXTransactionPreview,
    TransactionResponse,
)


@dataclass(frozen=True)
class ParsedStatementTransaction:
    fitid: str
    description: str
    amount: Decimal
    transaction_date: datetime
    type: TransactionType


class OFXImportService:
    """
    Serviço de importação e conciliação de extratos bancários locais (OFX / CSV)
    com deduplicação atômica e precisão contábil Decimal NUMERIC(15, 2).
    """

    @staticmethod
    def _normalize_text_encoding(content_bytes: bytes) -> str:
        """
        Decodifica o conteúdo em bytes testando os encodings mais comuns
        em arquivos bancários brasileiros (UTF-8, Windows-1252, ISO-8859-1).
        """
        for enc in ("utf-8-sig", "utf-8", "cp1252", "iso-8859-1"):
            try:
                return content_bytes.decode(enc)
            except UnicodeDecodeError:
                continue
        return content_bytes.decode("utf-8", errors="replace")

    @classmethod
    def _prepare_ofx_stream(cls, content_bytes: bytes) -> io.BytesIO:
        """
        Normaliza os cabeçalhos de encoding do OFX para UTF-8 garantindo
        que caracteres acentuados não causem exceções no parser SGML/XML.
        """
        text = cls._normalize_text_encoding(content_bytes)

        if "OFXHEADER:" in text:
            text = re.sub(r"ENCODING:[^\r\n]+", "ENCODING:UTF-8", text, flags=re.IGNORECASE)
            text = re.sub(r"CHARSET:[^\r\n]+", "CHARSET:UTF-8", text, flags=re.IGNORECASE)
        else:
            header = (
                "OFXHEADER:100\n"
                "DATA:OFXSGML\n"
                "VERSION:102\n"
                "SECURITY:NONE\n"
                "ENCODING:UTF-8\n"
                "CHARSET:UTF-8\n"
                "COMPRESSION:NONE\n"
                "OLDFILEUID:NONE\n"
                "NEWFILEUID:NONE\n\n"
            )
            text = header + text

        return io.BytesIO(text.encode("utf-8"))

    @classmethod
    def parse_ofx(cls, content_bytes: bytes) -> list[ParsedStatementTransaction]:
        """
        Realiza o parsing de arquivos OFX bancários (contas correntes e cartões de crédito).
        """
        try:
            stream = cls._prepare_ofx_stream(content_bytes)
            ofx = OfxParser.parse(stream)
        except (OfxParserException, Exception) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Arquivo OFX inválido ou malformado: {exc}",
            ) from exc

        parsed_items: list[ParsedStatementTransaction] = []

        accounts = getattr(ofx, "accounts", [])
        if not accounts and hasattr(ofx, "account") and ofx.account:
            accounts = [ofx.account]

        for acc in accounts:
            statement = getattr(acc, "statement", None)
            if not statement or not getattr(statement, "transactions", None):
                continue

            for tx in statement.transactions:
                raw_amt = Decimal(str(tx.amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
                if raw_amt < Decimal("0.00"):
                    tx_type = TransactionType.EXPENSE
                    final_amount = abs(raw_amt)
                elif raw_amt > Decimal("0.00"):
                    tx_type = TransactionType.INCOME
                    final_amount = raw_amt
                else:
                    is_debit = str(getattr(tx, "type", "")).lower() == "debit"
                    tx_type = TransactionType.EXPENSE if is_debit else TransactionType.INCOME
                    final_amount = Decimal("0.00")

                memo = (getattr(tx, "memo", "") or getattr(tx, "payee", "") or "Lançamento OFX").strip()
                # Normaliza espaços excessivos
                description = " ".join(memo.split())

                # Garantir data com timezone UTC
                dt = getattr(tx, "date", datetime.now(UTC))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=UTC)
                else:
                    dt = dt.astimezone(UTC)

                # Identificador FITID
                fitid = getattr(tx, "id", None)
                if not fitid or not str(fitid).strip():
                    fitid = hashlib.sha256(
                        f"{dt.isoformat()}_{final_amount}_{description}".encode()
                    ).hexdigest()[:32]
                else:
                    fitid = str(fitid).strip()

                parsed_items.append(
                    ParsedStatementTransaction(
                        fitid=fitid,
                        description=description,
                        amount=final_amount,
                        transaction_date=dt,
                        type=tx_type,
                    )
                )

        return parsed_items

    @classmethod
    def parse_csv(cls, content_bytes: bytes) -> list[ParsedStatementTransaction]:
        """
        Realiza o parsing de arquivos CSV de extrato com detecção flexível de colunas.
        """
        text = cls._normalize_text_encoding(content_bytes)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return []

        # Detectar delimitador (; ou , ou \t)
        first_line = lines[0]
        delimiter = ";" if ";" in first_line else ("," if "," in first_line else "\t")

        reader = csv.DictReader(lines, delimiter=delimiter)
        if not reader.fieldnames:
            return []

        # Mapeamento heurístico de colunas
        field_map: dict[str, str] = {}
        for fn in reader.fieldnames:
            lower = fn.lower().strip()
            if any(k in lower for k in ("data", "date", "dt")):
                field_map["date"] = fn
            elif any(k in lower for k in ("descri", "memo", "hist", "detalhe", "estabelecimento")):
                field_map["desc"] = fn
            elif any(k in lower for k in ("valor", "amount", "quantia")):
                field_map["amount"] = fn
            elif any(k in lower for k in ("tipo", "type")):
                field_map["type"] = fn
            elif any(k in lower for k in ("fitid", "identificador", "documento", "id")):
                field_map["id"] = fn

        if "date" not in field_map or "amount" not in field_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato CSV não reconhecido. O arquivo deve conter colunas de Data e Valor.",
            )

        parsed_items: list[ParsedStatementTransaction] = []

        for idx, row in enumerate(reader):
            date_raw = row.get(field_map["date"], "").strip()
            amount_raw = row.get(field_map["amount"], "").strip()
            desc_raw = (row.get(field_map.get("desc", ""), "") or "Lançamento CSV").strip()
            id_raw = row.get(field_map.get("id", ""), "").strip() if "id" in field_map else ""

            if not date_raw or not amount_raw:
                continue

            # Parsing da data (DD/MM/YYYY ou YYYY-MM-DD)
            parsed_dt: datetime | None = None
            for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
                try:
                    parsed_dt = datetime.strptime(date_raw, fmt).replace(tzinfo=UTC)
                    break
                except ValueError:
                    continue
            if not parsed_dt:
                continue

            # Parsing do valor monetário (suporta formato pt-BR R$ 1.234,56 ou en-US 1234.56)
            cleaned_amt = (
                amount_raw.replace("R$", "").replace(" ", "").replace(".", "").replace(",", ".")
                if "," in amount_raw
                else amount_raw.replace("R$", "").replace(" ", "")
            )
            try:
                dec_val = Decimal(cleaned_amt).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_EVEN
                )
            except Exception:
                continue

            if dec_val < Decimal("0.00"):
                tx_type = TransactionType.EXPENSE
                final_amt = abs(dec_val)
            else:
                tx_type = TransactionType.INCOME
                final_amt = dec_val

            if not id_raw:
                id_raw = hashlib.sha256(
                    f"{parsed_dt.isoformat()}_{final_amt}_{desc_raw}_{idx}".encode()
                ).hexdigest()[:32]

            parsed_items.append(
                ParsedStatementTransaction(
                    fitid=id_raw,
                    description=" ".join(desc_raw.split()),
                    amount=final_amt,
                    transaction_date=parsed_dt,
                    type=tx_type,
                )
            )

        return parsed_items

    @classmethod
    def parse_statement(
        cls, content_bytes: bytes, filename: str
    ) -> list[ParsedStatementTransaction]:
        """
        Roteia o parsing para OFX ou CSV dependendo da extensão ou conteúdo.
        """
        lower_name = filename.lower()
        if lower_name.endswith(".csv"):
            return cls.parse_csv(content_bytes)
        return cls.parse_ofx(content_bytes)

    @classmethod
    async def preview_import(
        cls,
        session: AsyncSession,
        account_id: uuid.UUID,
        content_bytes: bytes,
        filename: str,
    ) -> OFXPreviewResponse:
        """
        Pré-visualização da importação: detecta quantas transações são novas
        e quantas serão ignoradas por duplicidade de FITID antes da gravação.
        """
        acc_stmt = select(Account).where(Account.id == account_id)
        acc_res = await session.execute(acc_stmt)
        account = acc_res.scalars().first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conta bancária não encontrada com o ID: {account_id}",
            )

        transactions = cls.parse_statement(content_bytes, filename)
        if not transactions:
            return OFXPreviewResponse(
                total_found=0,
                new_count=0,
                duplicated_count=0,
                transactions=[],
            )

        fitids = [t.fitid for t in transactions]
        existing_stmt = select(Transaction.fitid).where(Transaction.fitid.in_(fitids))
        existing_res = await session.execute(existing_stmt)
        existing_fitids = set(existing_res.scalars().all())

        previews: list[OFXTransactionPreview] = []
        new_count = 0
        duplicated_count = 0

        for t in transactions:
            is_dup = t.fitid in existing_fitids
            if is_dup:
                duplicated_count += 1
            else:
                new_count += 1

            previews.append(
                OFXTransactionPreview(
                    fitid=t.fitid,
                    description=t.description,
                    amount=t.amount,
                    transaction_date=t.transaction_date,
                    type=t.type,
                    is_duplicate=is_dup,
                )
            )

        return OFXPreviewResponse(
            total_found=len(transactions),
            new_count=new_count,
            duplicated_count=duplicated_count,
            transactions=previews,
        )

    @classmethod
    async def execute_import(
        cls,
        session: AsyncSession,
        account_id: uuid.UUID,
        content_bytes: bytes,
        filename: str,
    ) -> OFXImportResponse:
        """
        Executa a importação com deduplicação atômica e atualização segura de saldo.
        Se uma transação com o mesmo FITID já existir, ela é ignorada silenciosamente.
        """
        acc_stmt = select(Account).where(Account.id == account_id)
        acc_res = await session.execute(acc_stmt)
        account = acc_res.scalars().first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conta bancária não encontrada com o ID: {account_id}",
            )

        transactions = cls.parse_statement(content_bytes, filename)
        if not transactions:
            return OFXImportResponse(
                import_batch_id=uuid.uuid4(),
                total_found=0,
                imported_count=0,
                duplicated_count=0,
                transactions=[],
            )

        fitids = [t.fitid for t in transactions]
        existing_stmt = select(Transaction.fitid).where(Transaction.fitid.in_(fitids))
        existing_res = await session.execute(existing_stmt)
        existing_fitids = set(existing_res.scalars().all())

        batch_id = uuid.uuid4()
        new_transactions: list[Transaction] = []
        duplicated_count = 0

        # Mutações atômicas
        for t in transactions:
            if t.fitid in existing_fitids:
                duplicated_count += 1
                continue

            # Evitar duplicata interna no mesmo arquivo se houver fitid repetido no batch
            existing_fitids.add(t.fitid)

            tx = Transaction(
                id=uuid.uuid4(),
                account_id=account.id,
                description=t.description,
                original_description=t.description,
                amount=t.amount,
                transaction_date=t.transaction_date,
                type=t.type,
                fitid=t.fitid,
                import_batch_id=batch_id,
                is_transfer=False,
            )
            new_transactions.append(tx)

            # Atualização contábil atômica do saldo da conta
            if t.type == TransactionType.INCOME:
                account.balance += t.amount
            elif t.type == TransactionType.EXPENSE:
                account.balance -= t.amount

        if new_transactions:
            session.add_all(new_transactions)

        await session.commit()

        # Serializa resposta
        response_items = [
            TransactionResponse.model_validate(tx) for tx in new_transactions
        ]

        return OFXImportResponse(
            import_batch_id=batch_id,
            total_found=len(transactions),
            imported_count=len(new_transactions),
            duplicated_count=duplicated_count,
            transactions=response_items,
        )
