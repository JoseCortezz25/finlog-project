import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { dialog } from "electron";
import { recalculateState } from "@/main/application/finance/balance-recalculator";
import { databaseManager } from "@/main/infrastructure/database/sqlite";
import {
  createSessionDto,
  SqliteFinlogRepository,
} from "@/main/infrastructure/repositories/sqlite-finlog-repository";
import {
  hashPassword,
  verifyPassword,
} from "@/main/infrastructure/security/password-hasher";
import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  CATEGORY_KINDS,
  CATEGORY_STATUSES,
  DEBT_DIRECTIONS,
  DEBT_STATUSES,
  GOAL_STATUSES,
  GOAL_TYPES,
  TRANSACTION_TYPES,
  type AccountDto,
  type AuthCredentialsInput,
  type CategoryDto,
  type ChangePasswordInput,
  type CreateAccountInput,
  type CreateAdjustmentInput,
  type CreateCategoryInput,
  type CreateConversionInput,
  type CreateDebtInput,
  type CreateDebtMovementInput,
  type CreateGoalInput,
  type CreateGoalMovementInput,
  type CreateIncomeExpenseInput,
  type CreateSubcategoryInput,
  type CreateTransferInput,
  type CurrencyCode,
  type DashboardSummaryDto,
  type DebtDto,
  type DebtPaymentDto,
  type ExportPackageDto,
  type FinlogApi,
  type GoalStatus,
  type InitializeOnboardingInput,
  type MergeCategoryInput,
  type MonthlyIncomeExpenseReportItemDto,
  type RegisterUserInput,
  type ReportFiltersInput,
  type ReportsDto,
  type SavingsGoalDto,
  type SessionDto,
  type TransactionDto,
  type TransactionFiltersInput,
  type UpdateAccountInput,
  type UpdateCategoryInput,
  type UpdateTransactionInput,
  type UserProfileDto,
} from "@/shared/contracts/finlog";
import { ensureDateRange, startOfMonthIso } from "@/shared/domain/finance";

const DEFAULT_LANGUAGE = "es" as const;

const DEFAULT_CATEGORY_SEED = [
  {
    kind: CATEGORY_KINDS.INCOME,
    name: "Salario",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.INCOME,
    name: "Freelance",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.INCOME,
    name: "Ventas",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.INCOME,
    name: "Regalos",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.INCOME,
    name: "Reembolsos",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.INCOME,
    name: "Otros ingresos",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Alimentacion",
    subcategories: ["Mercado", "Restaurantes", "Domicilios"],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Transporte",
    subcategories: ["Gasolina", "Transporte publico", "Apps de movilidad"],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Vivienda",
    subcategories: ["Arriendo", "Servicios", "Mantenimiento"],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Salud",
    subcategories: ["Medicamentos", "Citas medicas"],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Educacion",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Entretenimiento",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Suscripciones",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Deudas / pagos",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Ahorro / metas",
    subcategories: [],
  },
  {
    kind: CATEGORY_KINDS.EXPENSE,
    name: "Otros gastos",
    subcategories: [],
  },
];

export class FinlogService implements FinlogApi {
  private sessionUserId: string | null = null;

  private get repository() {
    return new SqliteFinlogRepository(databaseManager.getConnection());
  }

  readonly auth: FinlogApi["auth"] = {
    getSession: async () => this.getSession(),
    register: async (input) => this.register(input),
    login: async (input) => this.login(input),
    logout: async () => this.logout(),
    changePassword: async (input) => this.changePassword(input),
    getProfile: async () => this.getProfile(),
  };

  readonly onboarding: FinlogApi["onboarding"] = {
    complete: async (input) => this.completeOnboarding(input),
  };

  readonly accounts: FinlogApi["accounts"] = {
    list: async () => this.listAccounts(),
    create: async (input) => this.createAccount(input),
    update: async (input) => this.updateAccount(input),
    archive: async (accountId) => this.archiveAccount(accountId),
    remove: async (accountId) => this.removeAccount(accountId),
  };

  readonly categories: FinlogApi["categories"] = {
    list: async () => this.listCategories(),
    create: async (input) => this.createCategory(input),
    update: async (input) => this.updateCategory(input),
    deactivate: async (categoryId) => this.deactivateCategory(categoryId),
    merge: async (input) => this.mergeCategory(input),
    createSubcategory: async (input) => this.createSubcategory(input),
  };

  readonly transactions: FinlogApi["transactions"] = {
    list: async (filters) => this.listTransactions(filters),
    createIncome: async (input) =>
      this.createIncomeOrExpense(TRANSACTION_TYPES.INCOME, input),
    createExpense: async (input) =>
      this.createIncomeOrExpense(TRANSACTION_TYPES.EXPENSE, input),
    createTransfer: async (input) => this.createTransfer(input),
    createConversion: async (input) => this.createConversion(input),
    createAdjustment: async (input) => this.createAdjustment(input),
    update: async (input) => this.updateTransaction(input),
    remove: async (transactionId) => this.removeTransaction(transactionId),
  };

  readonly debts: FinlogApi["debts"] = {
    list: async () => this.listDebts(),
    create: async (input) => this.createDebt(input),
    registerPayment: async (input) =>
      this.registerDebtMovement("payment", input),
    registerCollection: async (input) =>
      this.registerDebtMovement("collection", input),
    cancel: async (debtId) =>
      this.updateDebtStatus(debtId, DEBT_STATUSES.CANCELLED),
    archive: async (debtId) =>
      this.updateDebtStatus(debtId, DEBT_STATUSES.ARCHIVED),
    listPayments: async (debtId) => this.listDebtPayments(debtId),
  };

