# Wallet Visit Card — especificación inicial del MVP

**Estado:** base funcional para iniciar diseño y desarrollo  
**Mercado inicial:** México  
**Producto:** SaaS multiempresa de programas de lealtad digitales

## 1. Visión

Permitir que negocios de distintos giros creen y administren programas de visitas/recompensas con tarjetas digitales de marca propia. El cliente podrá consultar su tarjeta y agregarla a Apple Wallet, Google Wallet o Samsung Wallet. El personal del negocio registrará visitas desde una interfaz rápida para mostrador.

## 2. Objetivos del MVP

- Que un negocio pueda registrarse, configurar su cuenta y crear una campaña sin asistencia técnica.
- Que un cliente pueda obtener una tarjeta en menos de un minuto, con teléfono o de forma anónima según la campaña.
- Que el empleado registre una visita con QR y datos del ticket sin navegar un flujo largo.
- Que el progreso y la recompensa se reflejen en el sistema y en los wallets soportados.
- Que propietarios y gerentes puedan controlar sucursales, personal, fraude, canjes y actividad.
- Que el alta y la contratación funcionen mediante Stripe con activación automática.

## 3. Actores y permisos

| Actor | Permisos principales |
|---|---|
| Propietario del negocio | Cuenta, facturación, sucursales, campañas, empleados, reportes y configuración total |
| Gerente | Operación de sucursal, campañas autorizadas, revisión de cancelaciones y canjes |
| Empleado | Buscar/escanear tarjeta, registrar visitas y canjear recompensas según permiso |
| Cliente | Consultar tarjeta, progreso, reglas y recompensa; guardar tarjeta en wallet |
| Administrador de plataforma | Soporte y operación global con acceso auditado y mínimo necesario |

Toda consulta y mutación de negocio debe estar limitada por tenant y permisos. Un tenant corresponde a una organización/negocio; puede tener varias sucursales, campañas y miembros.

## 4. Funcionalidad incluida

### 4.1 Alta y cuenta de negocio

- Registro autoservicio.
- Perfil de negocio: nombre comercial, logotipo, zona horaria, datos de contacto y preferencias.
- Crear sucursales y asignar empleados/gerentes.
- Suscripción Free o Premium, checkout y gestión de estado con Stripe.
- Activar o restringir capacidades de acuerdo con el plan vigente.

### 4.2 Campañas

Cada campaña debe poder configurar:

- Nombre, descripción y estado: borrador, activa, pausada, finalizada.
- Fechas de inicio y caducidad común de campaña.
- Sucursales participantes.
- Identificación permitida: teléfono, anónima o ambas.
- Número de visitas/sellos para completar.
- Regla de visita: importe mínimo y tiempo mínimo entre visitas.
- Premio fijo o premio aleatorio; los premios aleatorios se revelan al registrar la última visita.
- Reglas visibles para el cliente.
- Diseño mediante plantillas y marca del negocio; edición avanzada y lienzo libre según plan.

Al canjear una recompensa, la participación del cliente en esa campaña se cierra. La campaña puede seguir activa para otros clientes.

### 4.3 Cliente y tarjeta

- Inscripción por página pública del negocio o QR de mostrador.
- Modo anónimo sin exigir cuenta, cuando la campaña lo permita.
- Modo con número de teléfono, con verificación adecuada antes de permitir recuperación de cuenta.
- Identificador interno opaco y QR individual; no incluir teléfono ni datos sensibles dentro del QR.
- Vista móvil web de progreso, visitas restantes, recompensa, vigencia y reglas.
- Acciones para agregar la tarjeta a Apple Wallet, Google Wallet o Samsung Wallet, según compatibilidad/disponibilidad.
- La página web debe seguir disponible aunque el usuario no tenga una wallet compatible.

### 4.4 Registro de visitas

