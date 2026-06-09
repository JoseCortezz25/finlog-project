export const CURRENCY_CODES = {
  COP: "COP",
  USD: "USD",
  EUR: "EUR",
} as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[keyof typeof CURRENCY_CODES];

export const ACCOUNT_TYPES = {
  BANK: "bank",
  CASH: "cash",
  DIGITAL_WALLET: "digital_wallet",
  CREDIT_CARD: "credit_card",
  SAVINGS_POCKET: "savings_pocket",
  PIGGY_BANK: "piggy_bank",
  DIGITAL_USD: "digital_usd",
} as const;

export type AccountType = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];

export const ACCOUNT_STATUSES = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type AccountStatus =
  (typeof ACCOUNT_STATUSES)[keyof typeof ACCOUNT_STATUSES];

export const TRANSACTION_TYPES = {
  INCOME: "income",
  EXPENSE: "expense",
  TRANSFER: "transfer",
  CURRENCY_CONVERSION: "currency_conversion",
  OPENING_BALANCE: "opening_balance",
  BALANCE_ADJUSTMENT: "balance_adjustment",
  DEBT_PAYMENT: "debt_payment",
  DEBT_COLLECTION: "debt_collection",
  GOAL_CONTRIBUTION: "goal_contribution",
  GOAL_RELEASE: "goal_release",
} as const;

