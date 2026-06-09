# Entidades DDD — Finlog

Este documento baja el modelo de dominio inicial de Finlog. La intención es evitar un CRUD sin criterio. En una app financiera, las entidades no son tablas: representan reglas, identidad y comportamiento.

## 1. Bounded Context inicial

Para MVP se propone un único bounded context:

```txt
Personal Finance Management
```

Dentro de este contexto viven:

- usuarios locales,
- cuentas,
- movimientos,
- categorías,
- deudas/cuentas por cobrar,
- metas de ahorro,
- reportes derivados,
- backup/export/import por usuario.

Más adelante podrían separarse contextos como Auth, Reporting o Import/Export, pero para MVP conviene mantenerlos dentro de una arquitectura modular sin sobrediseñar.

## 2. Agregados principales

Agregados propuestos:

1. `User`.
2. `Account`.
3. `Transaction`.
4. `Category`.
5. `Debt`.
6. `SavingsGoal`.

Cada agregado debe proteger sus invariantes. OJO: no todo necesita ser un aggregate root gigante. El error típico es hacer un `User` que contiene todas las cuentas, movimientos, deudas y metas. Eso es una barbaridad para este caso. El usuario actúa como scope/owner, no como raíz de todo el universo.

## 3. Value Objects

### 3.1 Money

Representa un monto monetario.

Campos:

- `amount`: entero en unidad mínima.
- `currency`: código de moneda.

Reglas:

- Nunca usar floats.
- No sumar dinero de monedas distintas.
- La moneda define escala.

Ejemplos:

- COP 10,000 → `amount = 10000`, `currency = COP`.
- USD 12.34 → `amount = 1234`, `currency = USD`.

Operaciones:

- `add(other)` solo si misma moneda.
- `subtract(other)` solo si misma moneda.
- `isPositive()`.
- `isNegative()`.
- `isZero()`.

### 3.2 Currency

Representa una moneda soportada.

Campos:

- `code`: COP, USD, etc.
- `minorUnit`: cantidad de decimales.

Reglas:

- COP normalmente usa 0 decimales.
- USD usa 2 decimales.

### 3.3 Email

Representa correo de usuario.

Reglas:

- Debe tener formato válido.
- Debe ser único entre usuarios locales.

### 3.4 DateRange

Representa rango de fechas para reportes/filtros.

Reglas:

- `from <= to`.
- Mes calendario por defecto.

### 3.5 Percentage

Usado para progreso de metas.

Reglas:

- Puede superar 100%.

## 4. User Aggregate

### 4.1 Propósito

Representa un perfil local autenticable.

No representa una cuenta en nube.

### 4.2 Campos

- `id`: UUID.
- `name`.
- `email`: Email.
- `passwordHash`.
- `createdAt`.
- `updatedAt`.

### 4.3 Invariantes

- Email único localmente.
- Password nunca se guarda en texto plano.
- Cambio de contraseña requiere sesión autenticada y contraseña actual válida.
- No hay recuperación de contraseña en MVP.

### 4.4 Comportamientos

- `changePassword(currentPassword, newPassword)` vía caso de uso.
- `rename(name)`.
- `changeEmail(email)` si se permite después.

### 4.5 Repositorio

`UserRepository`:

- `findById(id)`.
- `findByEmail(email)`.
- `save(user)`.
- `emailExists(email)`.

## 5. Account Aggregate

### 5.1 Propósito

Representa un lugar donde existe dinero o deuda operativa.

Ejemplos:

- banco,
- efectivo,
- billetera digital,
- tarjeta de crédito,
- alcancía,
- cuenta USD digital.

### 5.2 Campos

- `id`: UUID.
- `userId`: UUID.
- `name`.
- `type`: `bank | cash | digital_wallet | credit_card | savings_pocket | piggy_bank | digital_usd`.
- `currency`: Currency.
- `balance`: Money.
- `status`: `active | archived`.
- `creditCardClosingDay?`.
- `creditCardDueDay?`.
- `createdAt`.
- `updatedAt`.

### 5.3 Invariantes