- Interfaz móvil de empleado para escanear QR; búsqueda manual como alternativa operativa.
- Mostrar campaña, número de visita actual, fecha de visitas anteriores pertinentes y estado de la recompensa.
- Capturar identificador/folio del ticket e importe.
- Rechazar duplicados, importe menor al mínimo, visita fuera de vigencia o dentro del intervalo bloqueado.
- Confirmación clara del resultado antes de terminar el flujo.
- Operación idempotente para evitar visitas duplicadas por doble toque o reintento de red.

### 4.5 Recompensas, cancelaciones y auditoría

- Desbloqueo de la recompensa al alcanzar la meta.
- Canje explícito por personal autorizado; marcar canje y terminar la participación individual.
- Cancelación de visita mediante solicitud y autorización de gerente.
- Historial append-only de visitas, cancelaciones, aprobaciones, canjes y cambios importantes de campaña.
- Guardar actor, tenant, sucursal, fecha, motivo, referencia de ticket y valores antes/después donde aplique.

### 4.6 Panel y métricas

- Resumen de visitas registradas, clientes inscritos, recompensas disponibles y canjes.
- Filtros por periodo, campaña y sucursal.
- Búsqueda de tarjeta/cliente y visualización del historial permitido por rol.
- Reportes avanzados, exportaciones e integraciones pueden limitarse a Premium.

## 5. Wallets: requisito de lanzamiento

El producto debe soportar Apple Wallet, Google Wallet y Samsung Wallet en el lanzamiento comercial. Cada wallet se implementará como adaptador separado sobre el mismo estado de campaña y tarjeta. Los trámites de partner, certificados, credenciales, publicación y pruebas deben iniciarse al comienzo del proyecto, en paralelo al desarrollo del núcleo; son dependencias de la fecha de lanzamiento.

- Los datos canónicos viven en el backend del SaaS; cada wallet recibe una representación sincronizada.
- Actualizar puntos/progreso y estado de premio al registrar visita o canje.
- Gestionar emisión, actualización, revocación y errores por proveedor.
- Mostrar al negocio el estado de conexión y cualquier acción pendiente, sin exponer detalles técnicos.
- No declarar listo el lanzamiento público de una wallet hasta que la emisión y actualización hayan sido validadas con una cuenta habilitada para producción.

## 6. Planes

Los límites exactos se fijarán después de validar costos y pilotos. La matriz inicial:

| Capacidad | Free | Premium |
|---|---|---|
| Campañas | Límite bajo | Límite superior |
| Sucursales y empleados | Límite bajo | Límite superior |
| Visitas mensuales | Cuota básica | Cuota superior |
| Premios aleatorios | No incluido o limitado | Incluido |
| Editor | Plantillas básicas | Editor avanzado/lienzo libre |
| Reportes y exportación | Básicos | Avanzados |
| Integraciones | Básicas | Ampliadas |

Los límites deben configurarse desde backend y aplicarse consistentemente en API y UI. Stripe gestiona suscripción y eventos; el producto conserva un estado local de entitlement para operar de forma fiable.

## 7. Modelo de dominio inicial

- `Tenant`: negocio/organización.
- `User`: identidad de acceso.
- `TenantMembership`: usuario, tenant, rol y alcance de sucursales.
- `Branch`: sucursal.
- `Campaign`: reglas, vigencia, estado y tema visual.
- `CampaignBranch`: sucursales habilitadas.
- `Customer`: perfil opcional con teléfono verificado o identificador anónimo.
- `Enrollment`: relación cliente-campaña, progreso y estado individual.
- `Visit`: evento inmutable con ticket, importe, sucursal y autor.
- `Reward`: premio asignado/desbloqueado y estado de canje.
- `WalletPass`: proveedor, referencia, estado de sincronización y versión.
- `AuditEvent`: acciones administrativas/operativas sensibles.
- `Subscription` y `PlanEntitlement`: suscripción y capacidades contratadas.

## 8. Arquitectura de referencia

