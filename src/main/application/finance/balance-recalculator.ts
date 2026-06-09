import {
  GOAL_STATUSES,
  GOAL_TYPES,
  TRANSACTION_TYPES,
  type AccountDto,
  type DebtDto,
  type DebtPaymentDto,
  type SavingsGoalDto,
  type TransactionDto,
} from "@/shared/contracts/finlog";

export interface RecalculatedState {
  balances: Array<{ id: string; balanceAmount: number }>;
  goals: Array<{
    id: string;
    amount: number;
    status: SavingsGoalDto["status"];
  }>;
  debts: Array<
    Pick<
      DebtDto,
      | "id"
      | "pendingAmount"
      | "status"
      | "installmentsPaid"
      | "note"
      | "direction"
      | "createdAt"
      | "updatedAt"
      | "dueDate"
      | "personOrEntity"
      | "totalAmount"
    >
  >;
}

export function recalculateState(
  accounts: AccountDto[],
  transactions: TransactionDto[],
  goals: SavingsGoalDto[],
  debts: DebtDto[],
  debtPayments: DebtPaymentDto[]
): RecalculatedState {
  const balances = new Map(accounts.map((account) => [account.id, 0]));
  const goalAmounts = new Map(goals.map((goal) => [goal.id, 0]));
  const sortedTransactions = [...transactions].sort((left, right) => {
    if (left.date === right.date) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.date.localeCompare(right.date);
  });

  for (const transaction of sortedTransactions) {
    switch (transaction.type) {
      case TRANSACTION_TYPES.INCOME:
      case TRANSACTION_TYPES.OPENING_BALANCE:
      case TRANSACTION_TYPES.DEBT_COLLECTION:
        apply(balances, transaction.accountId, transaction.amount.amount);
        break;
      case TRANSACTION_TYPES.EXPENSE:
      case TRANSACTION_TYPES.DEBT_PAYMENT:
        apply(balances, transaction.accountId, -transaction.amount.amount);
        break;
      case TRANSACTION_TYPES.BALANCE_ADJUSTMENT:
        apply(balances, transaction.accountId, transaction.amount.amount);
        break;
      case TRANSACTION_TYPES.TRANSFER:
        apply(balances, transaction.accountId, -transaction.amount.amount);
        if (transaction.destinationAccountId) {
          apply(
            balances,
            transaction.destinationAccountId,
            transaction.amount.amount
          );
        }
        break;
      case TRANSACTION_TYPES.CURRENCY_CONVERSION:
        apply(balances, transaction.accountId, -transaction.amount.amount);
        if (transaction.destinationAccountId && transaction.destinationAmount) {
          apply(
            balances,
            transaction.destinationAccountId,
            transaction.destinationAmount.amount
          );
        }
        break;
      case TRANSACTION_TYPES.GOAL_CONTRIBUTION:
        apply(balances, transaction.accountId, -transaction.amount.amount);
        if (transaction.destinationAccountId) {
          apply(
            balances,
            transaction.destinationAccountId,
            transaction.amount.amount
          );
        }
        if (transaction.goalId) {
          apply(goalAmounts, transaction.goalId, transaction.amount.amount);
        }
        break;
      case TRANSACTION_TYPES.GOAL_RELEASE:
        apply(balances, transaction.accountId, transaction.amount.amount);
        if (transaction.destinationAccountId) {
          apply(
            balances,
            transaction.destinationAccountId,
            -transaction.amount.amount
          );
        }
        if (transaction.goalId) {
          apply(goalAmounts, transaction.goalId, -transaction.amount.amount);
        }
        break;
      default:
        break;
    }
  }

  const debtPaymentCount = new Map<string, number>();
  const debtPaidAmount = new Map<string, number>();

  for (const payment of debtPayments) {
    const currentCount = debtPaymentCount.get(payment.debtId) ?? 0;
    debtPaymentCount.set(payment.debtId, currentCount + 1);

    const currentAmount = debtPaidAmount.get(payment.debtId) ?? 0;
    debtPaidAmount.set(payment.debtId, currentAmount + payment.amount.amount);
  }

  return {
    balances: accounts.map((account) => ({
      id: account.id,
      balanceAmount: balances.get(account.id) ?? 0,
    })),
    goals: goals.map((goal) => {
      const amount = goalAmounts.get(goal.id) ?? 0;
      let status = goal.status;

      if (
        goal.status !== GOAL_STATUSES.ARCHIVED &&
        goal.status !== GOAL_STATUSES.CANCELLED
      ) {
        status =
          amount >= goal.targetAmount.amount
            ? GOAL_STATUSES.COMPLETED
            : GOAL_STATUSES.ACTIVE;
      }

      return {
        id: goal.id,
        amount,
        status,
      };
    }),
    debts: debts.map((debt) => {
      const paidAmount = debtPaidAmount.get(debt.id) ?? 0;
      const pending = Math.max(debt.totalAmount.amount - paidAmount, 0);
      const installmentsPaid = debtPaymentCount.get(debt.id) ?? 0;
      let status = debt.status;

      if (debt.status !== "archived" && debt.status !== "cancelled") {
        status = pending === 0 ? "paid" : "active";
      }

      return {
        id: debt.id,
        pendingAmount: {
          amount: pending,
          currency: debt.pendingAmount.currency,
        },
        status,
        installmentsPaid,
        note: debt.note,
        direction: debt.direction,
        createdAt: debt.createdAt,
        updatedAt: new Date().toISOString(),
        dueDate: debt.dueDate,
        personOrEntity: debt.personOrEntity,
        totalAmount: debt.totalAmount,
      };
    }),
  };
}

function apply(collection: Map<string, number>, key: string, amount: number) {
  collection.set(key, (collection.get(key) ?? 0) + amount);
}
