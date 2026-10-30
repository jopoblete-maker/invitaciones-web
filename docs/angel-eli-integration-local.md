# Ángel y Eli: integración local — 30 de octubre de 2026

## Resultado

Worktree: `C:/Users/poble/OneDrive/Desktop/invitaciones-web-integracion-angel-eli`.
Rama: `integracion/angel-eli`. Base: main `76c546f77ee7d7209cdb7e17dfe3d89f332cfee2`.
Cherry-picks aplicados sin conflictos, exclusivamente y en orden:

| Original | Commit integrado |
| --- | --- |
| f55ca5e1e54495d1214ed3cc6d8561cbc6016d15 | ae7ca225c53f1fb83f949be208aa2e4c0b4311cc |
| 0f3bcb990dea86e29793782b919da771b27351c6 | 22bf4b6c61a16f3af14cc9ff76e95526265cc4bd |

No se integraron los commits de catálogo/comercial ni toda la rama cliente.
Los worktrees existentes y main se conservan. No se hicieron fetch, push,
merge, deploy, publicación ni operaciones SQL/Supabase.

## Referencias y antigüedad

main está un commit por delante del origin/main almacenado
`c3e4672d8e8dfdba5b4125e0e29bb777a2f167ee`, sin commits exclusivos de esa
referencia remota local. Su reflog registra la última actualización el
15/10/2026 a las 17:36:33 -0300 (aproximadamente 15 días antes de esta revisión).
La marca local de FETCH_HEAD del 29/10 no acredita que origin/main se haya
actualizado ni informa qué rama se consultó. No se consultó el remoto real.
Antes de cualquier integración remota habrá que autorizar fetch y conciliar
las referencias; esta preparación se basa únicamente en el main local pedido.

El worktree de main conserva sin tocar sus recursos no seguidos
`assets/templates/boda-fiesta-premium/cierre-premium.webp` y
`assets/templates/boda-fiesta-premium/ornamento-floral.svg`.

## Validación y conservación del ajuste

Suite completa: Node 22.23.4, `node.exe --test`, 112 aprobadas de 112.
Incluye Kaly y Joha, Civil, Premium y endurecimiento editorial. No se afirma
una nueva validación visual en Chrome ni pruebas contra producción.
Se usaron las dependencias ya instaladas mediante NODE_PATH hacia el worktree
cliente; no se copiaron credenciales ni archivos .dev/premium.

El primer intento dio 111/112: la aserción de aislamiento esperaba el hash de
static-policy.js en la rama cliente. Se revisó la diferencia: esa rama tiene
entradas de catálogo/comercial ajenas y carece de la entrada editorial nueva.
La política integrada permanece exactamente igual a main. Solo se ajustó
`test/angel-eli-local.test.js` al hash b1690c0a56ab59351883ae18839eea5c251f77454f9b17359dce1a8efb4acc66,
con comentario de procedencia. No se cambió la allowlist ni se abrió ningún
recurso nuevo. Este ajuste y el presente informe se conservan en un tercer
commit local específico, autorizado el 30/10/2026, después de los dos cherry-picks.

`git diff --check` y revisión del diff de integración sin errores de espacios.
Backend, server.js y protecciones editoriales permanecen idénticos a main.
Los recursos, CSS, presentación, textos, nueve secciones, videos, Drive y firma
aprobados se conservan; no se cambia el diseño. No se modifican archivos de
Kaly y Joha ni Civil. La cantidad de tests difiere de los 117 de cliente porque
no se integra su historial de catálogo/comercial y se usa la suite de main
más las pruebas específicas de esta entrega.

Logs locales fuera del repositorio:
`%TEMP%/angel-eli-integration-node22.log` (diagnóstico inicial) y
`%TEMP%/angel-eli-integration-node22-final.log` (112/112).

## Habilitación futura: archivos y decisiones pendientes

No se implementó habilitación productiva. Sigue vigente la sección 5 de
`angel-eli-publication-readiness.md`, salvo su bloqueo de integración/hash,
resuelto localmente como se documenta arriba. El informe anterior se conserva
como registro del cierre cliente; sus afirmaciones de integración pendiente
son históricas frente a este informe.

- Presentación pública y preview editorial: revisar
  `js/events/angel-eli-presentation.js`, `js/core/invitation-data-source.js`,
  `js/invitacion.js`, `js/core/public-event-resolver.js` y `server.js`.
  Definir y emitir un perfil confiable desde servidor para el evento autorizado,
  también en preview firmada; hoy el adaptador exige local-premium y loopback.
  No aceptar permisos declarados por el propio contenido ni abrir otros eventos.
- Recursos: `backend/http/static-policy.js` necesita 19 rutas exactas
  (17 multimedia ya versionados, CSS y JS del evento). Preservar las reglas de
  main, la entrada editorial y el bloqueo de .dev; probar Range de MP4.
- Contrato y snapshot: `scripts/angel-eli-preview-profile.js` y
  `js/events/angel-eli-presentation.js` contienen la presentación local. Preparar
  contenido versionado coherente con la transformación final: eliminar la foto
  duplicada, incluir Caminata después de Carpeta, horario final y Drive.
  El snapshot privado actual no equivale por sí solo a las nueve secciones
  visuales aprobadas. No copiarlo a Git ni publicarlo sin reconciliar el contrato.
