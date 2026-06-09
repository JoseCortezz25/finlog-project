import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarDays,
  ChartColumnIncreasing,
  CircleDollarSign,
  CreditCard,
  FileText,
  FolderTree,
  Goal,
  Landmark,
  MessageSquareText,
  LogOut,
  Plus,
  Repeat2,
  Settings,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useState,
} from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/tailwind";
import {
  ACCOUNT_TYPES,
  CATEGORY_KINDS,
  CURRENCY_CODES,
  DEBT_DIRECTIONS,
  GOAL_TYPES,
  TRANSACTION_TYPES,
  type AccountDto,
  type CategoryDto,
  type CurrencyCode,
  type DebtDto,
  type ReportFiltersInput,
  type SavingsGoalDto,
  type SessionDto,
  type TransactionDto,
} from "@/shared/contracts/finlog";
import { formatMoneyValue, todayIso } from "@/shared/domain/finance";
import { finlogApi } from "@/renderer/features/finlog/api";
import { finlogMessages } from "@/renderer/features/finlog/messages";

type ScreenKey =
  | "dashboard"
  | "movements"
  | "accounts"
  | "debts"
  | "goals"
  | "categories"
  | "reports"
  | "settings";

const navigationItems: Array<{
  key: ScreenKey;
  label: string;
  icon: typeof Landmark;
}> = [
  {
    key: "dashboard",
    label: finlogMessages.navigation.dashboard,
    icon: ChartColumnIncreasing,
  },
  {
    key: "movements",
    label: finlogMessages.navigation.movements,
    icon: ArrowLeftRight,
  },
  {
    key: "accounts",
    label: finlogMessages.navigation.accounts,
    icon: Landmark,
  },
  {
    key: "debts",
    label: finlogMessages.navigation.debts,
    icon: BadgeDollarSign,
  },
  { key: "goals", label: finlogMessages.navigation.goals, icon: Goal },
  {
    key: "categories",
    label: finlogMessages.navigation.categories,
    icon: FolderTree,
  },
  {
    key: "reports",
    label: finlogMessages.navigation.reports,
    icon: CircleDollarSign,
  },
  {
    key: "settings",
    label: finlogMessages.navigation.settings,
    icon: Settings,
  },
];

const loginSchema = z.object({
  email: z.string().email("Correo invalido"),
  password: z.string().min(8, "Minimo 8 caracteres"),
});

const registerSchema = loginSchema
  .extend({
    name: z.string().min(2, "Nombre requerido"),
    confirmPassword: z.string().min(8, "Confirma la contrasena"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contrasenas no coinciden",
  });

const requiredSelectSchema = (error: string) =>
  z.string().trim().min(1, { error });

const optionalShortTextSchema = (maxLength: number, fieldName: string) =>
  z
    .string()
    .trim()
    .max(maxLength, {
      error: `${fieldName} no puede superar ${maxLength} caracteres`,
    })
    .optional();

const amountInputSchema = z
  .string()
  .trim()
  .min(1, { error: "Ingresa un monto" })
  .regex(/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/, {
    error: "Usa un monto positivo. Ejemplo: 125.000 o 125.000,50",
  })
  .refine((value) => parseFormattedAmountInput(value) > 0, {
    error: "El monto debe ser mayor a 0",
  });

const signedAmountInputSchema = z
  .string()
  .trim()
  .min(1, { error: "Ingresa un monto con signo" })
  .regex(/^-?(\d{1,3}(\.\d{3})*|\d+)(,\d{1,2})?$/, {
    error: "Usa un monto válido, por ejemplo -5.000 o 12.000,50",
  })
  .refine((value) => parseFormattedAmountInput(value) !== 0, {
    error: "El ajuste no puede ser 0",
  });

const isoDateInputSchema = z
  .string()
  .trim()
  .min(1, { error: "Selecciona una fecha" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    error: "Usa una fecha válida en formato YYYY-MM-DD",
  })
  .refine(isValidIsoDateInput, {
    error: "La fecha no existe en el calendario",
  });

const onboardingAccountSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  type: z.enum([
    ACCOUNT_TYPES.BANK,
    ACCOUNT_TYPES.CASH,
    ACCOUNT_TYPES.DIGITAL_WALLET,
    ACCOUNT_TYPES.CREDIT_CARD,
    ACCOUNT_TYPES.SAVINGS_POCKET,
    ACCOUNT_TYPES.PIGGY_BANK,
    ACCOUNT_TYPES.DIGITAL_USD,
  ]),
  currency: z.enum([
    CURRENCY_CODES.COP,
    CURRENCY_CODES.USD,
    CURRENCY_CODES.EUR,
  ]),
  openingBalance: z.string().min(1, "Saldo inicial requerido"),
  creditCardClosingDay: z.string().optional(),
  creditCardDueDay: z.string().optional(),
});

const onboardingSchema = z.object({
  primaryCurrency: z.enum([
    CURRENCY_CODES.COP,
    CURRENCY_CODES.USD,
    CURRENCY_CODES.EUR,
  ]),
  shouldSeedCategories: z.boolean(),
  accounts: z
    .array(onboardingAccountSchema)
    .min(1, "Debes crear al menos una cuenta"),
});

const accountSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  type: z.enum([
    ACCOUNT_TYPES.BANK,
    ACCOUNT_TYPES.CASH,
    ACCOUNT_TYPES.DIGITAL_WALLET,
    ACCOUNT_TYPES.CREDIT_CARD,
    ACCOUNT_TYPES.SAVINGS_POCKET,
    ACCOUNT_TYPES.PIGGY_BANK,
    ACCOUNT_TYPES.DIGITAL_USD,
  ]),
  currency: z.enum([
    CURRENCY_CODES.COP,
    CURRENCY_CODES.USD,
    CURRENCY_CODES.EUR,
  ]),
  openingBalance: z.string().min(1, "Saldo inicial requerido"),
  creditCardClosingDay: z.string().optional(),
  creditCardDueDay: z.string().optional(),
});

const categorySchema = z.object({
  kind: z.enum([CATEGORY_KINDS.INCOME, CATEGORY_KINDS.EXPENSE]),
  name: z.string().min(1, "Nombre requerido"),
});

const subcategorySchema = z.object({
  categoryId: z.string().min(1, "Selecciona una categoria"),
  name: z.string().min(1, "Nombre requerido"),
});

const movementSchema = z.object({
  accountId: requiredSelectSchema("Selecciona una cuenta"),
  categoryId: requiredSelectSchema("Selecciona una categoría"),
  subcategoryId: z.string().trim().optional(),
  amount: amountInputSchema,
  date: isoDateInputSchema,
  description: optionalShortTextSchema(120, "La descripción"),
  note: optionalShortTextSchema(500, "La nota"),
  kind: z.enum([TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.EXPENSE]),
});

const transferSchema = z.object({
  accountId: requiredSelectSchema("Selecciona la cuenta origen"),
  destinationAccountId: requiredSelectSchema("Selecciona la cuenta destino"),
  amount: amountInputSchema,
  date: isoDateInputSchema,
  description: optionalShortTextSchema(120, "La descripción"),
  note: optionalShortTextSchema(500, "La nota"),
});

const conversionSchema = transferSchema.extend({
  destinationAmount: amountInputSchema,
});

const adjustmentSchema = z.object({
  accountId: requiredSelectSchema("Selecciona una cuenta"),
  amount: signedAmountInputSchema,
  date: isoDateInputSchema,
  description: optionalShortTextSchema(120, "La descripción"),
  note: z
    .string()
    .trim()
    .min(10, { error: "Explica el motivo con al menos 10 caracteres" })
    .max(500, { error: "El motivo no puede superar 500 caracteres" }),
});

const debtSchema = z.object({
  direction: z.enum([DEBT_DIRECTIONS.PAYABLE, DEBT_DIRECTIONS.RECEIVABLE]),
  personOrEntity: z.string().min(1, "Persona o entidad requerida"),
  amount: z.string().min(1, "Monto requerido"),
  currency: z.enum([
    CURRENCY_CODES.COP,
    CURRENCY_CODES.USD,
    CURRENCY_CODES.EUR,
  ]),
  dueDate: z.string().optional(),
  installmentsTotal: z.string().optional(),
  note: z.string().optional(),
});

const goalSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  type: z.enum([GOAL_TYPES.POCKET, GOAL_TYPES.SEPARATE_ACCOUNT]),
  accountId: z.string().min(1, "Cuenta requerida"),
  targetAmount: z.string().min(1, "Objetivo requerido"),
});

const profileSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Correo invalido"),
  primaryCurrency: z.enum([
    CURRENCY_CODES.COP,
    CURRENCY_CODES.USD,
    CURRENCY_CODES.EUR,
  ]),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, "Requerida"),
    newPassword: z.string().min(8, "Minimo 8 caracteres"),
    confirmNewPassword: z.string().min(8, "Confirma la contrasena"),
  })
  .refine((value) => value.newPassword === value.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Las contrasenas no coinciden",
  });

export function FinlogApp() {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isLoading) {
    return (
      <FullscreenMessage
        title="Cargando Finlog"
        description="Preparando tu espacio local."
      />
    );
  }

  if (!sessionQuery.data) {
    return <AuthScreen />;
  }

  if (sessionQuery.data.needsOnboarding) {
    return <OnboardingScreen session={sessionQuery.data} />;
  }

  return <FinlogShell session={sessionQuery.data} />;
}

function useSessionQuery() {
  return useQuery({
    queryKey: ["finlog", "session"],
    queryFn: () => finlogApi.auth.getSession(),
  });
}

function useFinlogMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  successMessage: string
) {
  const queryClientInstance = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClientInstance.invalidateQueries({ queryKey: ["finlog"] });
      window.alert(successMessage);
    },
    onError: (error) => {
      window.alert(
        error instanceof Error ? error.message : "Ocurrio un error."
      );
    },
  });
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const loginMutation = useFinlogMutation(
    finlogApi.auth.login,
    "Sesion iniciada."
  );
  const registerMutation = useFinlogMutation(
    finlogApi.auth.register,
    "Usuario creado correctamente."
  );

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  return (
    <div className="finlog-shell min-h-dvh bg-background text-foreground">
      <div className="mx-auto grid min-h-dvh max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-8">
        <div className="finlog-card flex flex-col justify-between p-8 lg:p-10">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                Sin nube. Sin floats. Sin ruido.
              </p>
              <h1 className="finlog-display max-w-3xl text-5xl text-foreground lg:text-7xl">
                {finlogMessages.app.name}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground [text-wrap:pretty]">
                {finlogMessages.app.subtitle}. Controla cuentas, movimientos,
                deudas, metas y reportes desde tu computador con una interfaz
                sobria, clara y profundamente local.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <AuthFeatureCard
              title="Cuentas separadas"
              description="Cada usuario ve solo sus datos."
            />
            <AuthFeatureCard
              title="SQLite local"
              description="Toda la persistencia vive en main via IPC seguro."
            />
            <AuthFeatureCard
              title="Trazabilidad"
              description="Saldo inicial y ajustes no se disfrazan de ingresos o gastos."
            />
          </div>
        </div>

        <div className="finlog-card p-6 lg:p-8">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-medium text-foreground">Acceso seguro local</p>
            <p className="max-w-md text-sm leading-6 text-muted-foreground [text-wrap:pretty]">
              Usa un perfil por persona y mantiene cada operación trazable desde
              el primer día.
            </p>
          </div>

          <div className="mb-6 flex rounded-full border border-border/70 bg-background/70 p-1">
            <button
              className={tabButtonClass(mode === "login")}
              onClick={() => setMode("login")}
              type="button"
            >
              {finlogMessages.auth.loginTitle}
            </button>
            <button
              className={tabButtonClass(mode === "register")}
              onClick={() => setMode("register")}
              type="button"
            >
              {finlogMessages.auth.registerTitle}
            </button>
          </div>

          {mode === "login" ? (
            <form
              className="space-y-4"
              onSubmit={loginForm.handleSubmit(async (values) => {
                await loginMutation.mutateAsync(values);
              })}
            >
              <FormField
                label="Correo"
                error={loginForm.formState.errors.email?.message}
              >
                <TextInput type="email" {...loginForm.register("email")} />
              </FormField>
              <FormField
                label="Contrasena"
                error={loginForm.formState.errors.password?.message}
              >
                <TextInput
                  type="password"
                  {...loginForm.register("password")}
                />
              </FormField>
              <p className="text-sm text-muted-foreground">
                {finlogMessages.auth.passwordWarning}
              </p>
              <Button
                className="w-full"
                disabled={loginMutation.isPending}
                type="submit"
              >
                Iniciar sesion
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={registerForm.handleSubmit(async (values) => {
                await registerMutation.mutateAsync({
                  name: values.name,
                  email: values.email,
                  password: values.password,
                });
              })}
            >
              <FormField
                label="Nombre"
                error={registerForm.formState.errors.name?.message}
              >
                <TextInput {...registerForm.register("name")} />
              </FormField>
              <FormField
                label="Correo"
                error={registerForm.formState.errors.email?.message}
              >
                <TextInput type="email" {...registerForm.register("email")} />
              </FormField>
              <FormField
                label="Contrasena"
                error={registerForm.formState.errors.password?.message}
              >
                <TextInput
                  type="password"
                  {...registerForm.register("password")}
                />
              </FormField>
              <FormField
                label="Confirmar contrasena"
                error={registerForm.formState.errors.confirmPassword?.message}
              >
                <TextInput
                  type="password"
                  {...registerForm.register("confirmPassword")}
                />
              </FormField>
              <p className="text-sm text-muted-foreground">
                {finlogMessages.auth.passwordWarning}
              </p>
              <Button
                className="w-full"
                disabled={registerMutation.isPending}
                type="submit"
              >
                Crear usuario
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function OnboardingScreen({ session }: { session: SessionDto }) {
  const mutation = useFinlogMutation(
    finlogApi.onboarding.complete,
    "Onboarding completado."
  );
  const form = useForm<z.infer<typeof onboardingSchema>>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      primaryCurrency: session.primaryCurrency ?? CURRENCY_CODES.COP,
      shouldSeedCategories: true,
      accounts: [
        {
          name: "Cuenta principal",
          type: ACCOUNT_TYPES.BANK,
          currency: session.primaryCurrency ?? CURRENCY_CODES.COP,
          openingBalance: "0",
          creditCardClosingDay: "",
          creditCardDueDay: "",
        },
      ],
    },
  });
  const accountFields = useFieldArray({
    control: form.control,
    name: "accounts",
  });

  return (
    <div className="finlog-shell min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl finlog-page-stack">
        <PageHeader
          title={finlogMessages.onboarding.title}
          description={finlogMessages.onboarding.description}
        />

        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(async (values) => {
            await mutation.mutateAsync({
              settings: {
                primaryCurrency: values.primaryCurrency,
                language: "es",
              },
              shouldSeedCategories: values.shouldSeedCategories,
              accounts: values.accounts.map((account) => ({
                name: account.name,
                type: account.type,
                currency: account.currency,
                openingBalanceAmount: parseAmountInput(
                  account.openingBalance,
                  account.currency
                ),
                creditCardClosingDay: parseOptionalInteger(
                  account.creditCardClosingDay
                ),
                creditCardDueDay: parseOptionalInteger(
                  account.creditCardDueDay
                ),
              })),
            });
          })}
        >
          <AppCard>
            <FormField
              label="Moneda principal"
              error={form.formState.errors.primaryCurrency?.message}
            >
              <SelectInput {...form.register("primaryCurrency")}>
                {renderCurrencyOptions()}
              </SelectInput>
            </FormField>
            <label className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                {...form.register("shouldSeedCategories")}
              />
              Cargar categorias por defecto editables.
            </label>
          </AppCard>

          <AppCard>
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle
                title="Cuentas iniciales"
                description="Puedes crear varias cuentas desde el inicio."
              />
              <Button
                onClick={() =>
                  accountFields.append({
                    name: "",
                    type: ACCOUNT_TYPES.CASH,
                    currency: form.getValues("primaryCurrency"),
                    openingBalance: "0",
                    creditCardClosingDay: "",
                    creditCardDueDay: "",
                  })
                }
                type="button"
                variant="outline"
              >
                Agregar cuenta
              </Button>
            </div>

            <div className="space-y-4">
              {accountFields.fields.map((field, index) => (
                <div
                  className="grid gap-3 rounded-2xl border border-border/60 p-4 md:grid-cols-2"
                  key={field.id}
                >
                  <FormField
                    label="Nombre"
                    error={
                      form.formState.errors.accounts?.[index]?.name?.message
                    }
                  >
                    <TextInput {...form.register(`accounts.${index}.name`)} />
                  </FormField>
                  <FormField
                    label="Tipo"
                    error={
                      form.formState.errors.accounts?.[index]?.type?.message
                    }
                  >
                    <SelectInput {...form.register(`accounts.${index}.type`)}>
                      {renderAccountTypeOptions()}
                    </SelectInput>
                  </FormField>
                  <FormField
                    label="Moneda"
                    error={
                      form.formState.errors.accounts?.[index]?.currency?.message
                    }
                  >
                    <SelectInput
                      {...form.register(`accounts.${index}.currency`)}
                    >
                      {renderCurrencyOptions()}
                    </SelectInput>
                  </FormField>
                  <FormField
                    label="Saldo inicial"
                    hint="Se registra como movimiento de saldo inicial, no como ingreso."
                    error={
                      form.formState.errors.accounts?.[index]?.openingBalance
                        ?.message
                    }
                  >
                    <TextInput
                      {...form.register(`accounts.${index}.openingBalance`)}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField
                    label="Dia de corte"
                    hint="Solo si la cuenta es tarjeta de credito."
                  >
                    <TextInput
                      {...form.register(
                        `accounts.${index}.creditCardClosingDay`
                      )}
                    />
                  </FormField>
                  <FormField
                    label="Dia limite de pago"
                    hint="Solo si la cuenta es tarjeta de credito."
                  >
                    <TextInput
                      {...form.register(`accounts.${index}.creditCardDueDay`)}
                    />
                  </FormField>

                  {accountFields.fields.length > 1 ? (
                    <div className="md:col-span-2">
                      <Button
                        onClick={() => accountFields.remove(index)}
                        type="button"
                        variant="destructive"
                      >
                        Quitar cuenta
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </AppCard>

          <Button
            className="w-full"
            disabled={mutation.isPending}
            size="lg"
            type="submit"
          >
            Ir al dashboard
          </Button>
        </form>
      </div>
    </div>
  );
}

function FinlogShell({ session }: { session: SessionDto }) {
  const [screen, setScreen] = useState<ScreenKey>("dashboard");
  const logoutMutation = useFinlogMutation(
    finlogApi.auth.logout,
    "Sesion cerrada."
  );

  return (
    <div className="finlog-shell h-dvh overflow-hidden bg-background text-foreground">
      <div className="grid h-full min-h-0 lg:grid-cols-[320px_1fr]">
        <aside className="overflow-y-auto border-r border-sidebar-border/80 bg-sidebar/85 px-5 py-6 backdrop-blur-xl lg:px-6 lg:py-8">
          <div className="flex min-h-full flex-col gap-6">
            <div className="finlog-card p-5">
              <div className="mt-4 space-y-2">
                <p className="finlog-display text-3xl text-foreground">
                  {finlogMessages.app.name}
                </p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{session.name}</p>
                  <p>{session.email}</p>
                  <p>
                    Moneda base: <span className="text-foreground">{session.primaryCurrency}</span>
                  </p>
                </div>
              </div>
            </div>

            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = screen === item.key;
                return (
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 rounded-3xl border px-4 py-3.5 text-left text-sm transition-all duration-200",
                      isActive
                        ? "border-primary/10 bg-primary text-primary-foreground"
                        : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-background/70 hover:text-foreground"
                    )}
                    key={item.key}
                    onClick={() => setScreen(item.key)}
                    type="button"
                  >
                    <Icon className="size-4" />
                    <span className="flex-1">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="finlog-card mt-auto p-5">
              <p className="text-sm font-medium text-foreground">Tu contabilidad se queda contigo</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground [text-wrap:pretty]">
                Opera con claridad editorial, resúmenes útiles y trazabilidad real en cada vista.
              </p>
              <Button
                className="mt-5 w-full justify-center"
                onClick={() => void logoutMutation.mutateAsync(undefined)}
                variant="outline"
              >
                <LogOut className="size-4" />
                {finlogMessages.actions.logout}
              </Button>
            </div>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            {screen === "dashboard" ? <DashboardPage /> : null}
            {screen === "movements" ? <MovementsPage /> : null}
            {screen === "accounts" ? <AccountsPage /> : null}
            {screen === "debts" ? <DebtsPage /> : null}
            {screen === "goals" ? <GoalsPage /> : null}
            {screen === "categories" ? <CategoriesPage /> : null}
            {screen === "reports" ? <ReportsPage /> : null}
            {screen === "settings" ? <SettingsPage session={session} /> : null}
          </div>
        </main>
      </div>
      <QuickMovementDialog />
    </div>
  );
}

function DashboardPage() {
  const filters: ReportFiltersInput = {
    accountId: null,
    currency: "all",
    from: null,
    to: null,
  };
  const accountsQuery = useQuery({
    queryKey: ["finlog", "accounts"],
    queryFn: () => finlogApi.accounts.list(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["finlog", "categories"],
    queryFn: () => finlogApi.categories.list(),
  });
  const summaryQuery = useQuery({
    queryKey: ["finlog", "dashboard", filters],
    queryFn: () => finlogApi.dashboard.summary(filters),
  });

  if (!summaryQuery.data) {
    return (
      <FullscreenMessage
        title="Cargando dashboard"
        description="Calculando resumen financiero."
        compact
      />
    );
  }

  const summary = summaryQuery.data;

  return (
    <div className="finlog-page-stack">
      <PageHeader
        title="Dashboard"
        description="Vista unificada del disponible libre, el mes actual, deudas, reservas y ultimos movimientos."
      />

      <AppCard className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">Panorama financiero</p>
          <h2 className="finlog-display text-4xl text-foreground lg:text-5xl">
            Una lectura clara de tu liquidez, compromisos y reservas.
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground [text-wrap:pretty]">
            Esta vista concentra lo imprescindible para decidir mejor: caja libre,
            respiración mensual, deuda viva, dinero reservado y los últimos
            movimientos con contexto.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="finlog-list-row">
            <p className="text-sm font-medium text-muted-foreground">
              Sesgo saludable
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              Prioriza disponible libre y deudas pendientes antes de mirar crecimiento.
            </p>
          </div>
          <div className="finlog-list-row">
            <p className="text-sm font-medium text-muted-foreground">
              Últimos movimientos
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              La tabla inferior mantiene trazabilidad sin mezclar ajustes con ingresos reales.
            </p>
          </div>
        </div>
      </AppCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard
          title="Disponible libre"
          values={summary.freeBalanceByCurrency}
        />
        <StatCard
          title="Balance del mes"
          values={summary.monthBalanceByCurrency}
        />
        <StatCard
          title="Gastos del mes"
          values={summary.monthExpensesByCurrency}
        />
        <StatCard
          title="Deudas pendientes"
          values={summary.pendingDebtsByCurrency}
        />
        <StatCard
          title="Por cobrar"
          values={summary.pendingReceivablesByCurrency}
        />
        <StatCard
          title="Reservado en metas"
          values={summary.reservedGoalsByCurrency}
        />
      </div>

      <AppCard>
        <SectionTitle
          title="Ultimos movimientos"
          description="Los movimientos mas recientes del usuario actual."
        />
        <TransactionsTable
          accounts={accountsQuery.data ?? []}
          categories={categoriesQuery.data ?? []}
          transactions={summary.recentTransactions}
        />
      </AppCard>
    </div>
  );
}

function MovementsPage() {
  const accountsQuery = useQuery({
    queryKey: ["finlog", "accounts"],
    queryFn: () => finlogApi.accounts.list(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["finlog", "categories"],
    queryFn: () => finlogApi.categories.list(),
  });
  const [filters, setFilters] = useState({
    accountId: "",
    categoryId: "",
    type: "all",
    currency: "all",
    from: "",
    to: "",
    search: "",
  });
  const transactionsQuery = useQuery({
    queryKey: ["finlog", "transactions", filters],
    queryFn: () =>
      finlogApi.transactions.list({
        accountId: filters.accountId || null,
        categoryId: filters.categoryId || null,
        type: filters.type as TransactionFilters["type"],
        currency: filters.currency as TransactionFilters["currency"],
        from: filters.from || null,
        to: filters.to || null,
        search: filters.search,
      }),
  });

  const movementMutation = useFinlogMutation(
    async (values: MovementFormValues) => {
      const account = accountsQuery.data?.find(
        (item) => item.id === values.accountId
      );
      if (!account) {
        throw new Error("Selecciona una cuenta valida.");
      }

      const amount = parseAmountInput(values.amount, account.currency);
      if (values.kind === TRANSACTION_TYPES.INCOME) {
        return finlogApi.transactions.createIncome({
          accountId: values.accountId,
          categoryId: values.categoryId,
          subcategoryId: values.subcategoryId || null,
          amount,
          date: values.date,
          description: values.description ?? "",
          note: values.note ?? "",
        });
      }

      return finlogApi.transactions.createExpense({
        accountId: values.accountId,
        categoryId: values.categoryId,
        subcategoryId: values.subcategoryId || null,
        amount,
        date: values.date,
        description: values.description ?? "",
        note: values.note ?? "",
      });
    },
    "Movimiento registrado."
  );

  const transferMutation = useFinlogMutation(
    async (values: z.infer<typeof transferSchema>) => {
      const account = accountsQuery.data?.find(
        (item) => item.id === values.accountId
      );
      if (!account) {
        throw new Error("Cuenta origen invalida.");
      }
      return finlogApi.transactions.createTransfer({
        accountId: values.accountId,
        destinationAccountId: values.destinationAccountId,
        amount: parseAmountInput(values.amount, account.currency),
        date: values.date,
        description: values.description ?? "",
        note: values.note ?? "",
      });
    },
    "Transferencia registrada."
  );

  const conversionMutation = useFinlogMutation(
    async (values: z.infer<typeof conversionSchema>) => {
      const origin = accountsQuery.data?.find(
        (item) => item.id === values.accountId
      );
      const destination = accountsQuery.data?.find(
        (item) => item.id === values.destinationAccountId
      );
      if (!origin || !destination) {
        throw new Error("Selecciona cuentas validas para la conversion.");
      }
      return finlogApi.transactions.createConversion({
        accountId: values.accountId,
        destinationAccountId: values.destinationAccountId,
        amount: parseAmountInput(values.amount, origin.currency),
        destinationAmount: parseAmountInput(
          values.destinationAmount,
          destination.currency
        ),
        date: values.date,
        description: values.description ?? "",
        note: values.note ?? "",
      });
    },
    "Conversion registrada."
  );

  const adjustmentMutation = useFinlogMutation(
    async (values: z.infer<typeof adjustmentSchema>) => {
      const account = accountsQuery.data?.find(
        (item) => item.id === values.accountId
      );
      if (!account) {
        throw new Error("Cuenta invalida.");
      }
      return finlogApi.transactions.createAdjustment({
        accountId: values.accountId,
        amount: parseSignedAmountInput(values.amount, account.currency),
        date: values.date,
        description: values.description ?? "",
        note: values.note,
      });
    },
    "Ajuste registrado."
  );

  const editMutation = useFinlogMutation(
    finlogApi.transactions.update,
    "Movimiento actualizado."
  );
  const deleteMutation = useFinlogMutation(
    finlogApi.transactions.remove,
    "Movimiento eliminado."
  );

  const movementForm = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      kind: TRANSACTION_TYPES.EXPENSE,
      accountId: "",
      categoryId: "",
      subcategoryId: "",
      amount: "",
      date: todayIso(),
      description: "",
      note: "",
    },
  });
  const transferForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      accountId: "",
      destinationAccountId: "",
      amount: "",
      date: todayIso(),
      description: "",
      note: "",
    },
  });
  const conversionForm = useForm<z.infer<typeof conversionSchema>>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      accountId: "",
      destinationAccountId: "",
      amount: "",
      destinationAmount: "",
      date: todayIso(),
      description: "",
      note: "",
    },
  });
  const adjustmentForm = useForm<z.infer<typeof adjustmentSchema>>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      accountId: "",
      amount: "",
      date: todayIso(),
      description: "",
      note: "",
    },
  });

  const categories = categoriesQuery.data ?? [];
  const selectedCategory = categories.find(
    (category) => category.id === movementForm.watch("categoryId")
  );

  return (
    <div className="finlog-page-stack">
      <PageHeader
        title="Movimientos"
        description="Consulta el historial completo, filtra movimientos y ejecuta operaciones desde acciones separadas."
      />

      <AppCard className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-medium text-foreground">Acciones rápidas</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            La lista queda como foco principal. Las operaciones se abren solo cuando las necesitas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button aria-label="Crear ingreso o gasto" size="icon">
                <Plus className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo ingreso o gasto</DialogTitle>
                <DialogDescription>
                  Registra una operación categorizada que impacta una cuenta real.
                </DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={movementForm.handleSubmit(async (values) => {
                  await movementMutation.mutateAsync(values);
                  movementForm.reset({ ...values, amount: "", description: "", note: "" });
                })}
              >
                <FormField label="Tipo" error={movementForm.formState.errors.kind?.message}>
                  <SelectInput {...movementForm.register("kind")}>
                    <option value={TRANSACTION_TYPES.EXPENSE}>Gasto</option>
                    <option value={TRANSACTION_TYPES.INCOME}>Ingreso</option>
                  </SelectInput>
                </FormField>
                <FormField label="Cuenta" error={movementForm.formState.errors.accountId?.message}>
                  <SelectInput {...movementForm.register("accountId")}>
                    <option value="">Selecciona</option>
                    {renderAccountOptions(accountsQuery.data ?? [])}
                  </SelectInput>
                </FormField>
                <FormField label="Categoría" error={movementForm.formState.errors.categoryId?.message}>
                  <SelectInput {...movementForm.register("categoryId")}>
                    <option value="">Selecciona</option>
                    {categories
                      .filter((category) => category.kind === movementForm.watch("kind"))
                      .map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                  </SelectInput>
                </FormField>
                <FormField label="Subcategoría">
                  <SelectInput {...movementForm.register("subcategoryId")}>
                    <option value="">Opcional</option>
                    {(selectedCategory?.subcategories ?? []).map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Monto" error={movementForm.formState.errors.amount?.message}>
                  <TextInput {...movementForm.register("amount")} placeholder="Ej: 125000 o 12.34" />
                </FormField>
                <FormField label="Fecha" error={movementForm.formState.errors.date?.message}>
                  <TextInput type="date" {...movementForm.register("date")} />
                </FormField>
                <FormField className="md:col-span-2" label="Descripción">
                  <TextInput {...movementForm.register("description")} />
                </FormField>
                <FormField className="md:col-span-2" label="Nota">
                  <TextArea {...movementForm.register("note")} rows={3} />
                </FormField>
                <div className="md:col-span-2">
                  <Button disabled={movementMutation.isPending} type="submit">Registrar movimiento</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button aria-label="Registrar transferencia" size="icon" variant="outline">
                <ArrowLeftRight className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transferencia</DialogTitle>
                <DialogDescription>Mueve dinero entre cuentas de la misma moneda.</DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={transferForm.handleSubmit(async (values) => {
                  await transferMutation.mutateAsync(values);
                  transferForm.reset({ ...values, amount: "", description: "", note: "" });
                })}
              >
                <FormField label="Cuenta origen"><SelectInput {...transferForm.register("accountId")}><option value="">Selecciona</option>{renderAccountOptions(accountsQuery.data ?? [])}</SelectInput></FormField>
                <FormField label="Cuenta destino"><SelectInput {...transferForm.register("destinationAccountId")}><option value="">Selecciona</option>{renderAccountOptions(accountsQuery.data ?? [])}</SelectInput></FormField>
                <FormField label="Monto"><TextInput {...transferForm.register("amount")} /></FormField>
                <FormField label="Fecha"><TextInput type="date" {...transferForm.register("date")} /></FormField>
                <FormField className="md:col-span-2" label="Descripción"><TextInput {...transferForm.register("description")} /></FormField>
                <FormField className="md:col-span-2" label="Nota"><TextArea {...transferForm.register("note")} rows={3} /></FormField>
                <div className="md:col-span-2"><Button disabled={transferMutation.isPending} type="submit">Registrar transferencia</Button></div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button aria-label="Registrar conversión" size="icon" variant="outline">
                <Repeat2 className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Conversión manual</DialogTitle>
                <DialogDescription>Registra monto origen y monto destino sin tasa automática.</DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={conversionForm.handleSubmit(async (values) => {
                  await conversionMutation.mutateAsync(values);
                  conversionForm.reset({ ...values, amount: "", destinationAmount: "", description: "", note: "" });
                })}
              >
                <FormField label="Cuenta origen"><SelectInput {...conversionForm.register("accountId")}><option value="">Selecciona</option>{renderAccountOptions(accountsQuery.data ?? [])}</SelectInput></FormField>
                <FormField label="Cuenta destino"><SelectInput {...conversionForm.register("destinationAccountId")}><option value="">Selecciona</option>{renderAccountOptions(accountsQuery.data ?? [])}</SelectInput></FormField>
                <FormField label="Monto origen"><TextInput {...conversionForm.register("amount")} /></FormField>
                <FormField label="Monto destino"><TextInput {...conversionForm.register("destinationAmount")} /></FormField>
                <FormField label="Fecha"><TextInput type="date" {...conversionForm.register("date")} /></FormField>
                <FormField className="md:col-span-2" label="Descripción"><TextInput {...conversionForm.register("description")} /></FormField>
                <FormField className="md:col-span-2" label="Nota"><TextArea {...conversionForm.register("note")} rows={3} /></FormField>
                <div className="md:col-span-2"><Button disabled={conversionMutation.isPending} type="submit">Registrar conversión</Button></div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button aria-label="Registrar ajuste de saldo" size="icon" variant="outline">
                <SlidersHorizontal className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajuste de saldo</DialogTitle>
                <DialogDescription>Corrige saldo sin contarlo como ingreso o gasto normal.</DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={adjustmentForm.handleSubmit(async (values) => {
                  await adjustmentMutation.mutateAsync(values);
                  adjustmentForm.reset({ ...values, amount: "", description: "", note: "" });
                })}
              >
                <FormField label="Cuenta"><SelectInput {...adjustmentForm.register("accountId")}><option value="">Selecciona</option>{renderAccountOptions(accountsQuery.data ?? [])}</SelectInput></FormField>
                <FormField label="Monto con signo"><TextInput {...adjustmentForm.register("amount")} placeholder="Ej: -5000 o 10000" /></FormField>
                <FormField label="Fecha"><TextInput type="date" {...adjustmentForm.register("date")} /></FormField>
                <FormField className="md:col-span-2" label="Descripción"><TextInput {...adjustmentForm.register("description")} /></FormField>
                <FormField className="md:col-span-2" label="Motivo obligatorio"><TextArea {...adjustmentForm.register("note")} rows={3} /></FormField>
                <div className="md:col-span-2"><Button disabled={adjustmentMutation.isPending} type="submit">Registrar ajuste</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </AppCard>

      {false ? (
      <div className="grid gap-6 xl:grid-cols-2">
        <AppCard>
          <SectionTitle
            title="Nuevo ingreso o gasto"
            description="Ingreso y gasto requieren cuenta, categoria, monto y fecha."
          />
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={movementForm.handleSubmit(async (values) => {
              await movementMutation.mutateAsync(values);
              movementForm.reset({
                ...values,
                amount: "",
                description: "",
                note: "",
              });
            })}
          >
            <FormField
              label="Tipo"
              error={movementForm.formState.errors.kind?.message}
            >
              <SelectInput {...movementForm.register("kind")}>
                <option value={TRANSACTION_TYPES.EXPENSE}>Gasto</option>
                <option value={TRANSACTION_TYPES.INCOME}>Ingreso</option>
              </SelectInput>
            </FormField>
            <FormField
              label="Cuenta"
              error={movementForm.formState.errors.accountId?.message}
            >
              <SelectInput {...movementForm.register("accountId")}>
                <option value="">Selecciona</option>
                {renderAccountOptions(accountsQuery.data ?? [])}
              </SelectInput>
            </FormField>
            <FormField
              label="Categoria"
              error={movementForm.formState.errors.categoryId?.message}
            >
              <SelectInput {...movementForm.register("categoryId")}>
                <option value="">Selecciona</option>
                {categories
                  .filter(
                    (category) => category.kind === movementForm.watch("kind")
                  )
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </SelectInput>
            </FormField>
            <FormField label="Subcategoria">
              <SelectInput {...movementForm.register("subcategoryId")}>
                <option value="">Opcional</option>
                {(selectedCategory?.subcategories ?? []).map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField
              label="Monto"
              error={movementForm.formState.errors.amount?.message}
            >
              <TextInput
                {...movementForm.register("amount")}
                placeholder="Ej: 125000 o 12.34"
              />
            </FormField>
            <FormField
              label="Fecha"
              error={movementForm.formState.errors.date?.message}
            >
              <TextInput type="date" {...movementForm.register("date")} />
            </FormField>
            <FormField className="md:col-span-2" label="Descripcion">
              <TextInput {...movementForm.register("description")} />
            </FormField>
            <FormField className="md:col-span-2" label="Nota">
              <TextArea {...movementForm.register("note")} rows={3} />
            </FormField>
            <div className="md:col-span-2">
              <Button disabled={movementMutation.isPending} type="submit">
                Registrar movimiento
              </Button>
            </div>
          </form>
        </AppCard>

        <AppCard>
          <SectionTitle
            title="Transferencia"
            description="Solo entre cuentas de la misma moneda."
          />
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={transferForm.handleSubmit(async (values) => {
              await transferMutation.mutateAsync(values);
              transferForm.reset({
                ...values,
                amount: "",
                description: "",
                note: "",
              });
            })}
          >
            <FormField label="Cuenta origen">
              <SelectInput {...transferForm.register("accountId")}>
                <option value="">Selecciona</option>
                {renderAccountOptions(accountsQuery.data ?? [])}
              </SelectInput>
            </FormField>
            <FormField label="Cuenta destino">
              <SelectInput {...transferForm.register("destinationAccountId")}>
                <option value="">Selecciona</option>
                {renderAccountOptions(accountsQuery.data ?? [])}
              </SelectInput>
            </FormField>
            <FormField label="Monto">
              <TextInput {...transferForm.register("amount")} />
            </FormField>
            <FormField label="Fecha">
              <TextInput type="date" {...transferForm.register("date")} />
            </FormField>
            <FormField className="md:col-span-2" label="Descripcion">
              <TextInput {...transferForm.register("description")} />
            </FormField>
            <FormField className="md:col-span-2" label="Nota">
              <TextArea {...transferForm.register("note")} rows={3} />
            </FormField>
            <div className="md:col-span-2">
              <Button disabled={transferMutation.isPending} type="submit">
                Registrar transferencia
              </Button>
            </div>
          </form>
        </AppCard>

        <AppCard>
          <SectionTitle
            title="Conversion manual"
            description="Requiere monto origen y monto destino; no hay conversion automatica."
          />
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={conversionForm.handleSubmit(async (values) => {
              await conversionMutation.mutateAsync(values);
              conversionForm.reset({
                ...values,
                amount: "",
                destinationAmount: "",
                description: "",
                note: "",
              });
            })}
          >
            <FormField label="Cuenta origen">
              <SelectInput {...conversionForm.register("accountId")}>
                <option value="">Selecciona</option>
                {renderAccountOptions(accountsQuery.data ?? [])}
              </SelectInput>
            </FormField>
            <FormField label="Cuenta destino">
              <SelectInput {...conversionForm.register("destinationAccountId")}>
                <option value="">Selecciona</option>
                {renderAccountOptions(accountsQuery.data ?? [])}
              </SelectInput>
            </FormField>
            <FormField label="Monto origen">
              <TextInput {...conversionForm.register("amount")} />
            </FormField>
            <FormField label="Monto destino">
              <TextInput {...conversionForm.register("destinationAmount")} />
            </FormField>
            <FormField label="Fecha">
              <TextInput type="date" {...conversionForm.register("date")} />
            </FormField>
            <FormField className="md:col-span-2" label="Descripcion">
              <TextInput {...conversionForm.register("description")} />
            </FormField>
            <FormField className="md:col-span-2" label="Nota">
              <TextArea {...conversionForm.register("note")} rows={3} />
            </FormField>
            <div className="md:col-span-2">
              <Button disabled={conversionMutation.isPending} type="submit">
                Registrar conversion
              </Button>
            </div>
          </form>
        </AppCard>

        <AppCard>
          <SectionTitle
            title="Ajuste de saldo"
            description="Afecta saldo, pero no cuenta como ingreso ni gasto normal."
          />
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={adjustmentForm.handleSubmit(async (values) => {
              await adjustmentMutation.mutateAsync(values);
              adjustmentForm.reset({
                ...values,
                amount: "",
                description: "",
                note: "",
              });
            })}
          >
            <FormField label="Cuenta">
              <SelectInput {...adjustmentForm.register("accountId")}>
                <option value="">Selecciona</option>
                {renderAccountOptions(accountsQuery.data ?? [])}
              </SelectInput>
            </FormField>
            <FormField label="Monto con signo">
              <TextInput
                {...adjustmentForm.register("amount")}
                placeholder="Ej: -5000 o 10000"
              />
            </FormField>
            <FormField label="Fecha">
              <TextInput type="date" {...adjustmentForm.register("date")} />
            </FormField>
            <FormField className="md:col-span-2" label="Descripcion">
              <TextInput {...adjustmentForm.register("description")} />
            </FormField>
            <FormField className="md:col-span-2" label="Motivo obligatorio">
              <TextArea {...adjustmentForm.register("note")} rows={3} />
            </FormField>
            <div className="md:col-span-2">
              <Button disabled={adjustmentMutation.isPending} type="submit">
                Registrar ajuste
              </Button>
            </div>
          </form>
        </AppCard>
      </div>
      ) : null}

      <AppCard>
        <SectionTitle
          title="Historial"
          description="Filtra movimientos, edita metadatos y recalcula saldos al eliminar."
        />
        <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SelectInput
            value={filters.accountId}
            onChange={(event) =>
              setFilters((state) => ({
                ...state,
                accountId: event.target.value,
              }))
            }
          >
            <option value="">Todas las cuentas</option>
            {renderAccountOptions(accountsQuery.data ?? [])}
          </SelectInput>
          <SelectInput
            value={filters.categoryId}
            onChange={(event) =>
              setFilters((state) => ({
                ...state,
                categoryId: event.target.value,
              }))
            }
          >
            <option value="">Todas las categorias</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            value={filters.type}
            onChange={(event) =>
              setFilters((state) => ({ ...state, type: event.target.value }))
            }
          >
            <option value="all">Todos los tipos</option>
            {Object.values(TRANSACTION_TYPES).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            value={filters.currency}
            onChange={(event) =>
              setFilters((state) => ({
                ...state,
                currency: event.target.value,
              }))
            }
          >
            <option value="all">Todas las monedas</option>
            {renderCurrencyOptions()}
          </SelectInput>
          <TextInput
            type="date"
            value={filters.from}
            onChange={(event) =>
              setFilters((state) => ({ ...state, from: event.target.value }))
            }
          />
          <TextInput
            type="date"
            value={filters.to}
            onChange={(event) =>
              setFilters((state) => ({ ...state, to: event.target.value }))
            }
          />
          <div className="md:col-span-3 xl:col-span-6">
            <TextInput
              placeholder="Buscar en descripcion o notas"
              value={filters.search}
              onChange={(event) =>
                setFilters((state) => ({
                  ...state,
                  search: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <TransactionsTable
          accounts={accountsQuery.data ?? []}
          categories={categoriesQuery.data ?? []}
          transactions={transactionsQuery.data ?? []}
          onDelete={async (transactionId) => {
            if (
              window.confirm(
                "Eliminar este movimiento recalculara saldos afectados. Deseas continuar?"
              )
            ) {
              await deleteMutation.mutateAsync(transactionId);
            }
          }}
          onEdit={async (transaction) => {
            const date =
              window.prompt("Fecha (YYYY-MM-DD)", transaction.date) ??
              transaction.date;
            const description =
              window.prompt("Descripcion", transaction.description ?? "") ?? "";
            const note = window.prompt("Nota", transaction.note ?? "") ?? "";
            await editMutation.mutateAsync({
              transactionId: transaction.id,
              date,
              description,
              note,
            });
          }}
        />
      </AppCard>
    </div>
  );
}

function QuickMovementDialog() {
  const accountsQuery = useQuery({
    queryKey: ["finlog", "accounts"],
    queryFn: () => finlogApi.accounts.list(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["finlog", "categories"],
    queryFn: () => finlogApi.categories.list(),
  });
  const movementMutation = useFinlogMutation(
    async (values: MovementFormValues) => {
      const account = accountsQuery.data?.find(
        (item) => item.id === values.accountId
      );
      if (!account) {
        throw new Error("Selecciona una cuenta valida.");
      }

      const amount = parseAmountInput(values.amount, account.currency);
      if (values.kind === TRANSACTION_TYPES.INCOME) {
        return finlogApi.transactions.createIncome({
          accountId: values.accountId,
          categoryId: values.categoryId,
          subcategoryId: values.subcategoryId || null,
          amount,
          date: values.date,
          description: values.description ?? "",
          note: values.note ?? "",
        });
      }

      return finlogApi.transactions.createExpense({
        accountId: values.accountId,
        categoryId: values.categoryId,
        subcategoryId: values.subcategoryId || null,
        amount,
        date: values.date,
        description: values.description ?? "",
        note: values.note ?? "",
      });
    },
    "Movimiento registrado."
  );
  const form = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      kind: TRANSACTION_TYPES.EXPENSE,
      accountId: "",
      categoryId: "",
      subcategoryId: "",
      amount: "",
      date: todayIso(),
      description: "",
      note: "",
    },
  });
  const categories = categoriesQuery.data ?? [];
  const movementKind = form.watch("kind");
  const amountField = form.register("amount");
  const selectedCategory = categories.find(
    (category) => category.id === form.watch("categoryId")
  );
  const handleSelectMovementKind = (kind: MovementFormValues["kind"]) => {
    form.setValue("kind", kind, { shouldDirty: true, shouldValidate: true });
    form.setValue("categoryId", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("subcategoryId", "", { shouldDirty: true, shouldValidate: false });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-label="Registrar ingreso o gasto desde cualquier vista"
          className="fixed bottom-6 right-6 z-40 size-14 rounded-full"
          size="icon"
        >
          <Plus className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-3rem)] max-w-xl gap-0 overflow-y-auto p-0">
        <div className="px-6 pb-4 pt-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">
            Registrar movimiento
            </DialogTitle>
            <DialogDescription>
              Captura lo esencial. El resto es contexto opcional.
            </DialogDescription>
          </DialogHeader>
        </div>
        <form
          className="grid gap-5 px-6 pb-6"
          onSubmit={form.handleSubmit(async (values) => {
            await movementMutation.mutateAsync(values);
            form.reset({
              ...values,
              amount: "",
              description: "",
              note: "",
            });
          })}
        >
          <div className="grid grid-cols-2 rounded-3xl bg-muted/60 p-1.5">
            <button
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium transition-colors",
                movementKind === TRANSACTION_TYPES.EXPENSE
                  ? "bg-card text-foreground shadow-[0_10px_28px_-24px_rgba(12,10,9,0.32)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={movementKind === TRANSACTION_TYPES.EXPENSE}
              onClick={() => handleSelectMovementKind(TRANSACTION_TYPES.EXPENSE)}
              type="button"
            >
              <ArrowUpRight className="size-4" />
              Gasto
            </button>
            <button
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium transition-colors",
                movementKind === TRANSACTION_TYPES.INCOME
                  ? "bg-card text-foreground shadow-[0_10px_28px_-24px_rgba(12,10,9,0.32)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={movementKind === TRANSACTION_TYPES.INCOME}
              onClick={() => handleSelectMovementKind(TRANSACTION_TYPES.INCOME)}
              type="button"
            >
              <ArrowDownLeft className="size-4" />
              Ingreso
            </button>
          </div>

          <div className="grid gap-4">
            <div>
              <FormField
                label="Monto"
                error={form.formState.errors.amount?.message}
              >
                <div className="grid grid-cols-[3.25rem_1fr] overflow-hidden rounded-3xl border border-border/80 bg-background/85 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                  <div className="flex items-center justify-center border-r border-border/70 text-2xl font-medium text-muted-foreground">
                    $
                  </div>
                  <TextInput
                    name={amountField.name}
                    ref={amountField.ref}
                    value={form.watch("amount")}
                    onBlur={amountField.onBlur}
                    onChange={(event) => {
                      form.setValue("amount", formatAmountInput(event.target.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    className="h-16 rounded-none border-0 bg-transparent px-4 text-3xl shadow-none focus-visible:outline-none"
                    autoComplete="off"
                    inputMode="decimal"
                    pattern="\d{1,3}(\.\d{3})*(,\d{1,2})?|\d+(,\d{1,2})?"
                    placeholder="0"
                    required
                    title="Monto positivo con máximo 2 decimales. Ejemplo: 125.000 o 125.000,50"
                  />
                </div>
              </FormField>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Fecha" error={form.formState.errors.date?.message}>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <TextInput
                  className="pl-11"
                  type="date"
                  {...form.register("date")}
                  required
                />
              </div>
            </FormField>
            <FormField
              label="Cuenta"
              error={form.formState.errors.accountId?.message}
            >
              <div className="relative">
                <CreditCard className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <SelectInput className="pl-11" {...form.register("accountId")} required>
                  <option value="">Selecciona</option>
                  {renderAccountOptions(accountsQuery.data ?? [])}
                </SelectInput>
              </div>
            </FormField>
            <FormField
              label="Categoría"
              error={form.formState.errors.categoryId?.message}
            >
              <div className="relative">
                <Tag className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <SelectInput className="pl-11" {...form.register("categoryId")} required>
                  <option value="">Selecciona</option>
                  {categories
                    .filter((category) => category.kind === movementKind)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </SelectInput>
              </div>
            </FormField>
            <FormField label="Subcategoría">
              <div className="relative">
                <FileText className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <SelectInput className="pl-11" {...form.register("subcategoryId")}>
                  <option value="">Opcional</option>
                  {(selectedCategory?.subcategories ?? []).map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </FormField>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs font-medium text-muted-foreground">
            <div className="h-px bg-border/70" />
            <span>Contexto adicional</span>
            <div className="h-px bg-border/70" />
          </div>

          <div className="grid gap-3">
            <FormField label="Descripción">
              <div className="relative">
                <MessageSquareText className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <TextInput
                  className="pl-11"
                  {...form.register("description")}
                  maxLength={120}
                  placeholder="Ej: mercado, salario, transporte..."
                />
              </div>
            </FormField>
            <FormField label="Nota">
              <TextArea
                {...form.register("note")}
                maxLength={500}
                placeholder="Agrega un comentario adicional..."
                rows={3}
              />
            </FormField>
          </div>

          <div className="-mx-6 -mb-6 flex flex-col gap-3 border-t border-border/70 bg-muted/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              Se guardará cuando cuenta, categoría, monto y fecha estén completos.
            </p>
            <Button className="sm:min-w-40" disabled={movementMutation.isPending} type="submit">
              <ArrowLeftRight className="size-4" />
              Registrar movimiento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountsPage() {
  const accountsQuery = useQuery({
    queryKey: ["finlog", "accounts"],
    queryFn: () => finlogApi.accounts.list(),
  });
  const createMutation = useFinlogMutation(
    async (values: z.infer<typeof accountSchema>) =>
      finlogApi.accounts.create({
        name: values.name,
        type: values.type,
        currency: values.currency,
        openingBalanceAmount: parseAmountInput(
          values.openingBalance,
          values.currency
        ),
        creditCardClosingDay: parseOptionalInteger(values.creditCardClosingDay),
        creditCardDueDay: parseOptionalInteger(values.creditCardDueDay),
      }),
    "Cuenta creada."
  );
  const archiveMutation = useFinlogMutation(
    finlogApi.accounts.archive,
    "Cuenta archivada."
  );
  const deleteMutation = useFinlogMutation(
    finlogApi.accounts.remove,
    "Cuenta eliminada."
  );
  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: ACCOUNT_TYPES.BANK,
      currency: CURRENCY_CODES.COP,
      openingBalance: "0",
      creditCardClosingDay: "",
      creditCardDueDay: "",
    },
  });

  return (
    <div className="finlog-page-stack">
      <PageHeader
        title="Cuentas"
        description="Administra cuentas activas y archivadas. Una cuenta con movimientos no se borra: se archiva."
      />
      <AppCard>
        <SectionTitle
          title="Crear cuenta"
          description="El saldo inicial crea un movimiento especial sin contarse como ingreso."
        />
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={form.handleSubmit(async (values) => {
            await createMutation.mutateAsync(values);
            form.reset({
              ...values,
              name: "",
              openingBalance: "0",
              creditCardClosingDay: "",
              creditCardDueDay: "",
            });
          })}
        >
          <FormField label="Nombre">
            <TextInput {...form.register("name")} />
          </FormField>
          <FormField label="Tipo">
            <SelectInput {...form.register("type")}>
              {renderAccountTypeOptions()}
            </SelectInput>
          </FormField>
          <FormField label="Moneda">
            <SelectInput {...form.register("currency")}>
              {renderCurrencyOptions()}
            </SelectInput>
          </FormField>
          <FormField label="Saldo inicial">
            <TextInput {...form.register("openingBalance")} />
          </FormField>
          <FormField label="Dia de corte">
            <TextInput {...form.register("creditCardClosingDay")} />
          </FormField>
          <FormField label="Dia limite de pago">
            <TextInput {...form.register("creditCardDueDay")} />
          </FormField>
          <div className="md:col-span-2">
            <Button disabled={createMutation.isPending} type="submit">
              Crear cuenta
            </Button>
          </div>
        </form>
      </AppCard>
      <AppCard>
        <SectionTitle
          title="Lista de cuentas"
          description="Saldos separados por moneda y estado operativo."
        />
        <div className="grid gap-3">
          {(accountsQuery.data ?? []).map((account) => (
            <div
              className="finlog-list-row flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
              key={account.id}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-medium text-foreground">{account.name}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {account.type} · {account.currency} · {account.status}
                </p>
                <p className="text-sm text-foreground">
                  {formatMoneyValue(account.balance)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void archiveMutation.mutateAsync(account.id)}
                  variant="outline"
                >
                  Archivar
                </Button>
                <Button
                  onClick={() => void deleteMutation.mutateAsync(account.id)}
                  variant="destructive"
                >
                  Eliminar si esta vacia
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AppCard>
    </div>
  );
}

function DebtsPage() {
  const accountsQuery = useQuery({
    queryKey: ["finlog", "accounts"],
    queryFn: () => finlogApi.accounts.list(),
  });
  const debtsQuery = useQuery({
    queryKey: ["finlog", "debts"],
    queryFn: () => finlogApi.debts.list(),
  });
  const createMutation = useFinlogMutation(
    async (values: z.infer<typeof debtSchema>) =>
      finlogApi.debts.create({
        direction: values.direction,
        personOrEntity: values.personOrEntity,
        amount: parseAmountInput(values.amount, values.currency),
        currency: values.currency,
        dueDate: values.dueDate || null,
        installmentsTotal: parseOptionalInteger(values.installmentsTotal),
        note: values.note ?? "",
      }),
    "Deuda registrada."
  );
  const cancelMutation = useFinlogMutation(
    finlogApi.debts.cancel,
    "Deuda cancelada."
  );
  const archiveMutation = useFinlogMutation(
    finlogApi.debts.archive,
    "Deuda archivada."
  );
  const form = useForm<z.infer<typeof debtSchema>>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      direction: DEBT_DIRECTIONS.PAYABLE,
      personOrEntity: "",
      amount: "",
      currency: CURRENCY_CODES.COP,
      dueDate: "",
      installmentsTotal: "",
      note: "",
    },
  });

  return (
    <div className="finlog-page-stack">
      <PageHeader
        title="Deudas y por cobrar"
        description="Unifica lo que debes y lo que te deben, con estados persistidos y calculados."
      />
      <AppCard>
        <SectionTitle
          title="Crear deuda o cuenta por cobrar"
          description="No se modelan intereses ni amortizacion en este MVP."
        />
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={form.handleSubmit(async (values) => {
            await createMutation.mutateAsync(values);
            form.reset({ ...values, personOrEntity: "", amount: "", note: "" });
          })}
        >
          <FormField label="Direccion">
            <SelectInput {...form.register("direction")}>
              <option value={DEBT_DIRECTIONS.PAYABLE}>Yo debo</option>
              <option value={DEBT_DIRECTIONS.RECEIVABLE}>Me deben</option>
            </SelectInput>
          </FormField>
          <FormField label="Persona o entidad">
            <TextInput {...form.register("personOrEntity")} />
          </FormField>
          <FormField label="Monto">
            <TextInput {...form.register("amount")} />
          </FormField>
          <FormField label="Moneda">
            <SelectInput {...form.register("currency")}>
              {renderCurrencyOptions()}
            </SelectInput>
          </FormField>
          <FormField label="Vencimiento">
            <TextInput type="date" {...form.register("dueDate")} />
          </FormField>
          <FormField label="Cuotas totales opcionales">
            <TextInput {...form.register("installmentsTotal")} />
          </FormField>
          <FormField className="md:col-span-2" label="Notas">
            <TextArea {...form.register("note")} rows={3} />
          </FormField>
          <div className="md:col-span-2">
            <Button disabled={createMutation.isPending} type="submit">
              Crear deuda
            </Button>
          </div>
        </form>
      </AppCard>
      <div className="grid gap-4 xl:grid-cols-2">
        {(debtsQuery.data ?? []).map((debt) => (
          <DebtCard
            accountOptions={accountsQuery.data ?? []}
            archiveMutation={archiveMutation.mutateAsync}
            cancelMutation={cancelMutation.mutateAsync}
            debt={debt}
            key={debt.id}
          />
        ))}
      </div>
    </div>
  );
}

function GoalsPage() {
  const accountsQuery = useQuery({
    queryKey: ["finlog", "accounts"],
    queryFn: () => finlogApi.accounts.list(),
  });
  const goalsQuery = useQuery({
    queryKey: ["finlog", "goals"],
    queryFn: () => finlogApi.goals.list(),
  });
  const createMutation = useFinlogMutation(
    async (values: z.infer<typeof goalSchema>) => {
      const account = accountsQuery.data?.find(
        (item) => item.id === values.accountId
      );
      if (!account) {
        throw new Error("Selecciona una cuenta valida.");
      }
      return finlogApi.goals.create({
        name: values.name,
        type: values.type,
        accountId: values.accountId,
        targetAmount: parseAmountInput(values.targetAmount, account.currency),
      });
    },
    "Meta creada."
  );
  const cancelMutation = useFinlogMutation(
    finlogApi.goals.cancel,
    "Meta cancelada."
  );
  const archiveMutation = useFinlogMutation(
    finlogApi.goals.archive,
    "Meta archivada."
  );
  const form = useForm<z.infer<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      type: GOAL_TYPES.POCKET,
      accountId: "",
      targetAmount: "",
    },
  });

  return (
    <div className="finlog-page-stack">
      <PageHeader
        title="Metas"
        description="Crea reservas dentro de una cuenta o metas apoyadas en una alcancia separada."
      />
      <AppCard>
        <SectionTitle
          title="Crear meta de ahorro"
          description="Puede superar 100% y volver a activa si luego se retira dinero."
        />
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={form.handleSubmit(async (values) => {
            await createMutation.mutateAsync(values);
            form.reset({ ...values, name: "", targetAmount: "" });
          })}
        >
          <FormField label="Nombre">
            <TextInput {...form.register("name")} />
          </FormField>
          <FormField label="Tipo">
            <SelectInput {...form.register("type")}>
              <option value={GOAL_TYPES.POCKET}>Bolsillo / reserva</option>
              <option value={GOAL_TYPES.SEPARATE_ACCOUNT}>
                Cuenta / alcancia separada
              </option>
            </SelectInput>
          </FormField>
          <FormField label="Cuenta asociada">
            <SelectInput {...form.register("accountId")}>
              <option value="">Selecciona</option>
              {renderAccountOptions(accountsQuery.data ?? [])}
            </SelectInput>
          </FormField>
          <FormField label="Objetivo">
            <TextInput {...form.register("targetAmount")} />
          </FormField>
          <div className="md:col-span-2">
            <Button disabled={createMutation.isPending} type="submit">
              Crear meta
            </Button>
          </div>
        </form>
      </AppCard>
      <div className="grid gap-4 xl:grid-cols-2">
        {(goalsQuery.data ?? []).map((goal) => (
          <GoalCard
            accountOptions={accountsQuery.data ?? []}
            archiveMutation={archiveMutation.mutateAsync}
            cancelMutation={cancelMutation.mutateAsync}
            goal={goal}
            key={goal.id}
          />
        ))}
      </div>
    </div>
  );
}

function CategoriesPage() {
  const categoriesQuery = useQuery({
    queryKey: ["finlog", "categories"],
    queryFn: () => finlogApi.categories.list(),
  });
  const createMutation = useFinlogMutation(
    finlogApi.categories.create,
    "Categoria creada."
  );
  const subcategoryMutation = useFinlogMutation(
    finlogApi.categories.createSubcategory,
    "Subcategoria creada."
  );
  const deactivateMutation = useFinlogMutation(
    finlogApi.categories.deactivate,
    "Categoria desactivada."
  );
  const mergeMutation = useFinlogMutation(
    finlogApi.categories.merge,
    "Categoria fusionada."
  );
  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { kind: CATEGORY_KINDS.EXPENSE, name: "" },
  });
  const subcategoryForm = useForm<z.infer<typeof subcategorySchema>>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: { categoryId: "", name: "" },
  });

  return (
    <div className="finlog-page-stack">
      <PageHeader
        title="Categorias"
        description="Consulta y organiza categorías. La creación vive en acciones separadas para mantener limpia la lista."
      />
      <AppCard className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-medium text-foreground">Acciones</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Crea categorías o subcategorías sin sacar de foco la lista principal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>Nueva categoría</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva categoría</DialogTitle>
                <DialogDescription>
                  Define si pertenece a ingresos o gastos. Cada usuario mantiene su propio catálogo.
                </DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={categoryForm.handleSubmit(async (values) => {
                  await createMutation.mutateAsync(values);
                  categoryForm.reset({ ...values, name: "" });
                })}
              >
                <FormField label="Tipo">
                  <SelectInput {...categoryForm.register("kind")}>
                    <option value={CATEGORY_KINDS.EXPENSE}>Gasto</option>
                    <option value={CATEGORY_KINDS.INCOME}>Ingreso</option>
                  </SelectInput>
                </FormField>
                <FormField label="Nombre">
                  <TextInput {...categoryForm.register("name")} />
                </FormField>
                <div className="md:col-span-2">
                  <Button disabled={createMutation.isPending} type="submit">
                    Crear categoría
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Nueva subcategoría</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva subcategoría</DialogTitle>
                <DialogDescription>
                  Añade una división opcional dentro de una categoría existente.
                </DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={subcategoryForm.handleSubmit(async (values) => {
                  await subcategoryMutation.mutateAsync(values);
                  subcategoryForm.reset({ ...values, name: "" });
                })}
              >
                <FormField label="Categoría">
                  <SelectInput {...subcategoryForm.register("categoryId")}>
                    <option value="">Selecciona</option>
                    {(categoriesQuery.data ?? []).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Nombre">
                  <TextInput {...subcategoryForm.register("name")} />
                </FormField>
                <div className="md:col-span-2">
                  <Button disabled={subcategoryMutation.isPending} type="submit">
                    Crear subcategoría
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </AppCard>

      {false ? (
      <div className="grid gap-6 xl:grid-cols-2">
        <AppCard>
          <SectionTitle
            title="Nueva categoria"
            description="Cada usuario tiene sus propias categorias."
          />
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={categoryForm.handleSubmit(async (values) => {
              await createMutation.mutateAsync(values);
              categoryForm.reset({ ...values, name: "" });
            })}
          >
            <FormField label="Tipo">
              <SelectInput {...categoryForm.register("kind")}>
                <option value={CATEGORY_KINDS.EXPENSE}>Gasto</option>
                <option value={CATEGORY_KINDS.INCOME}>Ingreso</option>
              </SelectInput>
            </FormField>
            <FormField label="Nombre">
              <TextInput {...categoryForm.register("name")} />
            </FormField>
            <div className="md:col-span-2">
              <Button disabled={createMutation.isPending} type="submit">
                Crear categoria
              </Button>
            </div>
          </form>
        </AppCard>
        <AppCard>
          <SectionTitle
            title="Nueva subcategoria"
            description="Las subcategorias son opcionales."
          />
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={subcategoryForm.handleSubmit(async (values) => {
              await subcategoryMutation.mutateAsync(values);
              subcategoryForm.reset({ ...values, name: "" });
            })}
          >
            <FormField label="Categoria">
              <SelectInput {...subcategoryForm.register("categoryId")}>
                <option value="">Selecciona</option>
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Nombre">
              <TextInput {...subcategoryForm.register("name")} />
            </FormField>
            <div className="md:col-span-2">
              <Button disabled={subcategoryMutation.isPending} type="submit">
                Crear subcategoria
              </Button>
            </div>
          </form>
        </AppCard>
      </div>
      ) : null}
      <AppCard>
        <SectionTitle
          title="Lista de categorias"
          description="Puedes desactivar o fusionar categorias usadas."
        />
        <div className="grid gap-4">
          {(categoriesQuery.data ?? []).map((category) => (
            <div
              className="finlog-list-row"
              key={category.id}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-medium text-foreground">{category.name}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {category.kind} · {category.status}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {category.subcategories.length > 0
                      ? category.subcategories
                          .map((subcategory) => subcategory.name)
                          .join(", ")
                      : "Sin subcategorias"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      void deactivateMutation.mutateAsync(category.id)
                    }
                    variant="outline"
                  >
                    Desactivar
                  </Button>
                  <Button
                    onClick={() => {
                      const targetCategoryId = window.prompt(
                        "Ingresa el ID de la categoria destino para fusionar."
                      );
                      if (targetCategoryId) {
                        void mergeMutation.mutateAsync({
                          sourceCategoryId: category.id,
                          targetCategoryId,
                        });
                      }
                    }}
                    variant="outline"
                  >
                    Fusionar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AppCard>
    </div>
  );
}

function ReportsPage() {
  const accountsQuery = useQuery({
    queryKey: ["finlog", "accounts"],
    queryFn: () => finlogApi.accounts.list(),
  });
  const [filters, setFilters] = useState<ReportFiltersInput>({
    accountId: null,
    currency: "all",
    from: startOfMonth(),
    to: null,
  });
  const reportsQuery = useQuery({
    queryKey: ["finlog", "reports", filters],
    queryFn: () => finlogApi.reports.get(filters),
  });

  const reports = reportsQuery.data;
  return (
    <div className="finlog-page-stack">
      <PageHeader
        title="Reportes"
        description="Gastos por categoria, ingresos vs gastos, evolucion de saldo, metas y deudas."
      />
      <AppCard>
        <SectionTitle
          title="Filtros"
          description="Mes calendario por defecto, con opcion de rango personalizado."
        />
        <div className="grid gap-3 md:grid-cols-4">
          <SelectInput
            value={filters.accountId ?? ""}
            onChange={(event) =>
              setFilters((state) => ({
                ...state,
                accountId: event.target.value || null,
              }))
            }
          >
            <option value="">Todas las cuentas</option>
            {renderAccountOptions(accountsQuery.data ?? [])}
          </SelectInput>
          <SelectInput
            value={filters.currency}
            onChange={(event) =>
              setFilters((state) => ({
                ...state,
                currency: event.target.value as ReportFiltersInput["currency"],
              }))
            }
          >
            <option value="all">Todas las monedas</option>
            {renderCurrencyOptions()}
          </SelectInput>
          <TextInput
            type="date"
            value={filters.from ?? ""}
            onChange={(event) =>
              setFilters((state) => ({
                ...state,
                from: event.target.value || null,
              }))
            }
          />
          <TextInput
            type="date"
            value={filters.to ?? ""}
            onChange={(event) =>
              setFilters((state) => ({
                ...state,
                to: event.target.value || null,
              }))
            }
          />
        </div>
      </AppCard>

      {reports ? (
        <div className="grid gap-6">
          <AppCard>
            <SectionTitle
              title="Gastos por categoria"
              description="Totales agrupados por categoria de gasto."
            />
            <SimpleList
              rows={reports.expensesByCategory.map(
                (item) =>
                  `${item.categoryName}: ${formatMoneyValue(item.total)}`
              )}
            />
          </AppCard>
          <AppCard>
            <SectionTitle
              title="Ingresos vs gastos por mes"
              description="Comparativo mensual dentro del rango seleccionado."
            />
            <SimpleList
              rows={reports.incomeVsExpenseByMonth.map(
                (item) =>
                  `${item.month} · Ingresos: ${formatMoneyList(item.income)} · Gastos: ${formatMoneyList(item.expense)}`
              )}
            />
          </AppCard>
          <AppCard>
            <SectionTitle
              title="Evolucion de saldo por cuenta"
              description="Disponible cuando filtras una cuenta especifica."
            />
            <SimpleList
              rows={reports.accountBalanceEvolution.map(
                (item) => `${item.date}: ${formatMoneyValue(item.balance)}`
              )}
            />
          </AppCard>
          <AppCard>
            <SectionTitle
              title="Progreso de metas"
              description="Muestra objetivo, acumulado y porcentaje."
            />
            <SimpleList
              rows={reports.goalProgress.map(
                (item) =>
                  `${item.goalName}: ${formatMoneyValue(item.currentAmount)} / ${formatMoneyValue(item.targetAmount)} (${item.progressPercentage}%)`
              )}
            />
          </AppCard>
          <AppCard>
            <SectionTitle
              title="Deudas y por cobrar"
              description="Incluye vencidas y parcialmente pagadas calculadas."
            />
            <SimpleList
              rows={reports.debtStatus.map(
                (item) =>
                  `${item.personOrEntity}: ${formatMoneyValue(item.pendingAmount)} · ${item.direction} · Parcial: ${item.isPartiallyPaid ? "si" : "no"} · Vencida: ${item.isOverdue ? "si" : "no"}`
              )}
            />
          </AppCard>
        </div>
      ) : null}
    </div>
  );
}

function SettingsPage({ session }: { session: SessionDto }) {
  const profileQuery = useQuery({
    queryKey: ["finlog", "profile"],
    queryFn: () => finlogApi.auth.getProfile(),
  });
  const profileMutation = useFinlogMutation(
    async (values: z.infer<typeof profileSchema>) => {
      await finlogApi.settings.updateProfile({
        name: values.name,
        email: values.email,
      });
      return finlogApi.settings.updatePrimaryCurrency(values.primaryCurrency);
    },
    "Perfil actualizado."
  );
  const passwordMutation = useFinlogMutation(
    finlogApi.auth.changePassword,
    "Contrasena actualizada."
  );
  const exportMutation = useFinlogMutation(
    finlogApi.settings.exportJson,
    "JSON exportado."
  );
  const importMutation = useFinlogMutation(
    finlogApi.settings.importJson,
    "JSON importado y reemplazado."
  );
  const backupMutation = useFinlogMutation(
    finlogApi.settings.createBackup,
    "Backup SQLite creado."
  );
  const restoreMutation = useFinlogMutation(
    finlogApi.settings.restoreBackup,
    "Backup SQLite restaurado."
  );
  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      name: profileQuery.data?.name ?? session.name,
      email: profileQuery.data?.email ?? session.email,
      primaryCurrency:
        profileQuery.data?.primaryCurrency ??
        session.primaryCurrency ??
        CURRENCY_CODES.COP,
    },
  });
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  return (
    <div className="finlog-page-stack">
      <PageHeader
        title="Configuracion"
        description="Perfil, moneda principal, cambio de contrasena y operaciones de datos."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <AppCard>
          <SectionTitle
            title="Perfil"
            description="El correo sigue siendo identificador local del usuario."
          />
          <form
            className="grid gap-3"
            onSubmit={profileForm.handleSubmit(async (values) => {
              await profileMutation.mutateAsync(values);
            })}
          >
            <FormField label="Nombre">
              <TextInput {...profileForm.register("name")} />
            </FormField>
            <FormField label="Correo">
              <TextInput type="email" {...profileForm.register("email")} />
            </FormField>
            <FormField label="Moneda principal">
              <SelectInput {...profileForm.register("primaryCurrency")}>
                {renderCurrencyOptions()}
              </SelectInput>
            </FormField>
            <Button disabled={profileMutation.isPending} type="submit">
              Guardar perfil
            </Button>
          </form>
        </AppCard>
        <AppCard>
          <SectionTitle
            title="Cambiar contrasena"
            description="Solo disponible con sesion iniciada; no existe recuperacion en MVP."
          />
          <form
            className="grid gap-3"
            onSubmit={passwordForm.handleSubmit(async (values) => {
              await passwordMutation.mutateAsync(values);
              passwordForm.reset();
            })}
          >
            <FormField label="Contrasena actual">
              <TextInput
                type="password"
                {...passwordForm.register("currentPassword")}
              />
            </FormField>
            <FormField label="Nueva contrasena">
              <TextInput
                type="password"
                {...passwordForm.register("newPassword")}
              />
            </FormField>
            <FormField label="Confirmar nueva contrasena">
              <TextInput
                type="password"
                {...passwordForm.register("confirmNewPassword")}
              />
            </FormField>
            <Button disabled={passwordMutation.isPending} type="submit">
              Cambiar contrasena
            </Button>
          </form>
        </AppCard>
      </div>
      <AppCard>
        <SectionTitle
          title="Datos"
          description="Exporta o importa solo datos financieros del usuario actual; el backup SQLite es global."
        />
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => void exportMutation.mutateAsync(undefined)}
            variant="outline"
          >
            Exportar JSON
          </Button>
          <Button
            onClick={() => {
              if (
                window.confirm(
                  "Importar JSON reemplazara todos tus datos financieros actuales. Continuar?"
                )
              ) {
                void importMutation.mutateAsync(undefined);
              }
            }}
            variant="outline"
          >
            Importar JSON
          </Button>
          <Button
            onClick={() => void backupMutation.mutateAsync(undefined)}
            variant="outline"
          >
            Crear backup SQLite
          </Button>
          <Button
            onClick={() => {
              if (
                window.confirm(
                  "Restaurar SQLite reemplazara la base global actual. Continuar?"
                )
              ) {
                void restoreMutation.mutateAsync(undefined);
              }
            }}
            variant="outline"
          >
            Restaurar SQLite
          </Button>
        </div>
      </AppCard>
    </div>
  );
}

function DebtCard({
  debt,
  accountOptions,
  cancelMutation,
  archiveMutation,
}: {
  debt: DebtDto;
  accountOptions: AccountDto[];
  cancelMutation: (debtId: string) => Promise<void>;
  archiveMutation: (debtId: string) => Promise<void>;
}) {
  const paymentMutation = useFinlogMutation(
    debt.direction === DEBT_DIRECTIONS.PAYABLE
      ? finlogApi.debts.registerPayment
      : finlogApi.debts.registerCollection,
    debt.direction === DEBT_DIRECTIONS.PAYABLE
      ? "Pago registrado."
      : "Cobro registrado."
  );
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");

  return (
    <AppCard>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-medium text-foreground">{debt.personOrEntity}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {debt.direction === DEBT_DIRECTIONS.PAYABLE
              ? "Yo debo"
              : "Me deben"}{" "}
            · {debt.status} · {debt.dueDate ?? "Sin vencimiento"}
          </p>
          <p className="text-sm text-foreground">
            Pendiente: {formatMoneyValue(debt.pendingAmount)}
          </p>
          <p className="text-sm text-muted-foreground">
            Vencida: {debt.isOverdue ? "Si" : "No"} · Parcial:{" "}
            {debt.isPartiallyPaid ? "Si" : "No"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void cancelMutation(debt.id)}
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void archiveMutation(debt.id)}
            variant="outline"
          >
            Archivar
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SelectInput
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">Cuenta</option>
          {renderAccountOptions(
            accountOptions.filter(
              (account) => account.currency === debt.pendingAmount.currency
            )
          )}
        </SelectInput>
        <TextInput
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Monto"
          value={amount}
        />
        <TextInput
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
        <TextInput
          onChange={(event) => setNote(event.target.value)}
          placeholder="Nota opcional"
          value={note}
        />
      </div>
      <div className="mt-4">
        <Button
          onClick={() =>
            void paymentMutation.mutateAsync({
              debtId: debt.id,
              accountId,
              amount: parseAmountInput(amount, debt.pendingAmount.currency),
              date,
              note,
              description:
                debt.direction === DEBT_DIRECTIONS.PAYABLE
                  ? "Pago de deuda"
                  : "Cobro de deuda",
            })
          }
        >
          {debt.direction === DEBT_DIRECTIONS.PAYABLE
            ? "Registrar pago"
            : "Registrar cobro"}
        </Button>
      </div>
    </AppCard>
  );
}

