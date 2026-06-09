import type { CurrencyCode, MoneyDto } from "@/shared/contracts/finlog";

const CURRENCY_MINOR_UNITS: Record<CurrencyCode, number> = {
  COP: 0,
  USD: 2,
  EUR: 2,
};

export class Money {
  readonly amount: number;
  readonly currency: CurrencyCode;

  constructor(amount: number, currency: CurrencyCode) {
    if (!Number.isInteger(amount)) {
      throw new Error("El monto debe ser entero en unidad minima.");
    }

    this.amount = amount;
    this.currency = currency;
  }

  add(other: Money) {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money) {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  isPositive() {
    return this.amount > 0;
  }

  isNegative() {
    return this.amount < 0;
  }

  isZero() {
    return this.amount === 0;
  }

  toDto(): MoneyDto {
    return {
      amount: this.amount,
      currency: this.currency,
    };
  }

  private assertSameCurrency(other: Money) {
    if (this.currency !== other.currency) {
      throw new Error("No se pueden mezclar monedas sin conversion manual.");
    }
  }
}

export function formatMoneyValue(money: MoneyDto) {
  const scale = CURRENCY_MINOR_UNITS[money.currency] ?? 2;

  if (scale === 0) {
    return `${money.amount.toLocaleString("es-CO")} ${money.currency}`;
  }

  return `${(money.amount / 10 ** scale).toLocaleString("es-CO", {
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  })} ${money.currency}`;
}

export function ensureDateRange(from: string | null, to: string | null) {
  if (from && to && from > to) {
    throw new Error("La fecha inicial no puede ser mayor a la final.");
  }
}

export function startOfMonthIso(date = new Date()) {
  const value = new Date(date.getFullYear(), date.getMonth(), 1);
  return value.toISOString().slice(0, 10);
}

export function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
