# PRD — Finlog

## 1. Visión

Finlog es una aplicación desktop local-first para centralizar, organizar y visualizar las finanzas personales de uno o varios usuarios en el mismo computador.

El objetivo inicial es tener un lugar único, claro y trazable para entender el estado financiero personal sin depender de Excel, apps fragmentadas o memoria personal.

## 2. Problema principal

La información financiera personal suele estar dispersa entre bancos, billeteras digitales, efectivo, tarjetas de crédito, deudas, personas que deben dinero, metas de ahorro y hojas de cálculo.

Finlog debe ayudar a responder con claridad:

- ¿Cuánto dinero tengo disponible?
- ¿Dónde está mi dinero?
- ¿Cuánto gasté este mes?
- ¿Cuánto ingresé este mes?
- ¿Cuánto debo?
- ¿Cuánto me deben?
- ¿Cuánto tengo reservado para metas?
- ¿Estoy viendo todo unificado o una cuenta específica?

## 3. Usuario objetivo

- Persona que quiere manejar sus finanzas personales desde una app desktop.
- Quiere datos locales, no nube.
- Quiere control manual y trazabilidad.
- Maneja varias cuentas, tarjetas, deudas y metas.
- Puede compartir computador con otros usuarios, pero cada usuario debe tener información separada.

## 4. Principios del producto

1. **Local-first**: los datos viven en SQLite local.
2. **Trazabilidad antes que automatización**: todo se registra manualmente en MVP.
3. **Nada financiero queda flotando**: todo movimiento debe impactar una cuenta.
4. **Claridad antes que complejidad**: sin presupuestos, intereses, adjuntos o inversiones avanzadas en MVP.
5. **Honestidad financiera**: no mezclar monedas sin conversión; no contar saldos iniciales como ingresos.

## 5. Alcance MVP

### 5.1 Autenticación local

Incluye:

- Registro de usuario.
- Inicio de sesión.
- Cierre de sesión.
- Cambio de contraseña estando autenticado.
- Correo asociado.
- Contraseña hasheada.
- Datos financieros separados por usuario.

No incluye:

- Cifrado de base de datos.
- Recuperación de contraseña.
- Login social.
- Nube.
- Roles o permisos.
- 2FA.

> La autenticación protege acceso por UI y separa perfiles, pero no cifra el archivo SQLite.

### 5.2 Onboarding

Primer uso:

1. Crear usuario.
2. Configurar moneda principal.
3. Crear primeras cuentas.
4. Registrar saldos iniciales.
5. Cargar categorías por defecto editables.
6. Entrar al dashboard.

### 5.3 Cuentas

Tipos iniciales:

- Cuenta bancaria.
- Efectivo.
- Billetera digital.
- Tarjeta de crédito.
- Ahorro separado / alcancía.
- Cuenta en dólares digitales.

Reglas:

- Cuenta sin movimientos puede borrarse.
- Cuenta con movimientos solo puede archivarse.
- Cuenta archivada no aparece para nuevos movimientos.
- Cuenta archivada sí aparece en históricos/reportes donde corresponda.

### 5.4 Monedas

- Cada cuenta tiene su moneda.
- Los totales se muestran separados por moneda.
- No hay conversión automática.
- Las conversiones entre monedas se registran manualmente con monto origen y monto destino.

Ejemplo:

- Disponible COP: 2,000,000 COP.
- Disponible USD: 100 USD.

### 5.5 Movimientos

Tipos:

- Ingreso.
- Gasto.
- Transferencia.
- Conversión manual.
- Saldo inicial.
- Ajuste de saldo.
- Pago de deuda.
- Cobro de deuda.
- Aporte a meta.
- Liberación/retiro de meta.

Campos obligatorios para ingresos/gastos:

- Monto.
- Cuenta.
- Categoría.
- Fecha autocompletada.

Campos opcionales:

- Subcategoría.
- Descripción.
- Notas.

### 5.6 Saldo inicial

El saldo inicial es un tipo de movimiento propio.

No cuenta como:

- ingreso,
- gasto,
- transferencia.

Sí afecta:

- saldo de cuenta,
- recalculado histórico de saldos.

### 5.7 Ajustes de saldo

Permitidos en MVP.

Reglas:

- Requieren nota/motivo obligatorio.
- Afectan saldo.
- No cuentan como ingreso/gasto normal.
- Deben verse claramente como ajustes.

