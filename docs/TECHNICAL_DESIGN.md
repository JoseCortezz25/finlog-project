# Documento técnico — Finlog

## 1. Stack

UI:

- React.
- Tailwind CSS.
- shadcn/ui.

Desktop:

- Electron.

Persistencia:

- SQLite local.
- `better-sqlite3`.

Arquitectura:

- DDD / Clean Architecture.
- Repository Pattern.
- IPC entre renderer y main process.

## 2. Arquitectura general

```txt
React Renderer
  ↓
Preload API
  ↓
IPC
  ↓
Application Use Cases en Main
  ↓
Repository Interfaces
  ↓
SQLite Repository Implementations
  ↓
SQLite local
```

## 3. Responsabilidades por capa

### 3.1 Renderer

Responsable de:

- UI.
- Formularios.
- Tablas.
- Dashboard.
- Validaciones ligeras de UX.
- Llamadas a `window.finlog`.

No debe:

- Tocar SQLite.
- Ejecutar SQL.
- Manejar filesystem directamente.
- Contener reglas críticas de dominio.

### 3.2 Preload

Responsable de:

- Exponer API segura al renderer.
- Usar `contextBridge`.
- Llamar a IPC.

Ejemplo conceptual:

```ts
window.finlog.transactions.createExpense(input)
```

### 3.3 Main

Responsable de:

- Casos de uso.
- Repositorios.
- Transacciones.
- SQLite.
- Filesystem.
- Backup/import/export.
- Validaciones críticas.

### 3.4 Domain

Responsable de:

- Entidades.
- Value objects.
- Reglas puras.
- Tipos de dominio.

No debe depender de:

- React.
- Electron.
- SQLite.
- Tailwind.
- shadcn/ui.

### 3.5 Application

Responsable de casos de uso:

- RegisterUserUseCase.
- LoginUserUseCase.
- CreateAccountUseCase.
- RegisterIncomeUseCase.
- RegisterExpenseUseCase.
- TransferBetweenAccountsUseCase.
- ConvertCurrencyManuallyUseCase.
- AdjustBalanceUseCase.
- PayDebtUseCase.
- CollectDebtUseCase.
- ContributeToGoalUseCase.
- ReleaseFromGoalUseCase.
- ExportUserDataUseCase.
- ImportUserDataUseCase.
- RecalculateBalancesUseCase.

### 3.6 Infrastructure

Responsable de implementaciones concretas:

- SQLite connection.
- Migraciones.
- Repositorios SQLite.
- Backup filesystem.
- Export/import JSON.

## 4. Estructura sugerida

```txt
src/
  shared/
    domain/
      money/
      users/
      accounts/
      transactions/
      categories/
      debts/
      goals/

  main/
    application/
      auth/
      accounts/
      transactions/
      categories/
      debts/
      goals/
      reports/
      backup/

    infrastructure/
      database/
        sqlite.ts
        migrations/
          001_initial_schema.sql
      repositories/
        sqlite-user.repository.ts
        sqlite-account.repository.ts
        sqlite-transaction.repository.ts
        sqlite-category.repository.ts
        sqlite-debt.repository.ts
        sqlite-goal.repository.ts

    ipc/
      auth.ipc.ts
      accounts.ipc.ts
      transactions.ipc.ts
      categories.ipc.ts
      debts.ipc.ts
      goals.ipc.ts
      reports.ipc.ts
      backup.ipc.ts

  preload/
    index.ts

  renderer/
    app/
    components/
    features/
      auth/
      onboarding/
      dashboard/
      movements/
      accounts/
      debts/
      goals/
      categories/
      reports/
      settings/
```

## 5. Base de datos

### 5.1 Librería

Usar `better-sqlite3` directo con repositorios manuales.

Motivos:

- Más control.
- Menos magia.
- Transacciones explícitas.
- Mejor encaje con repositorios.
- Suficiente para una app desktop local.

### 5.2 Migraciones

Usar migraciones SQL propias.