  readonly goals: FinlogApi["goals"] = {
    list: async () => this.listGoals(),
    create: async (input) => this.createGoal(input),
    contribute: async (input) =>
      this.registerGoalMovement("contribution", input),
    release: async (input) => this.registerGoalMovement("release", input),
    cancel: async (goalId) =>
      this.updateGoalStatus(goalId, GOAL_STATUSES.CANCELLED),
    archive: async (goalId) =>
      this.updateGoalStatus(goalId, GOAL_STATUSES.ARCHIVED),
  };

  readonly dashboard: FinlogApi["dashboard"] = {
    summary: async (filters) => this.getDashboardSummary(filters),
  };

  readonly reports: FinlogApi["reports"] = {
    get: async (filters) => this.getReports(filters),
  };

  readonly settings: FinlogApi["settings"] = {
    updateProfile: async (input) => this.updateProfile(input.name, input.email),
    updatePrimaryCurrency: async (currency) =>
      this.updatePrimaryCurrency(currency),
    exportJson: async () => this.exportJson(),
    importJson: async () => this.importJson(),
    createBackup: async () => this.createBackup(),
    restoreBackup: async () => this.restoreBackup(),
  };

  private getCurrentUserId() {
    if (!this.sessionUserId) {
      throw new Error("Debes iniciar sesion.");
    }

    return this.sessionUserId;
  }

  private buildSession(userId: string) {
    const profile = this.repository.getUserProfile(userId);
    const needsOnboarding = this.getNeedsOnboarding(userId);
    return createSessionDto(profile, needsOnboarding);
  }

  private getNeedsOnboarding(userId: string) {
    const settings = this.repository.getUserSettings(userId);
    const accounts = this.repository.listAccounts(userId);
    return !settings || accounts.length === 0;
  }

  private async getSession() {
    if (!this.sessionUserId) {
      return null;
    }

    return this.buildSession(this.sessionUserId);
  }

  private async register(input: RegisterUserInput) {
    validateEmail(input.email);
    validatePassword(input.password);

    const existing = this.repository.findUserByEmail(
      input.email.trim().toLowerCase()
    );
    if (existing) {
      throw new Error("Ya existe un usuario con ese correo.");
    }

    const now = new Date().toISOString();
    const userId = randomUUID();
    this.repository.createUser({
      id: userId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password_hash: hashPassword(input.password),
      created_at: now,
      updated_at: now,
    });

    this.sessionUserId = userId;
    return this.buildSession(userId);
  }

  private async login(input: AuthCredentialsInput) {
    const user = this.repository.findUserByEmail(
      input.email.trim().toLowerCase()
    );
    if (!user || !verifyPassword(input.password, user.password_hash)) {
      throw new Error("Correo o contrasena invalidos.");
    }

    this.sessionUserId = user.id;
    return this.buildSession(user.id);
  }

  private async logout() {
    this.sessionUserId = null;
  }

  private async changePassword(input: ChangePasswordInput) {
    const userId = this.getCurrentUserId();
    if (input.newPassword !== input.confirmNewPassword) {
      throw new Error("La confirmacion de la contrasena no coincide.");
    }

    validatePassword(input.newPassword);

    const user = this.repository.findUserById(userId);
    if (!user || !verifyPassword(input.currentPassword, user.password_hash)) {
      throw new Error("La contrasena actual es invalida.");
    }

    this.repository.updateUserPassword(userId, hashPassword(input.newPassword));
  }

  private async getProfile() {
    return this.repository.getUserProfile(this.getCurrentUserId());
  }

  private async updateProfile(name: string, email: string) {
    const userId = this.getCurrentUserId();
    validateEmail(email);
    this.repository.updateUser(userId, name.trim(), email.trim().toLowerCase());
    return this.repository.getUserProfile(userId);
  }

  private async updatePrimaryCurrency(currency: CurrencyCode) {
    const userId = this.getCurrentUserId();
    const settings = this.repository.getUserSettings(userId);
    this.repository.upsertUserSettings(userId, {
      primaryCurrency: currency,
      language: settings?.language ?? DEFAULT_LANGUAGE,
    });
    return this.repository.getUserProfile(userId);
  }

  private async completeOnboarding(input: InitializeOnboardingInput) {
    const userId = this.getCurrentUserId();
    this.repository.inTransaction(() => {
      this.repository.upsertUserSettings(userId, input.settings);
      if (
        input.shouldSeedCategories &&
        this.repository.listCategories(userId).length === 0
      ) {
        this.seedDefaultCategories(userId);
      }

      for (const account of input.accounts) {
        this.createAccountInCurrentTransaction(userId, account);
      }

      this.recalculateUserState(userId);
    });

    return this.buildSession(userId);
  }

  private seedDefaultCategories(userId: string) {
    for (const seed of DEFAULT_CATEGORY_SEED) {
      const categoryId = randomUUID();
      this.repository.createCategory(userId, {
        id: categoryId,
        kind: seed.kind,
        name: seed.name,
        status: CATEGORY_STATUSES.ACTIVE,
        subcategories: [],
      });

      for (const subcategoryName of seed.subcategories) {
        this.repository.createSubcategory(userId, {
          id: randomUUID(),
          categoryId,
          name: subcategoryName,
          status: CATEGORY_STATUSES.ACTIVE,
        });
      }
    }
  }