- Autorización Premium: configuración operativa privada para el digest definitivo,
  usando los contratos de `backend/premium/authorization-provider.js`,
  `backend/premium/startup-authorization-check.js` y
  `backend/premium/write-boundary.js`; preservar otras autorizaciones y revocaciones.
  No requieren cambios automáticos en esos módulos ni acceso directo a la base.
- Publicación: usar la API editorial autenticada y las precondiciones de main
  (`js/core/event-version-editorial-http.js`,
  `js/core/event-version-editorial-service.js`,
  `js/core/admin-editorial-client.js`), según la receta del informe base.
  El CLI `scripts/publish-event-draft.js` sigue sin ser una ruta Premium lista;
  no usar legacy/overwrite como atajo. Publicar es una operación futura separada.
- Pruebas futuras: ampliar `test/public-premium-read.test.js`,
  `test/premium-static-resources.test.js`, `test/server-premium-composition.test.js`
  y las pruebas Ángel y Eli para público/preview e aislamiento, cuando se autorice
  esa habilitación. No cambiar baselines sin revisar cada diferencia.

Siguen pendientes proveedor, dominio, mecanismo de despliegue, estado remoto,
preview editorial persistida, autorización operativa y permisos de carga de
Drive con otra cuenta. No hay URL pública entregable verificada. La preview
cliente existente no constituye prueba del recorrido público integrado.

## Revisión del aislamiento y alcance concreto (30/10/2026)

Se confirmó que static-policy.js no tiene diferencias entre 76c546f y el HEAD
integrado. Su SHA-256 normalizado LF es el literal b1690c0a…4acc66 esperado.
El test conserva los seis archivos protegidos, la lectura real de cada archivo,
SHA-256 y assert.equal estricto. No usa el hash calculado como expectativa ni
omite aserciones: cualquier cambio posterior en la política sigue fallando.
Solo se reemplaza la referencia literal de la rama cliente por la de main
revisada. Las pruebas HTTP que bloquean recursos privados y Ángel y Eli en
producción siguen activas; no se modifica la política para hacer pasar el test.
Revisión focalizada con Node 22.23.4: 9/9, incluyendo aislamiento, política
estática, recursos Premium y precondiciones editoriales. Log:
`%TEMP%/angel-eli-integration-isolation-review.log`.

Este commit precede al fetch autorizado. Las referencias y la antigüedad de la
sección anterior describen el estado previo; el resultado de fetch y la
comparación posterior deben informarse por separado, sin presumir éxito.

La habilitación futura debe dividirse en cambios revisables, todavía NO implementados:

1. Definir contrato de presentación definitivo y snapshot canónico privado para
   angel-eli-boda. Mantener nueve secciones en el orden aprobado, Caminata tras
   Carpeta, horario `20:00 hs. a 4:00 a.m hs`, Drive, firma flotante y diseño.
   Resolver explícitamente la relación entre secciones fuente y secciones DOM:
   agregar Caminata al snapshot sin adaptar el controlador actual la duplicaría.
   Revisar `scripts/angel-eli-preview-profile.js`, el perfil compartido futuro y
   `js/events/angel-eli-presentation.js`; preservar compatibilidad de preview local.
   No introducir un snapshot sintético como contenido real ni incluir datos privados.
2. Extender perfil público y preview firmada en los archivos enumerados arriba.
   El resolver público debe conservar evento activo, versión aprobada/publicada,
   pertenencia, autorización Premium y relectura del puntero. La preview debe
   conservar firma/caducidad, pertenencia y bloqueo de archivados, agregar validación
   Premium por servidor y responder con las pistas de presentación seguras para
   esa versión exacta. No hacer pública una versión solo por tener un previewToken.
   No exportar digest, secretos, metadata interna ni configuración de autorización.
3. Autorizar exactamente las 19 rutas estáticas; mantener bloqueos de .dev,
   credenciales y fuentes, límites existentes, 404 de desconocidos y soporte Range.
   No ampliar directorios completos ni incorporar entradas comerciales ajenas.
4. Preparar autorización privada por digest del contenido final mediante los
   mecanismos existentes, preservando todas las otras entradas y revocaciones.
   Verificar startup PASS cuando corresponda y autorización vigente en cada
   lectura/escritura Premium. No se requiere editar SQL ni el esquema Supabase.
5. Probar con fixtures sintéticos público/preview: token vencido/manipulado,
   versión/evento cruzados, archivado, autorización ausente/revocada, cambio del
   puntero y recursos bloqueados. Repetir suite Node 22 y navegador móvil/escritorio
   para portada, videos, música, animación, botones y regresiones Kaly/Civil.
6. Reutilizar el flujo editorial existente del informe base: GET de estado,
   creación de versión inmutable con precondiciones frescas, preview firmada,
   draft → in_review → approved y publicación solo con autorización posterior.
   Mantener expectedPublishedVersionId y expectedPublicationRevision, recibos,
   relectura/reconciliación ante 409/428/timeout y confirmación del UUID publicado.
   No modificar el procedimiento para permitir el CLI genérico ni usar legacy.

No se habilita nada de lo anterior en este cierre. Cualquier divergencia remota
observada tras fetch requiere revisión antes de decidir una futura integración;
fetch por sí mismo no modifica main, el HEAD integrado ni el diseño aprobado.