Tabla:

```txt
schema_migrations
- version
- applied_at
```

Archivos:

```txt
001_initial_schema.sql
002_add_x.sql
003_change_y.sql
```

Reglas:

- Ejecutar al iniciar app.
- Aplicar solo pendientes.
- Correr cada migración en transacción.
- Registrar versión aplicada.
- Si falla una migración, no dejar base a medias.

### 5.3 IDs

Usar UUIDs generados por la aplicación.

No depender de autoincrement como identidad de dominio.

### 5.4 Dinero

Guardar montos como enteros en unidad mínima.

Ejemplos:

- COP 10000 → `10000`.
- USD 12.34 → `1234`.

Nunca usar floats para dinero.

La moneda define escala.

## 6. IPC

IPC es la frontera entre UI y backend local.

Flujo esperado:

```txt
React component
  ↓
window.finlog.transactions.createExpense(input)
  ↓
preload / ipcRenderer.invoke
  ↓
main / ipcMain.handle
  ↓
use case
  ↓
repository
  ↓
SQLite
```

Reglas:

- Renderer no accede a SQLite.
- Renderer no ejecuta SQL.
- Main valida reglas críticas.
- Preload expone una API mínima y explícita.

## 7. Repositorios

Las interfaces deben vivir cerca de application/ports o domain según decisión final, pero las implementaciones SQLite viven en infrastructure.

Ejemplo conceptual:

```ts
interface AccountRepository {
  findById(id: AccountId): Promise<Account | null>
  save(account: Account): Promise<void>
}

class SqliteAccountRepository implements AccountRepository {
  // SQL y mapeos row <-> domain model
}
```

## 8. Transacciones

Operaciones que cambian más de una entidad deben ejecutarse en transacción SQLite.

Ejemplos:

- Registrar gasto: crear movimiento + actualizar saldo.
- Transferencia: crear movimiento + actualizar cuenta origen + actualizar cuenta destino.
- Pago de deuda: crear pago + reducir saldo cuenta + reducir pendiente deuda.
- Importar JSON: reemplazar datos del usuario actual de forma atómica.
- Recalcular saldos: actualizar cuentas afectadas de forma consistente.

## 9. Reglas críticas de dominio

1. Todo movimiento financiero debe impactar cuenta.
2. Saldo inicial no cuenta como ingreso.
3. Ajuste de saldo no cuenta como ingreso/gasto.
4. Pago de deuda no puede superar saldo pendiente.
5. Cobro de deuda no puede superar saldo pendiente.
6. Cuenta archivada no recibe nuevos movimientos.
7. Categoría usada no se borra directamente.
8. No se suman monedas distintas sin conversión.
9. Conversión manual requiere monto origen y monto destino.
10. Metas pueden superar 100%.
11. Si una meta completada baja por retiro, puede volver a activa.
12. JSON import reemplaza datos financieros del usuario actual.
13. Usuario autenticado solo accede a sus datos.
14. Contraseñas se guardan hasheadas, nunca en texto plano.

## 10. Riesgos técnicos

### 10.1 Saldos inconsistentes

Mitigación:

- Estrategia mixta de saldo almacenado + recalculado.
- Recalcular después de importaciones, restauraciones, ediciones y borrados.

### 10.2 Importación destructiva

Mitigación:

- Confirmación fuerte.
- Recomendar backup previo.
- Ejecutar importación en transacción.

### 10.3 IPC mal diseñado

Mitigación:

- API preload clara.
- DTOs explícitos.
- Validaciones críticas en main.

### 10.4 Dominio contaminado por SQLite

Mitigación:

- Repositorios.
- Mappers.
- Dominio sin imports de infraestructura.

### 10.5 Precisión monetaria incorrecta

Mitigación:

- Enteros en unidad mínima.
- Value object Money.
- Nunca floats.

### 10.6 Confusión entre autenticación y cifrado

Mitigación:

- Copy claro: autenticación local sin cifrado de base.