- Una cuenta pertenece a un usuario.
- Una cuenta archivada no puede recibir movimientos nuevos.
- Una cuenta con movimientos no se borra, solo se archiva.
- Una tarjeta de crédito puede tener saldo negativo.
- Cuenta no-tarjeta puede tener reglas más estrictas de saldo según futura decisión, pero MVP no bloquea saldos negativos universalmente.
- La moneda de la cuenta define la moneda de sus movimientos directos.

### 5.4 Comportamientos

- `archive()`.
- `rename(name)`.
- `applyDebit(money)`.
- `applyCredit(money)`.
- `recalculateBalance(transactions)` vía caso de uso.

### 5.5 Repositorio

`AccountRepository`:

- `findById(id, userId)`.
- `findByUser(userId)`.
- `save(account)`.
- `archive(id, userId)`.
- `hasTransactions(id)`.

## 6. Transaction Aggregate

### 6.1 Propósito

Representa un evento financiero que afecta una o más cuentas.

### 6.2 Tipos

- `income`.
- `expense`.
- `transfer`.
- `currency_conversion`.
- `opening_balance`.
- `balance_adjustment`.
- `debt_payment`.
- `debt_collection`.
- `goal_contribution`.
- `goal_release`.

### 6.3 Campos

- `id`: UUID.
- `userId`: UUID.
- `type`.
- `accountId`.
- `destinationAccountId?`.
- `amount`: Money.
- `destinationAmount?`: Money.
- `categoryId?`.
- `subcategoryId?`.
- `debtId?`.
- `goalId?`.
- `date`.
- `description?`.
- `note?`.
- `createdAt`.
- `updatedAt`.

### 6.4 Invariantes

- Todo movimiento debe pertenecer a un usuario.
- Todo movimiento debe impactar al menos una cuenta.
- Ingreso/gasto requieren categoría.
- Ingreso/gasto requieren cuenta, monto y fecha.
- Saldo inicial afecta saldo, pero no cuenta como ingreso/gasto.
- Ajuste de saldo requiere nota obligatoria.
- Transferencia requiere cuenta origen y destino.
- Conversión manual requiere cuenta origen, cuenta destino, monto origen y monto destino.
- Conversión manual puede tener monedas distintas.
- Transferencia normal debe mantener misma moneda, salvo que sea `currency_conversion`.
- Pago/cobro de deuda debe tener `debtId`.
- Aporte/liberación de meta debe tener `goalId`.

### 6.5 Comportamientos

En MVP, muchos comportamientos se orquestan desde casos de uso para manejar transacciones SQLite y saldos.

Casos típicos:

- `createIncome`.
- `createExpense`.
- `createTransfer`.
- `createOpeningBalance`.
- `createBalanceAdjustment`.
- `createCurrencyConversion`.

### 6.6 Repositorio

`TransactionRepository`:

- `findById(id, userId)`.
- `findByUser(userId, filters)`.
- `save(transaction)`.
- `delete(id, userId)`.
- `findByAccount(accountId, userId)`.
- `findByDateRange(userId, range)`.

## 7. Category Aggregate

### 7.1 Propósito

Clasifica ingresos y gastos para reportes.

### 7.2 Campos

`Category`:

- `id`: UUID.
- `userId`: UUID.
- `kind`: `income | expense`.
- `name`.
- `status`: `active | inactive`.
- `createdAt`.
- `updatedAt`.

`Subcategory`:

- `id`: UUID.
- `userId`: UUID.
- `categoryId`: UUID.
- `name`.
- `status`: `active | inactive`.
- `createdAt`.
- `updatedAt`.

### 7.3 Invariantes

- Una categoría pertenece a un usuario.
- Categorías de ingresos y gastos están separadas.
- Subcategoría pertenece a una categoría.
- No se debe usar una subcategoría de otra categoría.
- Categoría usada no se borra directamente.
- Categoría usada puede desactivarse o fusionarse.
- Categoría inactiva no aparece para nuevos movimientos.

### 7.4 Comportamientos

- `rename(name)`.
- `deactivate()`.
- `activate()` si se permite.
- `addSubcategory(name)`.
- `deactivateSubcategory(id)`.

### 7.5 Repositorio

`CategoryRepository`:

