# Roadmap y estado de implementación

## Implementado

- Registro de propietario y negocio, login con sesión opaca almacenada como hash.
- Aislamiento por tenant y verificación de roles en endpoints privados.
- Creación de campañas anónimas con fecha fija, objetivo, importe mínimo e intervalo mínimo.
- Emisión de tarjeta con token aleatorio, visualización pública y progreso.
- Visitas transaccionales con folio único, idempotencia y bloqueo de inscripción.
- Diseño móvil básico de la tarjeta.
- Canje de premio fijo, confirmación de entrega y estado final de la tarjeta.
- Solicitudes de cancelación con motivo; aprobación/rechazo de gerente o propietario.
- Historial operativo privado, eventos transaccionales e inmutabilidad de visitas y canjes.
- Pruebas de permisos, aislamiento, reintentos y carreras entre canje y cancelación con PostgreSQL en CI.

## Próximos incrementos

1. Gestión de empleados, gerentes y varias sucursales con permisos por sucursal. Los roles actuales se aplican a todo el negocio.
2. Clientes con teléfono verificado, recuperación segura y configuración de identidad por campaña.
3. Recompensas aleatorias y reportes; escáner QR por cámara en mostrador.
4. Adaptadores de Apple Wallet, Google Wallet y Samsung Wallet con emisión, sincronización y pruebas de producción. Abrir trámites y certificados en paralelo desde el comienzo; las tres son criterio de lanzamiento comercial.
5. Editor de plantillas, subida de imagen y lienzo libre con restricciones por proveedor.
6. Stripe, planes Free/Premium, límites transaccionales, onboarding y panel de administración.
7. Pilotos, monitoreo, backups restaurables y revisión de privacidad y seguridad antes de producción.

No active datos personales o tráfico comercial con esta rama. Falta verificación de teléfono, administración de roles y controles de operación para el lanzamiento.