function GoalCard({
  goal,
  accountOptions,
  cancelMutation,
  archiveMutation,
}: {
  goal: SavingsGoalDto;
  accountOptions: AccountDto[];
  cancelMutation: (goalId: string) => Promise<void>;
  archiveMutation: (goalId: string) => Promise<void>;
}) {
  const mutation = useFinlogMutation(
    async (payload: {
      type: "contribute" | "release";
      accountId: string;
      amount: string;
      date: string;
      note: string;
    }) => {
      const account = accountOptions.find(
        (item) => item.id === payload.accountId
      );
      if (!account) {
        throw new Error("Cuenta invalida.");
      }
      const request = {
        goalId: goal.id,
        accountId: payload.accountId,
        amount: parseAmountInput(payload.amount, account.currency),
        date: payload.date,
        note: payload.note,
        description:
          payload.type === "contribute"
            ? "Aporte a meta"
            : "Liberacion de meta",
      };
      return payload.type === "contribute"
        ? finlogApi.goals.contribute(request)
        : finlogApi.goals.release(request);
    },
    "Meta actualizada."
  );
  const [accountId, setAccountId] = useState(goal.accountId);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");

  return (
    <AppCard>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-medium text-foreground">{goal.name}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {goal.type} · {goal.status}
          </p>
          <p className="text-sm text-foreground">
            {formatMoneyValue(goal.currentAmount)} /{" "}
            {formatMoneyValue(goal.targetAmount)}
          </p>
          <p className="text-sm text-muted-foreground">
            Progreso: {goal.progressPercentage}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void cancelMutation(goal.id)}
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void archiveMutation(goal.id)}
            variant="outline"
          >
            Archivar
          </Button>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-full bg-muted/70">
        <div
          className="h-2 rounded-full bg-primary transition-[width]"
          style={{ width: `${Math.min(goal.progressPercentage, 100)}%` }}
        />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SelectInput
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">Cuenta</option>
          {renderAccountOptions(
            accountOptions.filter(
              (account) => account.currency === goal.targetAmount.currency
            )
          )}
        </SelectInput>
        <TextInput
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Monto"
          value={amount}
        />
        <TextInput
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
        <TextInput
          onChange={(event) => setNote(event.target.value)}
          placeholder="Nota opcional"
          value={note}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          onClick={() =>
            void mutation.mutateAsync({
              type: "contribute",
              accountId,
              amount,
              date,
              note,
            })
          }
        >
          Aportar
        </Button>
        <Button
          onClick={() =>
            void mutation.mutateAsync({
              type: "release",
              accountId,
              amount,
              date,
              note,
            })
          }
          variant="outline"
        >
          Liberar
        </Button>
      </div>
    </AppCard>
  );
}