- `findByUser(userId)`.
- `findByKind(userId, kind)`.
- `save(category)`.
- `hasTransactions(categoryId)`.
- `deactivate(categoryId, userId)`.
- `merge(sourceCategoryId, targetCategoryId, userId)`.

## 8. Debt Aggregate

### 8.1 Propósito

Representa una obligación financiera con dirección.

Direcciones:

- `payable`: yo debo.
- `receivable`: me deben.

### 8.2 Campos

- `id`: UUID.
- `userId`: UUID.
- `direction`: `payable | receivable`.
- `personOrEntity`.
- `totalAmount`: Money.
- `pendingAmount`: Money.
- `status`: `active | paid | cancelled | archived`.
- `dueDate?`.
- `installmentsTotal?`.
- `installmentsPaid?`.
- `note?`.
- `createdAt`.
- `updatedAt`.

### 8.3 Invariantes

- Deuda pertenece a un usuario.
- `pendingAmount` no puede ser menor que cero.
- Pago/cobro no puede superar `pendingAmount`.
- `paid`/`collected` implica `pendingAmount = 0`.
- `partiallyPaid` es estado calculado, no persistido.
- `overdue` es estado calculado, no persistido.
- No hay intereses en MVP.
- Deuda archivada no recibe pagos/cobros nuevos, salvo decisión futura.

### 8.4 Comportamientos

- `registerPayment(amount)` para payable.
- `registerCollection(amount)` para receivable.
- `cancel()`.
- `archive()`.
- `markAsPaid()` cuando pending queda en cero.
- `isOverdue(today)` calculado.
- `isPartiallyPaid()` calculado.

### 8.5 Repositorio

`DebtRepository`:

- `findById(id, userId)`.
- `findByUser(userId)`.
- `findByDirection(userId, direction)`.
- `save(debt)`.
- `archive(id, userId)`.

## 9. DebtPayment Entity

### 9.1 Propósito

Representa un pago o cobro parcial/completo asociado a una deuda.

Puede modelarse como entidad hija del agregado `Debt` o como proyección vinculada a `Transaction`. Para MVP, conviene mantenerlo explícito para historial.

### 9.2 Campos

- `id`: UUID.
- `userId`: UUID.
- `debtId`: UUID.
- `transactionId`: UUID.
- `accountId`: UUID.
- `amount`: Money.
- `date`.
- `note?`.
- `createdAt`.

### 9.3 Invariantes

- Debe estar asociado a una deuda.
- Debe estar asociado a una transacción.
- Debe impactar una cuenta.
- No puede superar el saldo pendiente al momento de registrarse.

## 10. SavingsGoal Aggregate

### 10.1 Propósito

Representa una meta de ahorro.

Puede funcionar como:

- bolsillo/reserva dentro de una cuenta,
- cuenta/alcancía separada.

### 10.2 Campos

- `id`: UUID.
- `userId`: UUID.
- `name`.
- `type`: `pocket | separate_account`.
- `accountId`: UUID.
- `targetAmount`: Money.
- `currentAmount`: Money.
- `status`: `active | completed | cancelled | archived`.
- `createdAt`.
- `updatedAt`.

### 10.3 Invariantes

- Meta pertenece a un usuario.
- Meta tiene moneda coherente con la cuenta asociada.
- `currentAmount` no debe ser menor que cero.
- Se permite superar `targetAmount`.
- Si `currentAmount >= targetAmount`, la meta puede marcarse completada automáticamente.
- Si una meta completada baja por debajo del objetivo, puede volver a activa.
- No se permite mover directamente entre metas en MVP.

### 10.4 Comportamientos

- `contribute(amount)`.
- `release(amount)`.
- `complete()`.
- `cancel()`.
- `archive()`.
- `progress()`.

### 10.5 Repositorio

`SavingsGoalRepository`:

- `findById(id, userId)`.
- `findByUser(userId)`.
- `save(goal)`.
- `archive(id, userId)`.

## 11. UserSettings Entity

### 11.1 Propósito

Agrupa preferencias financieras y de UI por usuario.

### 11.2 Campos

- `id`: UUID.
- `userId`: UUID.
- `primaryCurrency`.
- `language`: `es`.
- `createdAt`.
- `updatedAt`.

### 11.3 Invariantes