- Aplicación web responsive con áreas diferenciadas para administración y punto de venta.
- API backend modular y base de datos relacional con aislamiento multi-tenant.
- Cola de trabajos para actualizaciones de wallet, notificaciones y reintentos.
- Almacenamiento de assets de marca con validación de tamaño/formato.
- Adaptadores independientes para Apple, Google y Samsung.
- Autenticación, autorización por rol y sucursal, rate limiting y trazabilidad.
- Secretos/certificados de wallets almacenados en un gestor de secretos; nunca en el frontend ni en repositorio.
- Webhooks firmados/idempotentes para Stripe.

## 9. Seguridad, privacidad y confiabilidad

- Minimización de datos: permitir campañas anónimas y recopilar teléfono solo cuando sea necesario.
- Aviso de privacidad, consentimiento, retención, eliminación y atención de derechos aplicables en México.
- Cifrado en tránsito y controles para datos personales en reposo.
- QR con token aleatorio revocable; nunca usar IDs secuenciales o PII.
- Permisos revisados en backend, no solo ocultando botones.
- Límites de frecuencia y validaciones contra replays/duplicados.
- Auditoría para ajustes y acceso de soporte.
- Backups probados, monitoreo de errores y alertas de fallos de sincronización.

## 10. Criterios de aceptación del MVP

1. Un negocio crea tenant, sucursal, empleados y campaña desde autoservicio.
2. Una campaña admite las modalidades de identidad configuradas y presenta sus términos al cliente.
3. Una tarjeta puede obtenerse desde móvil y su QR identifica una inscripción sin exponer PII.
4. Un empleado autorizado registra una visita válida una sola vez; las reglas bloquean ticket duplicado, importe insuficiente y visitas demasiado cercanas.
5. Al completar la meta, el premio se desbloquea; el canje cierra la participación y queda auditado.
6. Una cancelación requiere autorización de gerente y conserva trazabilidad.
7. El progreso se sincroniza a las tres wallets para el lanzamiento comercial aprobado.
8. Los límites de plan se aplican también al invocar la API directamente.
9. Los datos de un tenant no pueden ser consultados ni modificados por usuarios de otro tenant.
10. El flujo de suscripción actualiza el entitlement de forma idempotente ante reintentos de Stripe.

## 11. Fases de trabajo

1. **Cierre de producto:** validar reglas, glosario, roles, wireframes y límites iniciales.
2. **Accesos externos en paralelo:** abrir y completar onboarding de Apple, Google y Samsung; identificar certificados, cuentas y aprobaciones necesarias.
3. **Fundación:** repositorio, CI, entornos, autenticación, tenant isolation, base de datos y observabilidad.
4. **Operación MVP:** campañas, inscripción, tarjetas web, QR, visitas, recompensas, canjes y auditoría.
5. **Wallets:** emisión y sincronización por adaptador, pruebas de instalación/actualización y lanzamiento.
6. **SaaS comercial:** Stripe, planes, límites, onboarding y panel de métricas.
7. **Piloto:** probar con negocios reales, medir tiempo de registro, errores, repetición de visitas y conversión de alta.

## 12. Decisiones pendientes para implementación

- Stack y repositorio de código definitivo.
- Método de autenticación y verificación de teléfono.
- Si el ticket requiere solo folio, folio más foto o integración POS.
- Límites numéricos y precio de cada plan.
- Política de recuperación para tarjetas anónimas.
- Proveedor para SMS/OTP y notificaciones.
- SLA objetivo y política de retención de datos.

## 13. Métricas de validación

- Tiempo mediano de registro de una visita.
- Porcentaje de clientes que agregan la tarjeta a wallet.
- Porcentaje de campañas que registran actividad recurrente.
- Tasa de recompensas desbloqueadas y canjeadas.
- Tasa de tickets duplicados/rechazados y cancelaciones.
- Negocios que activan campaña y continúan después del primer ciclo.
- Costo operativo por negocio activo.
