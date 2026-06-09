# Sitemap — Finlog

## 1. Autenticación

### 1.1 Login

Secciones:

- Correo.
- Contraseña.
- Acción: iniciar sesión.
- Acción: crear usuario.
- Mensaje informativo: no hay recuperación de contraseña en MVP.

### 1.2 Registro

Secciones:

- Nombre.
- Correo.
- Contraseña.
- Confirmar contraseña.
- Aviso de contraseña no recuperable.
- Acción: crear usuario.

### 1.3 Cambio de contraseña

Disponible solo con sesión iniciada.

Secciones:

- Contraseña actual.
- Nueva contraseña.
- Confirmar nueva contraseña.
- Acción: guardar cambio.

## 2. Onboarding

### 2.1 Crear usuario

- Nombre.
- Correo.
- Contraseña.

### 2.2 Configuración inicial

- Moneda principal.

### 2.3 Crear cuentas iniciales

Por cada cuenta:

- Nombre.
- Tipo.
- Moneda.
- Saldo inicial.
- Fecha de corte, si aplica.
- Fecha límite de pago, si aplica.

### 2.4 Categorías iniciales

- Cargar plantilla por defecto.
- Informar que pueden editarse luego.

### 2.5 Finalización

- Acción: ir al dashboard.

## 3. Dashboard

### 3.1 Resumen superior

- Disponible libre.
- Balance del mes.
- Gastos del mes.

### 3.2 Filtros

- Todas las cuentas.
- Cuenta específica.
- Moneda.
- Periodo.

### 3.3 Bloques principales

- Deudas pendientes.
- Por cobrar.
- Metas de ahorro.
- Últimos movimientos.

### 3.4 Acciones rápidas

- Nuevo gasto.
- Nuevo ingreso.
- Nuevo movimiento.

## 4. Movimientos

### 4.1 Lista de movimientos

Columnas:

- Fecha.
- Tipo.
- Cuenta.
- Categoría.
- Monto.
- Moneda.
- Descripción.
- Acciones.

### 4.2 Filtros

- Fecha.
- Tipo.
- Cuenta.
- Categoría.
- Texto.
- Moneda.

### 4.3 Crear movimiento

Accesos rápidos:

- Nuevo gasto.
- Nuevo ingreso.

Desde “Nuevo movimiento”:

- Transferencia.
- Conversión manual.
- Ajuste de saldo.
- Pago de deuda.
- Cobro de deuda.
- Aporte a meta.
- Liberación/retiro de meta.

### 4.4 Editar movimiento

- Editar campos permitidos.
- Recalcular saldos afectados.

### 4.5 Eliminar movimiento

- Confirmación.
- Recalcular saldos afectados.

## 5. Cuentas

### 5.1 Lista de cuentas

- Nombre.
- Tipo.
- Moneda.
- Saldo.
- Estado.
- Acciones.

### 5.2 Crear cuenta

- Nombre.
- Tipo.
- Moneda.
- Saldo inicial.
- Campos de tarjeta si aplica.

### 5.3 Detalle de cuenta

- Saldo actual.
- Movimientos.
- Reservas/metas asociadas.
- Acciones disponibles.

### 5.4 Archivar o borrar cuenta

- Borrar si no tiene movimientos.
- Archivar si tiene movimientos.

## 6. Deudas

### 6.1 Vista principal

Tabs:

- Yo debo.
- Me deben.

### 6.2 Lista

- Persona/entidad.
- Monto total.
- Saldo pendiente.
- Estado.
- Vencimiento.
- Dirección.

### 6.3 Crear deuda/cuenta por cobrar

- Dirección.
- Persona/entidad.
- Monto.
- Moneda.
- Fecha opcional.
- Cuotas opcionales.
- Notas.

### 6.4 Detalle

- Datos generales.
- Historial de pagos/cobros.
- Saldo pendiente.
- Estado persistido.
- Estados calculados.

### 6.5 Registrar pago/cobro

- Cuenta.
- Monto.
- Fecha.
- Nota opcional.
- Validación de no superar saldo pendiente.

## 7. Metas

### 7.1 Lista

- Nombre.
- Tipo.
- Cuenta asociada.
- Objetivo.
- Acumulado.
- Progreso.
- Estado.

### 7.2 Crear meta

- Nombre.
- Objetivo.
- Moneda.
- Tipo: bolsillo/reserva o cuenta/alcancía.
- Cuenta asociada.

### 7.3 Detalle

- Progreso.
- Aportes.
- Retiros/liberaciones.
- Estado.

### 7.4 Acciones

- Aportar.
- Liberar/retirar.
- Cancelar.
- Archivar.

## 8. Categorías

### 8.1 Categorías de ingresos

- Lista.
- Crear.
- Editar.
- Desactivar.
- Fusionar.
- Gestionar subcategorías.

### 8.2 Categorías de gastos

- Lista.
- Crear.
- Editar.
- Desactivar.
- Fusionar.
- Gestionar subcategorías.

## 9. Reportes

### 9.1 Gastos por categoría

- Periodo.
- Cuenta opcional.
- Moneda.

### 9.2 Ingresos vs gastos

- Mes calendario por defecto.
- Rango personalizado.

### 9.3 Evolución de saldo por cuenta

- Cuenta.
- Periodo.

### 9.4 Progreso de metas

- Progreso por meta.
- Total reservado.

### 9.5 Deudas / por cobrar

- Total pendiente.
- Vencidas calculadas.
- Parcialmente pagadas calculadas.

## 10. Configuración

### 10.1 Perfil

- Nombre.
- Correo.
- Cambiar contraseña.

### 10.2 Datos

- Exportar JSON del usuario actual.
- Importar JSON para usuario actual.
- Backup SQLite.
- Restaurar SQLite.

### 10.3 Preferencias

- Moneda principal.
- Idioma: español.