export type TransactionType =
  (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

export const CATEGORY_KINDS = {
  INCOME: "income",
  EXPENSE: "expense",
} as const;

export type CategoryKind = (typeof CATEGORY_KINDS)[keyof typeof CATEGORY_KINDS];

export const CATEGORY_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type CategoryStatus =
  (typeof CATEGORY_STATUSES)[keyof typeof CATEGORY_STATUSES];

export const DEBT_DIRECTIONS = {
  PAYABLE: "payable",
  RECEIVABLE: "receivable",
} as const;

export type DebtDirection =
  (typeof DEBT_DIRECTIONS)[keyof typeof DEBT_DIRECTIONS];

export const DEBT_STATUSES = {
  ACTIVE: "active",
  PAID: "paid",
  CANCELLED: "cancelled",
  ARCHIVED: "archived",
} as const;

export type DebtStatus = (typeof DEBT_STATUSES)[keyof typeof DEBT_STATUSES];

export const GOAL_TYPES = {
  POCKET: "pocket",
  SEPARATE_ACCOUNT: "separate_account",
} as const;

export type GoalType = (typeof GOAL_TYPES)[keyof typeof GOAL_TYPES];

export const GOAL_STATUSES = {
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  ARCHIVED: "archived",
} as const;

export type GoalStatus = (typeof GOAL_STATUSES)[keyof typeof GOAL_STATUSES];

export interface MoneyDto {
  amount: number;
  currency: CurrencyCode;
}

export interface SessionDto {
  userId: string;
  name: string;
  email: string;
  needsOnboarding: boolean;
  primaryCurrency: CurrencyCode | null;
}

export interface UserProfileDto {
  id: string;
  name: string;
  email: string;
  primaryCurrency: CurrencyCode | null;
}

export interface UserSettingsDto {
  primaryCurrency: CurrencyCode;
  language: "es";
}

export interface AccountDto {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  balance: MoneyDto;
  status: AccountStatus;
  creditCardClosingDay: number | null;
  creditCardDueDay: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDto {
  id: string;
  kind: CategoryKind;
  name: string;
  status: CategoryStatus;
  subcategories: SubcategoryDto[];
}

export interface SubcategoryDto {
  id: string;
  categoryId: string;
  name: string;
  status: CategoryStatus;
}

export interface TransactionDto {
  id: string;
  type: TransactionType;
  accountId: string;
  destinationAccountId: string | null;
  amount: MoneyDto;
  destinationAmount: MoneyDto | null;
  categoryId: string | null;
  subcategoryId: string | null;
  debtId: string | null;
  goalId: string | null;
  date: string;
  description: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DebtDto {
  id: string;
  direction: DebtDirection;
  personOrEntity: string;
  totalAmount: MoneyDto;
  pendingAmount: MoneyDto;
  status: DebtStatus;
  dueDate: string | null;
  installmentsTotal: number | null;
  installmentsPaid: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  isPartiallyPaid: boolean;
  isOverdue: boolean;
}

export interface DebtPaymentDto {
  id: string;
  debtId: string;
  transactionId: string;
  accountId: string;
  amount: MoneyDto;
  date: string;
  note: string | null;
}

export interface SavingsGoalDto {
  id: string;
  name: string;
  type: GoalType;
  accountId: string;
  targetAmount: MoneyDto;
  currentAmount: MoneyDto;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  progressPercentage: number;
}

export interface DashboardSummaryDto {
  freeBalanceByCurrency: MoneyDto[];
  monthBalanceByCurrency: MoneyDto[];
  monthExpensesByCurrency: MoneyDto[];
  pendingDebtsByCurrency: MoneyDto[];
  pendingReceivablesByCurrency: MoneyDto[];
  reservedGoalsByCurrency: MoneyDto[];
  recentTransactions: TransactionDto[];
}

export interface ExpensesByCategoryReportItemDto {
  categoryId: string;
  categoryName: string;
  total: MoneyDto;
}

export interface MonthlyIncomeExpenseReportItemDto {
  month: string;
  income: MoneyDto[];
  expense: MoneyDto[];
}

export interface AccountBalanceEvolutionPointDto {
  date: string;
  balance: MoneyDto;
}

export interface GoalProgressReportItemDto {
  goalId: string;
  goalName: string;
  currentAmount: MoneyDto;
  targetAmount: MoneyDto;
  progressPercentage: number;
}

export interface DebtStatusReportItemDto {
  debtId: string;
  personOrEntity: string;
  direction: DebtDirection;
  pendingAmount: MoneyDto;
  dueDate: string | null;
  isPartiallyPaid: boolean;
  isOverdue: boolean;
}

export interface ReportsDto {
  expensesByCategory: ExpensesByCategoryReportItemDto[];
  incomeVsExpenseByMonth: MonthlyIncomeExpenseReportItemDto[];
  accountBalanceEvolution: AccountBalanceEvolutionPointDto[];
  goalProgress: GoalProgressReportItemDto[];
  debtStatus: DebtStatusReportItemDto[];
}

export interface ExportPackageDto {
  version: string;
  exportedAt: string;
  user: Pick<UserProfileDto, "id" | "name" | "email">;
  settings: UserSettingsDto;
  accounts: AccountDto[];
  categories: CategoryDto[];
  transactions: TransactionDto[];
  debts: DebtDto[];
  debtPayments: DebtPaymentDto[];
  savingsGoals: SavingsGoalDto[];
}

export interface AuthCredentialsInput {
  email: string;
  password: string;
}

export interface RegisterUserInput extends AuthCredentialsInput {
  name: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface InitializeOnboardingInput {
  settings: UserSettingsDto;
  accounts: CreateAccountInput[];
  shouldSeedCategories: boolean;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  openingBalanceAmount: number;
  creditCardClosingDay: number | null;
  creditCardDueDay: number | null;
}

export interface UpdateAccountInput {
  accountId: string;
  name: string;
  creditCardClosingDay: number | null;
  creditCardDueDay: number | null;
}

export interface CreateCategoryInput {
  kind: CategoryKind;
  name: string;
}

export interface UpdateCategoryInput {
  categoryId: string;
  name: string;
}

export interface CreateSubcategoryInput {
  categoryId: string;
  name: string;
}

export interface MergeCategoryInput {
  sourceCategoryId: string;
  targetCategoryId: string;
}

export interface BaseMovementInput {
  date: string;
  description: string;
  note: string;
}

export interface CreateIncomeExpenseInput extends BaseMovementInput {
  accountId: string;
  categoryId: string;
  subcategoryId: string | null;
  amount: number;
}

export interface CreateTransferInput extends BaseMovementInput {
  accountId: string;
  destinationAccountId: string;
  amount: number;
}

export interface CreateConversionInput extends BaseMovementInput {
  accountId: string;
  destinationAccountId: string;
  amount: number;
  destinationAmount: number;
}

export interface CreateAdjustmentInput extends BaseMovementInput {
  accountId: string;
  amount: number;
}

export interface CreateDebtMovementInput extends BaseMovementInput {
  debtId: string;
  accountId: string;
  amount: number;
}

export interface CreateGoalMovementInput extends BaseMovementInput {
  goalId: string;
  accountId: string;
  amount: number;
}

export interface UpdateTransactionInput {
  transactionId: string;
  date: string;
  description: string;
  note: string;
}

export interface TransactionFiltersInput {
  accountId: string | null;
  categoryId: string | null;
  type: TransactionType | "all";
  currency: CurrencyCode | "all";
  from: string | null;
  to: string | null;
  search: string;
}

export interface CreateDebtInput {
  direction: DebtDirection;
  personOrEntity: string;
  amount: number;
  currency: CurrencyCode;
  dueDate: string | null;
  installmentsTotal: number | null;
  note: string;
}

export interface CreateGoalInput {
  name: string;
  type: GoalType;
  accountId: string;
  targetAmount: number;
}

export interface DateRangeInput {
  from: string | null;
  to: string | null;
}

export interface ReportFiltersInput extends DateRangeInput {
  accountId: string | null;
  currency: CurrencyCode | "all";
}

export interface FinlogApi {
  auth: {
    getSession: () => Promise<SessionDto | null>;
    register: (input: RegisterUserInput) => Promise<SessionDto>;
    login: (input: AuthCredentialsInput) => Promise<SessionDto>;
    logout: () => Promise<void>;
    changePassword: (input: ChangePasswordInput) => Promise<void>;
    getProfile: () => Promise<UserProfileDto>;
  };
  onboarding: {
    complete: (input: InitializeOnboardingInput) => Promise<SessionDto>;
  };
  accounts: {
    list: () => Promise<AccountDto[]>;
    create: (input: CreateAccountInput) => Promise<AccountDto>;
    update: (input: UpdateAccountInput) => Promise<AccountDto>;
    archive: (accountId: string) => Promise<void>;
    remove: (accountId: string) => Promise<void>;
  };
  categories: {
    list: () => Promise<CategoryDto[]>;
    create: (input: CreateCategoryInput) => Promise<CategoryDto>;
    update: (input: UpdateCategoryInput) => Promise<CategoryDto>;
    deactivate: (categoryId: string) => Promise<void>;
    merge: (input: MergeCategoryInput) => Promise<void>;
    createSubcategory: (
      input: CreateSubcategoryInput
    ) => Promise<SubcategoryDto>;
  };
  transactions: {
    list: (filters: TransactionFiltersInput) => Promise<TransactionDto[]>;
    createIncome: (input: CreateIncomeExpenseInput) => Promise<TransactionDto>;
    createExpense: (input: CreateIncomeExpenseInput) => Promise<TransactionDto>;
    createTransfer: (input: CreateTransferInput) => Promise<TransactionDto>;
    createConversion: (input: CreateConversionInput) => Promise<TransactionDto>;
    createAdjustment: (input: CreateAdjustmentInput) => Promise<TransactionDto>;
    update: (input: UpdateTransactionInput) => Promise<TransactionDto>;
    remove: (transactionId: string) => Promise<void>;
  };
  debts: {
    list: () => Promise<DebtDto[]>;
    create: (input: CreateDebtInput) => Promise<DebtDto>;
    registerPayment: (input: CreateDebtMovementInput) => Promise<void>;
    registerCollection: (input: CreateDebtMovementInput) => Promise<void>;
    cancel: (debtId: string) => Promise<void>;
    archive: (debtId: string) => Promise<void>;
    listPayments: (debtId: string) => Promise<DebtPaymentDto[]>;
  };
  goals: {
    list: () => Promise<SavingsGoalDto[]>;
    create: (input: CreateGoalInput) => Promise<SavingsGoalDto>;
    contribute: (input: CreateGoalMovementInput) => Promise<void>;
    release: (input: CreateGoalMovementInput) => Promise<void>;
    cancel: (goalId: string) => Promise<void>;
    archive: (goalId: string) => Promise<void>;
  };
  dashboard: {
    summary: (filters: ReportFiltersInput) => Promise<DashboardSummaryDto>;
  };
  reports: {
    get: (filters: ReportFiltersInput) => Promise<ReportsDto>;
  };
  settings: {
    updateProfile: (input: {
      name: string;
      email: string;
    }) => Promise<UserProfileDto>;
    updatePrimaryCurrency: (currency: CurrencyCode) => Promise<UserProfileDto>;
    exportJson: () => Promise<string>;
    importJson: () => Promise<void>;
    createBackup: () => Promise<string>;
    restoreBackup: () => Promise<void>;
  };
}