function TransactionsTable({
  transactions,
  accounts = [],
  categories = [],
  onEdit,
  onDelete,
}: {
  transactions: TransactionDto[];
  accounts?: AccountDto[];
  categories?: CategoryDto[];
  onEdit?: (transaction: TransactionDto) => Promise<void>;
  onDelete?: (transactionId: string) => Promise<void>;
}) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {finlogMessages.app.noData}
      </p>
    );
  }

  return (
    <div className="finlog-table overflow-x-auto">
      <div className="grid min-w-[980px] grid-cols-[140px_1.3fr_1fr_1fr_160px_120px] gap-3 border-b border-border/70 bg-muted/35 px-4 py-3 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        <span>Fecha</span>
        <span>Tipo</span>
        <span>Cuenta</span>
        <span>Categoria</span>
        <span>Monto</span>
        <span>Acciones</span>
      </div>
      {transactions.map((transaction) => (
        <div
          className="finlog-table-row grid min-w-[980px] grid-cols-[140px_1.3fr_1fr_1fr_160px_120px] gap-3 px-4 py-4 text-sm"
          key={transaction.id}
        >
          <div>
            <p className="font-medium text-foreground">
              {formatDisplayDate(transaction.date)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatRelativeDateLabel(transaction.date)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {transaction.type}
            </p>
            <p className="text-sm text-foreground">
              {transaction.description || transaction.note || "Sin descripción adicional"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {getAccountLabel(accounts, transaction.accountId)}
            </p>
            <p className="text-xs text-muted-foreground">
              {transaction.destinationAccountId
                ? `Destino: ${getAccountLabel(accounts, transaction.destinationAccountId)}`
                : "Cuenta origen"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {getCategoryLabel(categories, transaction.categoryId)}
            </p>
            <p className="text-xs text-muted-foreground">
              {getSubcategoryLabel(categories, transaction.subcategoryId)}
            </p>
          </div>
          <span className="text-sm font-medium text-foreground">{formatMoneyValue(transaction.amount)}</span>
          <div className="flex gap-2">
            {onEdit ? (
              <button
                className="text-xs text-primary underline-offset-4 hover:underline"
                onClick={() => void onEdit(transaction)}
                type="button"
              >
                Editar
              </button>
            ) : null}
            {onDelete ? (
              <button
                className="text-xs text-destructive underline-offset-4 hover:underline"
                onClick={() => void onDelete(transaction.id)}
                type="button"
              >
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  title,
  values,
}: {
  title: string;
  values: Array<{ amount: number; currency: CurrencyCode }>;
}) {
  return (
    <AppCard className="min-h-[156px]">
      <p className="text-sm font-medium text-muted-foreground">
        {title}
      </p>
      <div className="mt-4 space-y-2">
        {values.length > 0 ? (
          values.map((value) => (
            <p
              className="finlog-display text-3xl text-foreground"
              key={`${title}-${value.currency}`}
            >
              {formatMoneyValue(value)}
            </p>
          ))
        ) : (
          <p className="finlog-display text-3xl text-foreground">0</p>
        )}
      </div>
    </AppCard>
  );
}

function AppCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "finlog-card p-6 lg:p-7",
        className
      )}
    >
      {children}
    </section>
  );
}

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="space-y-3">
      <div className="space-y-3">
        <h1 className="finlog-display max-w-4xl text-4xl text-foreground lg:text-6xl">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground [text-wrap:pretty]">
          {description}
        </p>
      </div>
    </header>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 space-y-2 border-b border-border/70 pb-4">
      <h2 className="text-xl font-medium text-foreground">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground [text-wrap:pretty]">
        {description}
      </p>
    </div>
  );
}

function FormField({
  label,
  children,
  error,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("finlog-field grid", className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs leading-5 text-muted-foreground">{hint}</span>
      ) : null}
      {error ? (
        <span className="text-xs leading-5 text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function TextInput(props: ComponentProps<"input">) {
  return <Input {...props} />;
}

function TextArea(props: ComponentProps<"textarea">) {
  return <Textarea {...props} />;
}

function SelectInput(props: ComponentProps<"select">) {
  return <Select {...props} />;
}

function FullscreenMessage({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "finlog-shell flex items-center justify-center bg-background px-4 text-foreground",
        compact ? "min-h-[320px]" : "min-h-dvh"
      )}
    >
      <div className="finlog-card max-w-xl px-8 py-10 text-center">
        <div className="mt-5 space-y-3">
          <p className="finlog-display text-4xl text-foreground">{title}</p>
          <p className="text-sm leading-7 text-muted-foreground [text-wrap:pretty]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function AuthFeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="finlog-list-row">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function SimpleList({ rows }: { rows: string[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {finlogMessages.app.noData}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row, index) => (
        <div
          className="finlog-list-row"
          key={`${row}-${index}`}
        >
          {row}
        </div>
      ))}
    </div>
  );
}

