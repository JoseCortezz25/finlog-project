import type Database from "better-sqlite3";
import type {
  AccountDto,
  CategoryDto,
  DebtDto,
  DebtPaymentDto,
  SavingsGoalDto,
  SessionDto,
  SubcategoryDto,
  TransactionDto,
  UserProfileDto,
  UserSettingsDto,
} from "@/shared/contracts/finlog";

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

interface SettingsRow {
  user_id: string;
  primary_currency: UserSettingsDto["primaryCurrency"];
  language: UserSettingsDto["language"];
}

interface AccountRow {
  id: string;
  name: string;
  type: AccountDto["type"];
  currency: AccountDto["currency"];
  balance_amount: number;
  status: AccountDto["status"];
  credit_card_closing_day: number | null;
  credit_card_due_day: number | null;
  created_at: string;
  updated_at: string;
}

interface CategoryRow {
  id: string;
  kind: CategoryDto["kind"];
  name: string;
  status: CategoryDto["status"];
}

interface SubcategoryRow {
  id: string;
  category_id: string;
  name: string;
  status: SubcategoryDto["status"];
}

interface TransactionRow {
  id: string;
  type: TransactionDto["type"];
  account_id: string;
  destination_account_id: string | null;
  amount: number;
  currency: TransactionDto["amount"]["currency"];
  destination_amount: number | null;
  destination_currency: TransactionDto["amount"]["currency"] | null;
  category_id: string | null;
  subcategory_id: string | null;
  debt_id: string | null;
  goal_id: string | null;
  date: string;
  description: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface DebtRow {
  id: string;
  direction: DebtDto["direction"];
  person_or_entity: string;
  total_amount: number;
  pending_amount: number;
  currency: DebtDto["totalAmount"]["currency"];
  status: DebtDto["status"];
  due_date: string | null;
  installments_total: number | null;
  installments_paid: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface DebtPaymentRow {
  id: string;
  debt_id: string;
  transaction_id: string;
  account_id: string;
  amount: number;
  currency: DebtDto["totalAmount"]["currency"];
  date: string;
  note: string | null;
}

interface GoalRow {
  id: string;
  name: string;
  type: SavingsGoalDto["type"];
  account_id: string;
  target_amount: number;
  current_amount: number;
  currency: SavingsGoalDto["targetAmount"]["currency"];
  status: SavingsGoalDto["status"];
  created_at: string;
  updated_at: string;
}

export class SqliteFinlogRepository {
  constructor(private readonly database: Database.Database) {}

  inTransaction<T>(callback: () => T) {
    return this.database.transaction(callback)();
  }

  findUserByEmail(email: string) {
    return (
      (this.database
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email) as UserRow | undefined) ?? null
    );
  }

  findUserById(userId: string) {
    return (
      (this.database.prepare("SELECT * FROM users WHERE id = ?").get(userId) as
        | UserRow
        | undefined) ?? null
    );
  }

  createUser(user: UserRow) {
    this.database
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
         VALUES (@id, @name, @email, @password_hash, @created_at, @updated_at)`
      )
      .run(user);
  }

  updateUser(userId: string, name: string, email: string) {
    const updatedAt = new Date().toISOString();
    this.database
      .prepare(
        "UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?"
      )
      .run(name, email, updatedAt, userId);
  }

  updateUserPassword(userId: string, passwordHash: string) {
    this.database
      .prepare(
        "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?"
      )
      .run(passwordHash, new Date().toISOString(), userId);
  }

  getUserProfile(userId: string): UserProfileDto {
    const user = this.findUserById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado.");
    }

    const settings = this.getUserSettings(userId);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      primaryCurrency: settings?.primaryCurrency ?? null,
    };
  }

  getUserSettings(userId: string): UserSettingsDto | null {
    const row = this.database
      .prepare("SELECT * FROM user_settings WHERE user_id = ?")
      .get(userId) as SettingsRow | undefined;

    if (!row) {
      return null;
    }

    return {
      primaryCurrency: row.primary_currency,
      language: row.language,
    };
  }

  upsertUserSettings(userId: string, settings: UserSettingsDto) {
    const now = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO user_settings (user_id, primary_currency, language, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           primary_currency = excluded.primary_currency,
           language = excluded.language,
           updated_at = excluded.updated_at`
      )
      .run(userId, settings.primaryCurrency, settings.language, now, now);
  }

  listAccounts(userId: string) {
    return (
      this.database
        .prepare(
          "SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC"
        )
        .all(userId) as AccountRow[]
    ).map((row) => mapAccount(row));
  }