  private async listAccounts() {
    return this.repository.listAccounts(this.getCurrentUserId());
  }

  private createAccountInCurrentTransaction(
    userId: string,
    input: CreateAccountInput
  ) {
    validateAccountInput(input);
    const now = new Date().toISOString();
    const accountId = randomUUID();
    const account: AccountDto = {
      id: accountId,
      name: input.name.trim(),
      type: input.type,
      currency: input.currency,
      balance: {
        amount: 0,
        currency: input.currency,
      },
      status: ACCOUNT_STATUSES.ACTIVE,
      creditCardClosingDay: input.creditCardClosingDay,
      creditCardDueDay: input.creditCardDueDay,
      createdAt: now,
      updatedAt: now,
    };

    this.repository.createAccount(userId, account);

    if (input.openingBalanceAmount !== 0) {
      this.repository.createTransaction(userId, {
        id: randomUUID(),
        type: TRANSACTION_TYPES.OPENING_BALANCE,
        accountId,
        destinationAccountId: null,
        amount: {
          amount: input.openingBalanceAmount,
          currency: input.currency,
        },
        destinationAmount: null,
        categoryId: null,
        subcategoryId: null,
        debtId: null,
        goalId: null,
        date: new Date().toISOString().slice(0, 10),
        description: "Saldo inicial",
        note: "Registro inicial de la cuenta",
        createdAt: now,
        updatedAt: now,
      });
    }

    return accountId;
  }

  private async createAccount(input: CreateAccountInput) {
    const userId = this.getCurrentUserId();
    this.repository.inTransaction(() => {
      this.createAccountInCurrentTransaction(userId, input);
      this.recalculateUserState(userId);
    });

    const accounts = this.repository.listAccounts(userId);
    return accounts[0];
  }

  private async updateAccount(input: UpdateAccountInput) {
    const userId = this.getCurrentUserId();
    const account = this.ensureAccount(userId, input.accountId);
    const updated: AccountDto = {
      ...account,
      name: input.name.trim(),
      creditCardClosingDay: input.creditCardClosingDay,
      creditCardDueDay: input.creditCardDueDay,
      updatedAt: new Date().toISOString(),
    };
    this.repository.updateAccount(userId, updated);
    return updated;
  }

  private async archiveAccount(accountId: string) {
    const userId = this.getCurrentUserId();
    const account = this.ensureAccount(userId, accountId);
    this.repository.updateAccount(userId, {
      ...account,
      status: ACCOUNT_STATUSES.ARCHIVED,
      updatedAt: new Date().toISOString(),
    });
  }

  private async removeAccount(accountId: string) {
    const userId = this.getCurrentUserId();
    if (this.repository.hasTransactionsForAccount(userId, accountId)) {
      throw new Error("La cuenta tiene movimientos y solo puede archivarse.");
    }
    this.repository.removeAccount(userId, accountId);
  }

  private async listCategories() {
    return this.repository.listCategories(this.getCurrentUserId());
  }

  private async createCategory(input: CreateCategoryInput) {
    const userId = this.getCurrentUserId();
    const category: CategoryDto = {
      id: randomUUID(),
      kind: input.kind,
      name: input.name.trim(),
      status: CATEGORY_STATUSES.ACTIVE,
      subcategories: [],
    };
    this.repository.createCategory(userId, category);
    return category;
  }

  private async updateCategory(input: UpdateCategoryInput) {
    const userId = this.getCurrentUserId();
    this.repository.updateCategory(userId, input.categoryId, input.name.trim());
    const categories = this.repository.listCategories(userId);
    const category = categories.find((item) => item.id === input.categoryId);
    if (!category) {
      throw new Error("Categoria no encontrada.");
    }
    return category;
  }

  private async deactivateCategory(categoryId: string) {
    const userId = this.getCurrentUserId();
    if (!this.repository.hasTransactionsForCategory(userId, categoryId)) {
      this.repository.deactivateCategory(userId, categoryId);
      return;
    }

    this.repository.deactivateCategory(userId, categoryId);
  }

  private async mergeCategory(input: MergeCategoryInput) {
    this.repository.mergeCategory(
      this.getCurrentUserId(),
      input.sourceCategoryId,
      input.targetCategoryId
    );
  }

  private async createSubcategory(input: CreateSubcategoryInput) {
    const userId = this.getCurrentUserId();
    const subcategory = {
      id: randomUUID(),
      categoryId: input.categoryId,
      name: input.name.trim(),
      status: CATEGORY_STATUSES.ACTIVE,
    };
    this.repository.createSubcategory(userId, subcategory);
    return subcategory;
  }