function renderCurrencyOptions() {
  return Object.values(CURRENCY_CODES).map((currency) => (
    <option key={currency} value={currency}>
      {currency}
    </option>
  ));
}

function renderAccountTypeOptions() {
  return (
    <>
      <option value={ACCOUNT_TYPES.BANK}>Cuenta bancaria</option>
      <option value={ACCOUNT_TYPES.CASH}>Efectivo</option>
      <option value={ACCOUNT_TYPES.DIGITAL_WALLET}>Billetera digital</option>
      <option value={ACCOUNT_TYPES.CREDIT_CARD}>Tarjeta de credito</option>
      <option value={ACCOUNT_TYPES.SAVINGS_POCKET}>Ahorro separado</option>
      <option value={ACCOUNT_TYPES.PIGGY_BANK}>Alcancia</option>
      <option value={ACCOUNT_TYPES.DIGITAL_USD}>
        Cuenta en dolares digitales
      </option>
    </>
  );
}

function renderAccountOptions(accounts: AccountDto[]) {
  return accounts.map((account) => (
    <option key={account.id} value={account.id}>
      {account.name} · {account.currency}
    </option>
  ));
}

function tabButtonClass(isActive: boolean) {
  return cn(
    "flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
    isActive
      ? "bg-card text-foreground"
      : "text-muted-foreground hover:text-foreground"
  );
}