  findAccount(userId: string, accountId: string) {
    const row = this.database
      .prepare("SELECT * FROM accounts WHERE user_id = ? AND id = ?")
      .get(userId, accountId) as AccountRow | undefined;
    return row ? mapAccount(row) : null;
  }

  createAccount(userId: string, account: AccountDto) {
    this.database
      .prepare(
        `INSERT INTO accounts (
          id, user_id, name, type, currency, balance_amount, status,
          credit_card_closing_day, credit_card_due_day, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        account.id,
        userId,
        account.name,
        account.type,
        account.currency,
        account.balance.amount,
        account.status,
        account.creditCardClosingDay,
        account.creditCardDueDay,
        account.createdAt,
        account.updatedAt
      );
  }

  updateAccount(userId: string, account: AccountDto) {
    this.database
      .prepare(
        `UPDATE accounts
         SET name = ?, balance_amount = ?, status = ?, credit_card_closing_day = ?,
             credit_card_due_day = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(
        account.name,
        account.balance.amount,
        account.status,
        account.creditCardClosingDay,
        account.creditCardDueDay,
        account.updatedAt,
        userId,
        account.id
      );
  }

  removeAccount(userId: string, accountId: string) {
    this.database
      .prepare("DELETE FROM accounts WHERE user_id = ? AND id = ?")
      .run(userId, accountId);
  }

  listCategories(userId: string) {
    const categories = this.database
      .prepare("SELECT * FROM categories WHERE user_id = ? ORDER BY kind, name")
      .all(userId) as CategoryRow[];
    const subcategories = this.database
      .prepare("SELECT * FROM subcategories WHERE user_id = ? ORDER BY name")
      .all(userId) as SubcategoryRow[];

    return categories.map((category) => ({
      ...mapCategory(category),
      subcategories: subcategories
        .filter((item) => item.category_id === category.id)
        .map((item) => mapSubcategory(item)),
    }));
  }

  createCategory(userId: string, category: CategoryDto) {
    this.database
      .prepare(
        `INSERT INTO categories (id, user_id, kind, name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        category.id,
        userId,
        category.kind,
        category.name,
        category.status,
        new Date().toISOString(),
        new Date().toISOString()
      );
  }

  updateCategory(userId: string, categoryId: string, name: string) {
    this.database
      .prepare(
        "UPDATE categories SET name = ?, updated_at = ? WHERE user_id = ? AND id = ?"
      )
      .run(name, new Date().toISOString(), userId, categoryId);
  }

  deactivateCategory(userId: string, categoryId: string) {
    this.database
      .prepare(
        "UPDATE categories SET status = 'inactive', updated_at = ? WHERE user_id = ? AND id = ?"
      )
      .run(new Date().toISOString(), userId, categoryId);
  }

  createSubcategory(userId: string, subcategory: SubcategoryDto) {
    this.database
      .prepare(
        `INSERT INTO subcategories (id, user_id, category_id, name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        subcategory.id,
        userId,
        subcategory.categoryId,
        subcategory.name,
        subcategory.status,
        new Date().toISOString(),
        new Date().toISOString()
      );
  }

  mergeCategory(
    userId: string,
    sourceCategoryId: string,
    targetCategoryId: string
  ) {
    this.database
      .prepare(
        `UPDATE transactions
         SET category_id = ?, subcategory_id = NULL
         WHERE user_id = ? AND category_id = ?`
      )
      .run(targetCategoryId, userId, sourceCategoryId);
    this.deactivateCategory(userId, sourceCategoryId);
  }

  listTransactions(userId: string) {
    return (
      this.database
        .prepare(
          "SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC"
        )
        .all(userId) as TransactionRow[]
    ).map((row) => mapTransaction(row));
  }

  findTransaction(userId: string, transactionId: string) {
    const row = this.database
      .prepare("SELECT * FROM transactions WHERE user_id = ? AND id = ?")
      .get(userId, transactionId) as TransactionRow | undefined;
    return row ? mapTransaction(row) : null;
  }

  createTransaction(userId: string, transaction: TransactionDto) {
    this.database
      .prepare(
        `INSERT INTO transactions (
          id, user_id, type, account_id, destination_account_id, amount, currency,
          destination_amount, destination_currency, category_id, subcategory_id, debt_id,
          goal_id, date, description, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        transaction.id,
        userId,
        transaction.type,
        transaction.accountId,
        transaction.destinationAccountId,
        transaction.amount.amount,
        transaction.amount.currency,
        transaction.destinationAmount?.amount ?? null,
        transaction.destinationAmount?.currency ?? null,
        transaction.categoryId,
        transaction.subcategoryId,
        transaction.debtId,
        transaction.goalId,
        transaction.date,
        transaction.description,
        transaction.note,
        transaction.createdAt,
        transaction.updatedAt
      );
  }

  updateTransactionMetadata(userId: string, transaction: TransactionDto) {
    this.database
      .prepare(
        `UPDATE transactions
         SET date = ?, description = ?, note = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(
        transaction.date,
        transaction.description,
        transaction.note,
        transaction.updatedAt,
        userId,
        transaction.id
      );
  }

  removeTransaction(userId: string, transactionId: string) {
    this.database
      .prepare("DELETE FROM transactions WHERE user_id = ? AND id = ?")
      .run(userId, transactionId);
  }

  listDebts(userId: string) {
    return (
      this.database
        .prepare(
          "SELECT * FROM debts WHERE user_id = ? ORDER BY created_at DESC"
        )
        .all(userId) as DebtRow[]
    ).map((row) => mapDebt(row));
  }

  findDebt(userId: string, debtId: string) {
    const row = this.database
      .prepare("SELECT * FROM debts WHERE user_id = ? AND id = ?")
      .get(userId, debtId) as DebtRow | undefined;
    return row ? mapDebt(row) : null;
  }

  createDebt(userId: string, debt: DebtDto) {
    this.database
      .prepare(
        `INSERT INTO debts (
          id, user_id, direction, person_or_entity, total_amount, pending_amount,
          currency, status, due_date, installments_total, installments_paid, note,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        debt.id,
        userId,
        debt.direction,
        debt.personOrEntity,
        debt.totalAmount.amount,
        debt.pendingAmount.amount,
        debt.totalAmount.currency,
        debt.status,
        debt.dueDate,
        debt.installmentsTotal,
        debt.installmentsPaid,
        debt.note,
        debt.createdAt,
        debt.updatedAt
      );
  }

  updateDebt(userId: string, debt: DebtDto) {
    this.database
      .prepare(
        `UPDATE debts
         SET pending_amount = ?, status = ?, installments_paid = ?, note = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(
        debt.pendingAmount.amount,
        debt.status,
        debt.installmentsPaid,
        debt.note,
        debt.updatedAt,
        userId,
        debt.id
      );
  }

  listDebtPayments(userId: string, debtId: string) {
    return (
      this.database
        .prepare(
          "SELECT * FROM debt_payments WHERE user_id = ? AND debt_id = ? ORDER BY date DESC"
        )
        .all(userId, debtId) as DebtPaymentRow[]
    ).map((row) => mapDebtPayment(row));
  }

  createDebtPayment(userId: string, payment: DebtPaymentDto) {
    this.database
      .prepare(
        `INSERT INTO debt_payments (
          id, user_id, debt_id, transaction_id, account_id, amount, currency, date, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        payment.id,
        userId,
        payment.debtId,
        payment.transactionId,
        payment.accountId,
        payment.amount.amount,
        payment.amount.currency,
        payment.date,
        payment.note,
        new Date().toISOString()
      );
  }

  listGoals(userId: string) {
    return (
      this.database
        .prepare(
          "SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC"
        )
        .all(userId) as GoalRow[]
    ).map((row) => mapGoal(row));
  }

  findGoal(userId: string, goalId: string) {
    const row = this.database
      .prepare("SELECT * FROM savings_goals WHERE user_id = ? AND id = ?")
      .get(userId, goalId) as GoalRow | undefined;
    return row ? mapGoal(row) : null;
  }

  createGoal(userId: string, goal: SavingsGoalDto) {
    this.database
      .prepare(
        `INSERT INTO savings_goals (
          id, user_id, name, type, account_id, target_amount,
          current_amount, currency, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        goal.id,
        userId,
        goal.name,
        goal.type,
        goal.accountId,
        goal.targetAmount.amount,
        goal.currentAmount.amount,
        goal.targetAmount.currency,
        goal.status,
        goal.createdAt,
        goal.updatedAt
      );
  }

  updateGoal(userId: string, goal: SavingsGoalDto) {
    this.database
      .prepare(
        `UPDATE savings_goals
         SET current_amount = ?, status = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(
        goal.currentAmount.amount,
        goal.status,
        goal.updatedAt,
        userId,
        goal.id
      );
  }

  replaceAccountBalances(
    userId: string,
    balances: Array<{ id: string; balanceAmount: number }>
  ) {
    const statement = this.database.prepare(
      "UPDATE accounts SET balance_amount = ?, updated_at = ? WHERE user_id = ? AND id = ?"
    );
    const updatedAt = new Date().toISOString();

    for (const balance of balances) {
      statement.run(balance.balanceAmount, updatedAt, userId, balance.id);
    }
  }

  replaceGoalAmounts(
    userId: string,
    amounts: Array<{
      id: string;
      amount: number;
      status: SavingsGoalDto["status"];
    }>
  ) {
    const statement = this.database.prepare(
      "UPDATE savings_goals SET current_amount = ?, status = ?, updated_at = ? WHERE user_id = ? AND id = ?"
    );
    const updatedAt = new Date().toISOString();

    for (const item of amounts) {
      statement.run(item.amount, item.status, updatedAt, userId, item.id);
    }
  }

  hasTransactionsForAccount(userId: string, accountId: string) {
    const row = this.database
      .prepare(
        "SELECT COUNT(*) AS total FROM transactions WHERE user_id = ? AND (account_id = ? OR destination_account_id = ?)"
      )
      .get(userId, accountId, accountId) as { total: number };
    return row.total > 0;
  }

  hasTransactionsForCategory(userId: string, categoryId: string) {
    const row = this.database
      .prepare(
        "SELECT COUNT(*) AS total FROM transactions WHERE user_id = ? AND category_id = ?"
      )
      .get(userId, categoryId) as { total: number };
    return row.total > 0;
  }

  deleteFinancialData(userId: string) {
    this.database
      .prepare("DELETE FROM debt_payments WHERE user_id = ?")
      .run(userId);
    this.database
      .prepare("DELETE FROM transactions WHERE user_id = ?")
      .run(userId);
    this.database
      .prepare("DELETE FROM savings_goals WHERE user_id = ?")
      .run(userId);
    this.database.prepare("DELETE FROM debts WHERE user_id = ?").run(userId);
    this.database
      .prepare("DELETE FROM subcategories WHERE user_id = ?")
      .run(userId);
    this.database
      .prepare("DELETE FROM categories WHERE user_id = ?")
      .run(userId);
    this.database.prepare("DELETE FROM accounts WHERE user_id = ?").run(userId);
  }
}

function mapAccount(row: AccountRow): AccountDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    balance: {
      amount: row.balance_amount,
      currency: row.currency,
    },
    status: row.status,
    creditCardClosingDay: row.credit_card_closing_day,
    creditCardDueDay: row.credit_card_due_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCategory(row: CategoryRow): Omit<CategoryDto, "subcategories"> {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    status: row.status,
  };
}

function mapSubcategory(row: SubcategoryRow): SubcategoryDto {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    status: row.status,
  };
}

function mapTransaction(row: TransactionRow): TransactionDto {
  return {
    id: row.id,
    type: row.type,
    accountId: row.account_id,
    destinationAccountId: row.destination_account_id,
    amount: {
      amount: row.amount,
      currency: row.currency,
    },
    destinationAmount:
      row.destination_amount !== null && row.destination_currency
        ? {
            amount: row.destination_amount,
            currency: row.destination_currency,
          }
        : null,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    debtId: row.debt_id,
    goalId: row.goal_id,
    date: row.date,
    description: row.description,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDebt(row: DebtRow): DebtDto {
  const isPartiallyPaid =
    row.pending_amount > 0 && row.pending_amount < row.total_amount;
  const isOverdue = Boolean(
    row.due_date &&
      row.pending_amount > 0 &&
      row.due_date < new Date().toISOString().slice(0, 10)
  );

  return {
    id: row.id,
    direction: row.direction,
    personOrEntity: row.person_or_entity,
    totalAmount: {
      amount: row.total_amount,
      currency: row.currency,
    },
    pendingAmount: {
      amount: row.pending_amount,
      currency: row.currency,
    },
    status: row.status,
    dueDate: row.due_date,
    installmentsTotal: row.installments_total,
    installmentsPaid: row.installments_paid,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPartiallyPaid,
    isOverdue,
  };
}

function mapDebtPayment(row: DebtPaymentRow): DebtPaymentDto {
  return {
    id: row.id,
    debtId: row.debt_id,
    transactionId: row.transaction_id,
    accountId: row.account_id,
    amount: {
      amount: row.amount,
      currency: row.currency,
    },
    date: row.date,
    note: row.note,
  };
}

function mapGoal(row: GoalRow): SavingsGoalDto {
  const progressPercentage =
    row.target_amount === 0
      ? 0
      : Math.round((row.current_amount / row.target_amount) * 100);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    accountId: row.account_id,
    targetAmount: {
      amount: row.target_amount,
      currency: row.currency,
    },
    currentAmount: {
      amount: row.current_amount,
      currency: row.currency,
    },
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progressPercentage,
  };
}

export function createSessionDto(
  profile: UserProfileDto,
  needsOnboarding: boolean
): SessionDto {
  return {
    userId: profile.id,
    name: profile.name,
    email: profile.email,
    primaryCurrency: profile.primaryCurrency,
    needsOnboarding,
  };
}