  private async listTransactions(filters: TransactionFiltersInput) {
    const userId = this.getCurrentUserId();
    ensureDateRange(filters.from, filters.to);
    return this.repository.listTransactions(userId).filter((transaction) => {
      if (
        filters.accountId &&
        transaction.accountId !== filters.accountId &&
        transaction.destinationAccountId !== filters.accountId
      ) {
        return false;
      }
      if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
        return false;
      }
      if (filters.type !== "all" && transaction.type !== filters.type) {
        return false;
      }
      if (
        filters.currency !== "all" &&
        transaction.amount.currency !== filters.currency
      ) {
        return false;
      }
      if (filters.from && transaction.date < filters.from) {
        return false;
      }
      if (filters.to && transaction.date > filters.to) {
        return false;
      }

      const haystack =
        `${transaction.description ?? ""} ${transaction.note ?? ""}`.toLowerCase();
      if (filters.search && !haystack.includes(filters.search.toLowerCase())) {
        return false;
      }

      return true;
    });
  }

  private async createIncomeOrExpense(
    type: typeof TRANSACTION_TYPES.INCOME | typeof TRANSACTION_TYPES.EXPENSE,
    input: CreateIncomeExpenseInput
  ) {
    const userId = this.getCurrentUserId();
    const account = this.ensureActiveAccount(userId, input.accountId);
    this.ensureCategory(
      userId,
      input.categoryId,
      type === TRANSACTION_TYPES.INCOME
        ? CATEGORY_KINDS.INCOME
        : CATEGORY_KINDS.EXPENSE
    );
    validatePositiveAmount(input.amount);

    const transaction: TransactionDto = {
      id: randomUUID(),
      type,
      accountId: input.accountId,
      destinationAccountId: null,
      amount: {
        amount: input.amount,
        currency: account.currency,
      },
      destinationAmount: null,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      debtId: null,
      goalId: null,
      date: input.date,
      description: trimOrNull(input.description),
      note: trimOrNull(input.note),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.repository.inTransaction(() => {
      this.repository.createTransaction(userId, transaction);
      this.recalculateUserState(userId);
    });

    return transaction;
  }

  private async createTransfer(input: CreateTransferInput) {
    const userId = this.getCurrentUserId();
    const source = this.ensureActiveAccount(userId, input.accountId);
    const destination = this.ensureActiveAccount(
      userId,
      input.destinationAccountId
    );
    if (source.id === destination.id) {
      throw new Error("La cuenta destino debe ser diferente.");
    }
    if (source.currency !== destination.currency) {
      throw new Error("Las transferencias normales requieren la misma moneda.");
    }
    validatePositiveAmount(input.amount);

    const transaction = baseTransaction(input, {
      type: TRANSACTION_TYPES.TRANSFER,
      accountId: source.id,
      destinationAccountId: destination.id,
      amount: {
        amount: input.amount,
        currency: source.currency,
      },
      destinationAmount: null,
      debtId: null,
      goalId: null,
    });

    this.repository.inTransaction(() => {
      this.repository.createTransaction(userId, transaction);
      this.recalculateUserState(userId);
    });

    return transaction;
  }

  private async createConversion(input: CreateConversionInput) {
    const userId = this.getCurrentUserId();
    const source = this.ensureActiveAccount(userId, input.accountId);
    const destination = this.ensureActiveAccount(
      userId,
      input.destinationAccountId
    );
    if (source.id === destination.id) {
      throw new Error("La conversion requiere cuentas diferentes.");
    }
    validatePositiveAmount(input.amount);
    validatePositiveAmount(input.destinationAmount);

    const transaction = baseTransaction(input, {
      type: TRANSACTION_TYPES.CURRENCY_CONVERSION,
      accountId: source.id,
      destinationAccountId: destination.id,
      amount: {
        amount: input.amount,
        currency: source.currency,
      },
      destinationAmount: {
        amount: input.destinationAmount,
        currency: destination.currency,
      },
      debtId: null,
      goalId: null,
    });

    this.repository.inTransaction(() => {
      this.repository.createTransaction(userId, transaction);
      this.recalculateUserState(userId);
    });

    return transaction;
  }

  private async createAdjustment(input: CreateAdjustmentInput) {
    const userId = this.getCurrentUserId();
    const account = this.ensureActiveAccount(userId, input.accountId);
    if (!input.note.trim()) {
      throw new Error("El ajuste requiere una nota obligatoria.");
    }

    const transaction = baseTransaction(input, {
      type: TRANSACTION_TYPES.BALANCE_ADJUSTMENT,
      accountId: account.id,
      destinationAccountId: null,
      amount: {
        amount: input.amount,
        currency: account.currency,
      },
      destinationAmount: null,
      debtId: null,
      goalId: null,
    });

    this.repository.inTransaction(() => {
      this.repository.createTransaction(userId, transaction);
      this.recalculateUserState(userId);
    });

    return transaction;
  }

  private async updateTransaction(input: UpdateTransactionInput) {
    const userId = this.getCurrentUserId();
    const transaction = this.repository.findTransaction(
      userId,
      input.transactionId
    );
    if (!transaction) {
      throw new Error("Movimiento no encontrado.");
    }

    const updated: TransactionDto = {
      ...transaction,
      date: input.date,
      description: trimOrNull(input.description),
      note: trimOrNull(input.note),
      updatedAt: new Date().toISOString(),
    };

    this.repository.updateTransactionMetadata(userId, updated);
    this.recalculateUserState(userId);
    return updated;
  }

  private async removeTransaction(transactionId: string) {
    const userId = this.getCurrentUserId();
    this.repository.inTransaction(() => {
      this.repository.removeTransaction(userId, transactionId);
      this.recalculateUserState(userId);
    });
  }

  private async listDebts() {
    return this.repository.listDebts(this.getCurrentUserId());
  }

  private async createDebt(input: CreateDebtInput) {
    const userId = this.getCurrentUserId();
    validatePositiveAmount(input.amount);
    const debt: DebtDto = {
      id: randomUUID(),
      direction: input.direction,
      personOrEntity: input.personOrEntity.trim(),
      totalAmount: {
        amount: input.amount,
        currency: input.currency,
      },
      pendingAmount: {
        amount: input.amount,
        currency: input.currency,
      },
      status: DEBT_STATUSES.ACTIVE,
      dueDate: input.dueDate,
      installmentsTotal: input.installmentsTotal,
      installmentsPaid: 0,
      note: trimOrNull(input.note),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPartiallyPaid: false,
      isOverdue: false,
    };
    this.repository.createDebt(userId, debt);
    return debt;
  }

  private async registerDebtMovement(
    mode: "payment" | "collection",
    input: CreateDebtMovementInput
  ) {
    const userId = this.getCurrentUserId();
    const debt = this.ensureDebt(userId, input.debtId);
    const account = this.ensureActiveAccount(userId, input.accountId);
    validatePositiveAmount(input.amount);

    if (debt.pendingAmount.amount < input.amount) {
      throw new Error("El monto no puede superar el saldo pendiente.");
    }
    if (debt.totalAmount.currency !== account.currency) {
      throw new Error("La cuenta debe usar la misma moneda de la deuda.");
    }
    if (mode === "payment" && debt.direction !== DEBT_DIRECTIONS.PAYABLE) {
      throw new Error("Solo las deudas por pagar aceptan pagos.");
    }
    if (
      mode === "collection" &&
      debt.direction !== DEBT_DIRECTIONS.RECEIVABLE
    ) {
      throw new Error("Solo las cuentas por cobrar aceptan cobros.");
    }

    const transaction = baseTransaction(input, {
      type:
        mode === "payment"
          ? TRANSACTION_TYPES.DEBT_PAYMENT
          : TRANSACTION_TYPES.DEBT_COLLECTION,
      accountId: account.id,
      destinationAccountId: null,
      amount: {
        amount: input.amount,
        currency: account.currency,
      },
      destinationAmount: null,
      debtId: debt.id,
      goalId: null,
    });

    const payment: DebtPaymentDto = {
      id: randomUUID(),
      debtId: debt.id,
      transactionId: transaction.id,
      accountId: account.id,
      amount: transaction.amount,
      date: input.date,
      note: trimOrNull(input.note),
    };

    this.repository.inTransaction(() => {
      this.repository.createTransaction(userId, transaction);
      this.repository.createDebtPayment(userId, payment);
      this.recalculateUserState(userId);
    });
  }

  private async updateDebtStatus(debtId: string, status: DebtDto["status"]) {
    const userId = this.getCurrentUserId();
    const debt = this.ensureDebt(userId, debtId);
    this.repository.updateDebt(userId, {
      ...debt,
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  private async listDebtPayments(debtId: string) {
    return this.repository.listDebtPayments(this.getCurrentUserId(), debtId);
  }

  private async listGoals() {
    return this.repository.listGoals(this.getCurrentUserId());
  }

  private async createGoal(input: CreateGoalInput) {
    const userId = this.getCurrentUserId();
    const account = this.ensureAccount(userId, input.accountId);
    validatePositiveAmount(input.targetAmount);
    const goal: SavingsGoalDto = {
      id: randomUUID(),
      name: input.name.trim(),
      type: input.type,
      accountId: account.id,
      targetAmount: {
        amount: input.targetAmount,
        currency: account.currency,
      },
      currentAmount: {
        amount: 0,
        currency: account.currency,
      },
      status: GOAL_STATUSES.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progressPercentage: 0,
    };
    this.repository.createGoal(userId, goal);
    return goal;
  }

  private async registerGoalMovement(
    mode: "contribution" | "release",
    input: CreateGoalMovementInput
  ) {
    const userId = this.getCurrentUserId();
    const goal = this.ensureGoal(userId, input.goalId);
    const account = this.ensureActiveAccount(userId, input.accountId);
    validatePositiveAmount(input.amount);

    if (goal.targetAmount.currency !== account.currency) {
      throw new Error("La cuenta debe usar la misma moneda de la meta.");
    }

    if (mode === "release" && goal.currentAmount.amount < input.amount) {
      throw new Error("No puedes liberar mas dinero del acumulado en la meta.");
    }

    let accountId = account.id;
    let destinationAccountId: string | null = null;

    if (goal.type === GOAL_TYPES.POCKET && account.id !== goal.accountId) {
      throw new Error(
        "Las metas tipo bolsillo usan la cuenta asociada a la meta."
      );
    }

    if (goal.type === GOAL_TYPES.SEPARATE_ACCOUNT) {
      if (mode === "contribution") {
        destinationAccountId = goal.accountId;
      } else {
        destinationAccountId = goal.accountId;
      }
    }

    const transaction = baseTransaction(input, {
      type:
        mode === "contribution"
          ? TRANSACTION_TYPES.GOAL_CONTRIBUTION
          : TRANSACTION_TYPES.GOAL_RELEASE,
      accountId,
      destinationAccountId,
      amount: {
        amount: input.amount,
        currency: account.currency,
      },
      destinationAmount: null,
      debtId: null,
      goalId: goal.id,
    });

    if (goal.type === GOAL_TYPES.SEPARATE_ACCOUNT && mode === "release") {
      transaction.accountId = account.id;
      transaction.destinationAccountId = goal.accountId;
    }

    this.repository.inTransaction(() => {
      this.repository.createTransaction(userId, transaction);
      this.recalculateUserState(userId);
    });
  }

  private async updateGoalStatus(goalId: string, status: GoalStatus) {
    const userId = this.getCurrentUserId();
    const goal = this.ensureGoal(userId, goalId);
    this.repository.updateGoal(userId, {
      ...goal,
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  private recalculateUserState(userId: string) {
    const accounts = this.repository.listAccounts(userId);
    const transactions = this.repository.listTransactions(userId);
    const goals = this.repository.listGoals(userId);
    const debts = this.repository.listDebts(userId);
    const debtPayments = debts.flatMap((debt) =>
      this.repository.listDebtPayments(userId, debt.id)
    );

    const state = recalculateState(
      accounts,
      transactions,
      goals,
      debts,
      debtPayments
    );
    this.repository.replaceAccountBalances(userId, state.balances);
    this.repository.replaceGoalAmounts(userId, state.goals);

    for (const debt of state.debts) {
      this.repository.updateDebt(userId, {
        ...this.ensureDebt(userId, debt.id),
        pendingAmount: debt.pendingAmount,
        status: debt.status,
        installmentsPaid: debt.installmentsPaid,
        updatedAt: debt.updatedAt,
      });
    }
  }

  private async getDashboardSummary(
    filters: ReportFiltersInput
  ): Promise<DashboardSummaryDto> {
    const userId = this.getCurrentUserId();
    const accounts = this.repository.listAccounts(userId);
    const goals = this.repository.listGoals(userId);
    const debts = this.repository.listDebts(userId);
    const transactions = await this.listTransactions({
      accountId: filters.accountId,
      categoryId: null,
      type: "all",
      currency: filters.currency,
      from: filters.from,
      to: filters.to,
      search: "",
    });
    const monthFrom = filters.from ?? startOfMonthIso();
    const monthTransactions = transactions.filter(
      (transaction) => transaction.date >= monthFrom
    );
    const selectedAccounts = filterAccounts(
      accounts,
      filters.accountId,
      filters.currency
    );
    const selectedGoals = goals.filter((goal) => {
      if (
        filters.currency !== "all" &&
        goal.targetAmount.currency !== filters.currency
      ) {
        return false;
      }
      return true;
    });

    const goalReservedByCurrency = aggregateByCurrency(
      selectedGoals.map((goal) => goal.currentAmount)
    );

    return {
      freeBalanceByCurrency: subtractAggregates(
        aggregateByCurrency(selectedAccounts.map((account) => account.balance)),
        goalReservedByCurrency
      ),
      monthBalanceByCurrency: aggregateByCurrency(
        monthTransactions
          .filter(
            (transaction) =>
              transaction.type === TRANSACTION_TYPES.INCOME ||
              transaction.type === TRANSACTION_TYPES.EXPENSE
          )
          .map((transaction) => ({
            amount:
              transaction.type === TRANSACTION_TYPES.INCOME
                ? transaction.amount.amount
                : -transaction.amount.amount,
            currency: transaction.amount.currency,
          }))
      ),
      monthExpensesByCurrency: aggregateByCurrency(
        monthTransactions
          .filter(
            (transaction) => transaction.type === TRANSACTION_TYPES.EXPENSE
          )
          .map((transaction) => transaction.amount)
      ),
      pendingDebtsByCurrency: aggregateByCurrency(
        debts
          .filter((debt) => debt.direction === DEBT_DIRECTIONS.PAYABLE)
          .map((debt) => debt.pendingAmount)
      ),
      pendingReceivablesByCurrency: aggregateByCurrency(
        debts
          .filter((debt) => debt.direction === DEBT_DIRECTIONS.RECEIVABLE)
          .map((debt) => debt.pendingAmount)
      ),
      reservedGoalsByCurrency: goalReservedByCurrency,
      recentTransactions: transactions.slice(0, 10),
    };
  }

  private async getReports(filters: ReportFiltersInput): Promise<ReportsDto> {
    const userId = this.getCurrentUserId();
    const categories = this.repository.listCategories(userId);
    const goals = this.repository.listGoals(userId);
    const debts = this.repository.listDebts(userId);
    const transactions = await this.listTransactions({
      accountId: filters.accountId,
      categoryId: null,
      type: "all",
      currency: filters.currency,
      from: filters.from,
      to: filters.to,
      search: "",
    });

    const expensesByCategory = Object.values(
      transactions
        .filter((transaction) => transaction.type === TRANSACTION_TYPES.EXPENSE)
        .reduce<
          Record<
            string,
            {
              categoryId: string;
              categoryName: string;
              total: number;
              currency: CurrencyCode;
            }
          >
        >((accumulator, transaction) => {
          const category = categories.find(
            (item) => item.id === transaction.categoryId
          );
          if (!category) {
            return accumulator;
          }
          const key = `${category.id}:${transaction.amount.currency}`;
          accumulator[key] ??= {
            categoryId: category.id,
            categoryName: category.name,
            total: 0,
            currency: transaction.amount.currency,
          };
          accumulator[key].total += transaction.amount.amount;
          return accumulator;
        }, {})
    ).map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      total: {
        amount: item.total,
        currency: item.currency,
      },
    }));

    const groupedByMonth = new Map<string, MonthlyIncomeExpenseReportItemDto>();
    for (const transaction of transactions) {
      if (
        transaction.type !== TRANSACTION_TYPES.INCOME &&
        transaction.type !== TRANSACTION_TYPES.EXPENSE
      ) {
        continue;
      }

      const month = transaction.date.slice(0, 7);
      const report = groupedByMonth.get(month) ?? {
        month,
        income: [],
        expense: [],
      };

      if (transaction.type === TRANSACTION_TYPES.INCOME) {
        report.income = aggregateByCurrency([
          ...report.income,
          transaction.amount,
        ]);
      }
      if (transaction.type === TRANSACTION_TYPES.EXPENSE) {
        report.expense = aggregateByCurrency([
          ...report.expense,
          transaction.amount,
        ]);
      }

      groupedByMonth.set(month, report);
    }

    const evolutionAccountId = filters.accountId;
    const accountEvolution = evolutionAccountId
      ? buildAccountEvolution(
          transactions.filter(
            (transaction) =>
              transaction.accountId === evolutionAccountId ||
              transaction.destinationAccountId === evolutionAccountId
          ),
          this.ensureAccount(userId, evolutionAccountId)
        )
      : [];

    return {
      expensesByCategory,
      incomeVsExpenseByMonth: Array.from(groupedByMonth.values()).sort(
        (left, right) => left.month.localeCompare(right.month)
      ),
      accountBalanceEvolution: accountEvolution,
      goalProgress: goals.map((goal) => ({
        goalId: goal.id,
        goalName: goal.name,
        currentAmount: goal.currentAmount,
        targetAmount: goal.targetAmount,
        progressPercentage: goal.progressPercentage,
      })),
      debtStatus: debts.map((debt) => ({
        debtId: debt.id,
        personOrEntity: debt.personOrEntity,
        direction: debt.direction,
        pendingAmount: debt.pendingAmount,
        dueDate: debt.dueDate,
        isPartiallyPaid: debt.isPartiallyPaid,
        isOverdue: debt.isOverdue,
      })),
    };
  }

  private async exportJson() {
    const userId = this.getCurrentUserId();
    const profile = this.repository.getUserProfile(userId);
    const settings = this.repository.getUserSettings(userId);
    if (!settings) {
      throw new Error("Debes completar el onboarding antes de exportar.");
    }

    const packageData: ExportPackageDto = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
      },
      settings,
      accounts: this.repository.listAccounts(userId),
      categories: this.repository.listCategories(userId),
      transactions: this.repository.listTransactions(userId),
      debts: this.repository.listDebts(userId),
      debtPayments: this.repository
        .listDebts(userId)
        .flatMap((debt) => this.repository.listDebtPayments(userId, debt.id)),
      savingsGoals: this.repository.listGoals(userId),
    };

    const result = await dialog.showSaveDialog({
      title: "Exportar datos del usuario",
      defaultPath: `finlog-${profile.name.toLowerCase().replace(/\s+/g, "-")}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (result.canceled || !result.filePath) {
      throw new Error("La exportacion fue cancelada.");
    }

    fs.writeFileSync(
      result.filePath,
      JSON.stringify(packageData, null, 2),
      "utf8"
    );
    return result.filePath;
  }

  private async importJson() {
    const userId = this.getCurrentUserId();
    const result = await dialog.showOpenDialog({
      title: "Importar datos del usuario",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      throw new Error("La importacion fue cancelada.");
    }

    const filePath = result.filePaths[0];
    const fileContent = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileContent) as ExportPackageDto;

    this.repository.inTransaction(() => {
      this.repository.deleteFinancialData(userId);
      this.repository.upsertUserSettings(userId, data.settings);

      for (const account of data.accounts) {
        this.repository.createAccount(userId, account);
      }
      for (const category of data.categories) {
        this.repository.createCategory(userId, {
          ...category,
          subcategories: [],
        });
        for (const subcategory of category.subcategories) {
          this.repository.createSubcategory(userId, subcategory);
        }
      }
      for (const debt of data.debts) {
        this.repository.createDebt(userId, debt);
      }
      for (const goal of data.savingsGoals) {
        this.repository.createGoal(userId, goal);
      }
      for (const transaction of data.transactions) {
        this.repository.createTransaction(userId, transaction);
      }
      for (const payment of data.debtPayments) {
        this.repository.createDebtPayment(userId, payment);
      }

      this.recalculateUserState(userId);
    });
  }

  private async createBackup() {
    const result = await dialog.showSaveDialog({
      title: "Crear backup SQLite",
      defaultPath: "finlog-backup.sqlite",
      filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }],
    });

    if (result.canceled || !result.filePath) {
      throw new Error("El backup fue cancelado.");
    }

    const sourcePath = databaseManager.getDatabasePath();
    fs.copyFileSync(sourcePath, result.filePath);
    return result.filePath;
  }

  private async restoreBackup() {
    const result = await dialog.showOpenDialog({
      title: "Restaurar backup SQLite",
      properties: ["openFile"],
      filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      throw new Error("La restauracion fue cancelada.");
    }

    const sourceFile = result.filePaths[0];
    const targetFile = databaseManager.getDatabasePath();
    databaseManager.close();
    fs.copyFileSync(sourceFile, targetFile);
    databaseManager.reopen();
  }

  private ensureAccount(userId: string, accountId: string) {
    const account = this.repository.findAccount(userId, accountId);
    if (!account) {
      throw new Error("Cuenta no encontrada.");
    }
    return account;
  }

  private ensureActiveAccount(userId: string, accountId: string) {
    const account = this.ensureAccount(userId, accountId);
    if (account.status !== ACCOUNT_STATUSES.ACTIVE) {
      throw new Error(
        "La cuenta esta archivada y no puede recibir movimientos."
      );
    }
    return account;
  }

  private ensureCategory(
    userId: string,
    categoryId: string,
    kind: CategoryDto["kind"]
  ) {
    const category = this.repository
      .listCategories(userId)
      .find((item) => item.id === categoryId && item.kind === kind);

    if (!category) {
      throw new Error("Categoria no valida para este movimiento.");
    }
    if (category.status !== CATEGORY_STATUSES.ACTIVE) {
      throw new Error("La categoria esta inactiva.");
    }
    return category;
  }

  private ensureDebt(userId: string, debtId: string) {
    const debt = this.repository.findDebt(userId, debtId);
    if (!debt) {
      throw new Error("Deuda no encontrada.");
    }
    return debt;
  }

  private ensureGoal(userId: string, goalId: string) {
    const goal = this.repository.findGoal(userId, goalId);
    if (!goal) {
      throw new Error("Meta no encontrada.");
    }
    return goal;
  }
}

function validateEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (
    !normalized.includes("@") ||
    normalized.startsWith("@") ||
    normalized.endsWith("@")
  ) {
    throw new Error("Debes ingresar un correo valido.");
  }
}

function validatePassword(password: string) {
  if (password.length < 8) {
    throw new Error("La contrasena debe tener al menos 8 caracteres.");
  }
}

function validatePositiveAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("El monto debe ser un entero positivo en unidad minima.");
  }
}

function validateAccountInput(input: CreateAccountInput) {
  if (!input.name.trim()) {
    throw new Error("La cuenta requiere un nombre.");
  }

  if (
    input.type === ACCOUNT_TYPES.CREDIT_CARD &&
    (input.creditCardClosingDay !== null || input.creditCardDueDay !== null)
  ) {
    return;
  }

  if (input.type !== ACCOUNT_TYPES.CREDIT_CARD) {
    return;
  }
}

function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function baseTransaction(
  input: { date: string; description: string; note: string },
  partial: Pick<
    TransactionDto,
    | "type"
    | "accountId"
    | "destinationAccountId"
    | "amount"
    | "destinationAmount"
    | "debtId"
    | "goalId"
  >
): TransactionDto {
  return {
    id: randomUUID(),
    type: partial.type,
    accountId: partial.accountId,
    destinationAccountId: partial.destinationAccountId,
    amount: partial.amount,
    destinationAmount: partial.destinationAmount,
    categoryId: null,
    subcategoryId: null,
    debtId: partial.debtId ?? null,
    goalId: partial.goalId ?? null,
    date: input.date,
    description: trimOrNull(input.description),
    note: trimOrNull(input.note),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function aggregateByCurrency(
  items: Array<{ amount: number; currency: CurrencyCode }>
) {
  const totals = new Map<CurrencyCode, number>();

  for (const item of items) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  }

  return Array.from(totals.entries()).map(([currency, amount]) => ({
    currency,
    amount,
  }));
}

function subtractAggregates(
  left: Array<{ amount: number; currency: CurrencyCode }>,
  right: Array<{ amount: number; currency: CurrencyCode }>
) {
  const totals = new Map<CurrencyCode, number>();

  for (const item of left) {
    totals.set(item.currency, item.amount);
  }
  for (const item of right) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) - item.amount);
  }

  return Array.from(totals.entries()).map(([currency, amount]) => ({
    currency,
    amount,
  }));
}

function filterAccounts(
  accounts: AccountDto[],
  accountId: string | null,
  currency: CurrencyCode | "all"
) {
  return accounts.filter((account) => {
    if (accountId && account.id !== accountId) {
      return false;
    }
    if (currency !== "all" && account.currency !== currency) {
      return false;
    }
    return true;
  });
}

function buildAccountEvolution(
  transactions: TransactionDto[],
  account: AccountDto
) {
  let runningBalance = 0;
  const sorted = [...transactions].sort((left, right) =>
    left.date.localeCompare(right.date)
  );

  return sorted.map((transaction) => {
    switch (transaction.type) {
      case TRANSACTION_TYPES.INCOME:
      case TRANSACTION_TYPES.OPENING_BALANCE:
      case TRANSACTION_TYPES.DEBT_COLLECTION:
        if (transaction.accountId === account.id) {
          runningBalance += transaction.amount.amount;
        }
        break;
      case TRANSACTION_TYPES.EXPENSE:
      case TRANSACTION_TYPES.DEBT_PAYMENT:
        if (transaction.accountId === account.id) {
          runningBalance -= transaction.amount.amount;
        }
        break;
      case TRANSACTION_TYPES.BALANCE_ADJUSTMENT:
        if (transaction.accountId === account.id) {
          runningBalance += transaction.amount.amount;
        }
        break;
      case TRANSACTION_TYPES.TRANSFER:
        if (transaction.accountId === account.id) {
          runningBalance -= transaction.amount.amount;
        }
        if (transaction.destinationAccountId === account.id) {
          runningBalance += transaction.amount.amount;
        }
        break;
      case TRANSACTION_TYPES.CURRENCY_CONVERSION:
        if (transaction.accountId === account.id) {
          runningBalance -= transaction.amount.amount;
        }
        if (
          transaction.destinationAccountId === account.id &&
          transaction.destinationAmount
        ) {
          runningBalance += transaction.destinationAmount.amount;
        }
        break;
      case TRANSACTION_TYPES.GOAL_CONTRIBUTION:
        if (transaction.accountId === account.id) {
          runningBalance -= transaction.amount.amount;
        }
        if (transaction.destinationAccountId === account.id) {
          runningBalance += transaction.amount.amount;
        }
        break;
      case TRANSACTION_TYPES.GOAL_RELEASE:
        if (transaction.accountId === account.id) {
          runningBalance += transaction.amount.amount;
        }
        if (transaction.destinationAccountId === account.id) {
          runningBalance -= transaction.amount.amount;
        }
        break;
      default:
        break;
    }

    return {
      date: transaction.date,
      balance: {
        amount: runningBalance,
        currency: account.currency,
      },
    };
  });
}