- Un usuario tiene una configuración activa.
- MVP usa español.
- Moneda principal no obliga a que todas las cuentas usen esa moneda.

## 12. Export Package

### 12.1 Propósito

No es entidad persistida necesariamente, pero sí un objeto de dominio/aplicación importante para import/export.

### 12.2 Estructura conceptual

```json
{
  "version": "1.0",
  "exportedAt": "2026-05-30T00:00:00.000Z",
  "user": {
    "id": "uuid",
    "name": "Nombre",
    "email": "correo@local"
  },
  "settings": {},
  "accounts": [],
  "categories": [],
  "subcategories": [],
  "transactions": [],
  "debts": [],
  "debtPayments": [],
  "savingsGoals": []
}
```

### 12.3 Reglas

- No exporta contraseña.
- No exporta hash.
- No exporta sesiones.
- No exporta otros usuarios.
- Importar reemplaza datos financieros del usuario actual.
- Debe tener versión para migraciones futuras de formato.

## 13. Servicios de dominio candidatos

No todo debe meterse en entidades. Algunos comportamientos cruzan agregados.

### 13.1 BalanceRecalculator

Responsable de recalcular saldos desde movimientos.

Usos:

- después de importar,
- después de editar/borrar movimientos,
- reparación manual.

### 13.2 CurrencyConversionService

Responsable de validar conversión manual.

Reglas:

- origen y destino pueden tener monedas distintas,
- requiere monto origen y destino,
- tasa implícita es informativa.

### 13.3 ReportCalculator

Responsable de cálculos derivados:

- gastos por categoría,
- ingresos vs gastos,
- progreso de metas,
- deudas pendientes,
- vencidas calculadas.

Puede vivir inicialmente en application como queries/report services.

## 14. Casos de uso principales

### Auth

- `RegisterUserUseCase`.
- `LoginUserUseCase`.
- `LogoutUserUseCase`.
- `ChangePasswordUseCase`.

### Accounts

- `CreateAccountUseCase`.
- `ArchiveAccountUseCase`.
- `DeleteUnusedAccountUseCase`.
- `ListAccountsUseCase`.
- `RecalculateAccountBalanceUseCase`.

### Transactions

- `RegisterIncomeUseCase`.
- `RegisterExpenseUseCase`.
- `TransferBetweenAccountsUseCase`.
- `ConvertCurrencyManuallyUseCase`.
- `CreateOpeningBalanceUseCase`.
- `AdjustBalanceUseCase`.
- `EditTransactionUseCase`.
- `DeleteTransactionUseCase`.
- `ListTransactionsUseCase`.

### Categories

- `CreateCategoryUseCase`.
- `UpdateCategoryUseCase`.
- `DeactivateCategoryUseCase`.
- `MergeCategoryUseCase`.
- `CreateSubcategoryUseCase`.

### Debts

- `CreateDebtUseCase`.
- `RegisterDebtPaymentUseCase`.
- `RegisterDebtCollectionUseCase`.
- `CancelDebtUseCase`.
- `ArchiveDebtUseCase`.
- `ListDebtsUseCase`.

### Goals

- `CreateSavingsGoalUseCase`.
- `ContributeToGoalUseCase`.
- `ReleaseFromGoalUseCase`.
- `CancelGoalUseCase`.
- `ArchiveGoalUseCase`.
- `ListGoalsUseCase`.

### Backup / Export

- `ExportUserDataUseCase`.
- `ImportUserDataUseCase`.
- `CreateSqliteBackupUseCase`.
- `RestoreSqliteBackupUseCase`.

## 15. Reglas anti-corrupción

Estas reglas son importantes para que el dominio no se pudra:

1. No importar tipos de SQLite en domain.
2. No importar Electron en domain.
3. No ejecutar SQL desde renderer.
4. No poner lógica financiera crítica en componentes React.
5. No guardar dinero como float.
6. No usar IDs autoincrementales como identidad de dominio.
7. No mezclar monedas en cálculos agregados sin conversión explícita.
8. No contar `opening_balance` como ingreso.
9. No contar `balance_adjustment` como gasto/ingreso ordinario.
10. No borrar entidades usadas si rompen trazabilidad.