function getAccountLabel(accounts: AccountDto[], accountId: string | null) {
  if (!accountId) {
    return "Sin cuenta";
  }

  const account = accounts.find((item) => item.id === accountId);

  if (!account) {
    return "Cuenta no encontrada";
  }

  return account.name;
}

function getCategoryLabel(categories: CategoryDto[], categoryId: string | null) {
  if (!categoryId) {
    return "Sin categoría";
  }

  const category = categories.find((item) => item.id === categoryId);

  if (!category) {
    return "Categoría no encontrada";
  }

  return category.name;
}

function getSubcategoryLabel(
  categories: CategoryDto[],
  subcategoryId: string | null
) {
  if (!subcategoryId) {
    return "Sin subcategoría";
  }

  const subcategory = categories
    .flatMap((category) => category.subcategories)
    .find((item) => item.id === subcategoryId);

  if (!subcategory) {
    return "Subcategoría no encontrada";
  }

  return subcategory.name;
}

function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRelativeDateLabel(value: string) {
  const date = parseIsoDate(value);
  const today = parseIsoDate(todayIso());
  const differenceInDays = Math.round(
    (date.getTime() - today.getTime()) / 86_400_000
  );

  if (differenceInDays === 0) {
    return "Hoy";
  }

  if (differenceInDays === -1) {
    return "Ayer";
  }

  if (differenceInDays === 1) {
    return "Mañana";
  }

  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
  }).format(date);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isValidIsoDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return false;
  }

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatAmountInput(value: string) {
  const sanitized = value.replace(/[^\d,]/g, "");
  const [integerPart = "", decimalPart] = sanitized.split(",");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  const groupedInteger = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (decimalPart !== undefined) {
    return `${groupedInteger || "0"},${decimalPart.slice(0, 2)}`;
  }

  return groupedInteger;
}

function parseFormattedAmountInput(value: string) {
  const normalized = value.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".");
  return Number(normalized);
}

function parseAmountInput(value: string, currency: CurrencyCode) {
  const numeric = parseFormattedAmountInput(value);
  if (!Number.isFinite(numeric)) {
    throw new Error("El monto ingresado no es valido.");
  }

  const scale = currency === CURRENCY_CODES.COP ? 0 : 2;
  return Math.round(numeric * 10 ** scale);
}

function parseSignedAmountInput(value: string, currency: CurrencyCode) {
  const numeric = parseFormattedAmountInput(value);
  if (!Number.isFinite(numeric)) {
    throw new Error("El monto ingresado no es valido.");
  }
  const scale = currency === CURRENCY_CODES.COP ? 0 : 2;
  return Math.round(numeric * 10 ** scale);
}

function parseOptionalInteger(value?: string) {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function startOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function formatMoneyList(
  values: Array<{ amount: number; currency: CurrencyCode }>
) {
  if (values.length === 0) {
    return "0";
  }

  return values.map((value) => formatMoneyValue(value)).join(" | ");
}

type MovementFormValues = z.infer<typeof movementSchema>;
type TransactionFilters = Parameters<typeof finlogApi.transactions.list>[0];