### 5.8 Categorías

- Categorías separadas para ingresos y gastos.
- Subcategorías opcionales.
- Categorías por defecto editables.
- Cada usuario tiene sus propias categorías.

Reglas de eliminación:

- Categoría sin movimientos: puede borrarse.
- Categoría usada: puede desactivarse o fusionarse/reemplazarse.

Categorías iniciales sugeridas:

Ingresos:

- Salario.
- Freelance.
- Ventas.
- Regalos.
- Reembolsos.
- Otros ingresos.

Gastos:

- Alimentación.
  - Mercado.
  - Restaurantes.
  - Domicilios.
- Transporte.
  - Gasolina.
  - Transporte público.
  - Apps de movilidad.
- Vivienda.
  - Arriendo.
  - Servicios.
  - Mantenimiento.
- Salud.
  - Medicamentos.
  - Citas médicas.
- Educación.
- Entretenimiento.
- Suscripciones.
- Deudas / pagos.
- Ahorro / metas.
- Otros gastos.

### 5.9 Deudas y cuentas por cobrar

Un único módulo conceptual con dirección:

- **Yo debo**: pasivo.
- **Me deben**: cuenta por cobrar.

Tipos:

- Deuda simple.
- Deuda con cuotas.
- Deuda de tarjeta derivada del saldo negativo de la tarjeta.

Estados persistidos:

- Activa.
- Pagada/cobrada.
- Cancelada.
- Archivada.

Estados calculados:

- Parcialmente pagada.
- Vencida.

Reglas:

- Se permiten pagos/cobros parciales.
- Un pago/cobro no puede superar el saldo pendiente.
- No se modelan intereses en MVP.

### 5.10 Tarjetas de crédito

Modelo híbrido:

- La tarjeta funciona como cuenta con saldo negativo.
- Puede tener fecha de corte opcional.
- Puede tener fecha límite de pago opcional.

No incluye:

- Intereses.
- Pago mínimo.
- Amortización.
- Cuotas avanzadas.

### 5.11 Metas de ahorro

Modelo mixto:

1. Meta como bolsillo/reserva dentro de una cuenta.
2. Meta como cuenta/alcancía separada.

Estados:

- Activa.
- Completada.
- Cancelada.
- Archivada.

Operaciones MVP:

- Aportar a meta.
- Liberar/retirar de meta.

Reglas:

- Se permite superar el objetivo.
- Si acumulado >= objetivo, queda completada.
- Puede mostrar progreso mayor a 100%.
- No se permite mover directamente entre metas en MVP.

### 5.12 Dashboard

Debe mostrar:

1. Disponible libre.
2. Balance del mes.
3. Gastos del mes.
4. Deudas pendientes.
5. Por cobrar.
6. Metas de ahorro.
7. Últimos movimientos.

Debe permitir:

- Vista unificada.
- Filtro por cuenta.
- Filtro por moneda cuando aplique.

### 5.13 Reportes MVP

Incluidos:

- Gastos por categoría.
- Ingresos vs gastos por mes.
- Evolución de saldo por cuenta.
- Progreso de metas.
- Deudas y por cobrar pendientes.

Periodos:

- Mes calendario por defecto.
- Rango de fechas modificable.

### 5.14 Backup / Import / Export

#### Backup SQLite

- Copia/restauración directa de la base SQLite.
- Es global de toda la app.

#### JSON por usuario

Exporta solo datos financieros del usuario actual:

- Cuentas.
- Movimientos.
- Categorías/subcategorías.
- Deudas/por cobrar.
- Metas.
- Configuraciones financieras.

No exporta:

- Contraseña.
- Hash de contraseña.
- Sesiones.
- Otros usuarios.

Importación JSON:

- Aplica solo al usuario autenticado.
- Reemplaza sus datos financieros actuales.
- No mezcla datos.
- Requiere confirmación fuerte.

### 5.15 Idioma

El MVP estará completamente en español.

## 6. Fuera del MVP

- Presupuestos.
- Movimientos recurrentes.
- Adjuntos/comprobantes.
- Intereses.
- Amortización.
- Importación bancaria.
- Sincronización en nube.
- Cifrado de base de datos.
- Recuperación de contraseña.
- CSV.
- PDF.
- Inversiones avanzadas.
- Notificaciones.
- Multi-idioma.
- Roles/permisos.
- 2FA.
- Command palette.
- Widgets.
