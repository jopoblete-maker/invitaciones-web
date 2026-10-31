# Ángel y Eli: integración local — 30 de octubre de 2026

> Estado vigente: habilitación pública y dirección confirmada conservadas en este commit local.
> Ver la sección final. Las secciones anteriores conservan el historial previo.

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

## Habilitación pública local implementada — estado vigente (30/10/2026)

Base de trabajo: integracion/angel-eli en d8194e2e739f82fe55f8a148575fc674978c5b0c.
Todos los cambios de esta etapa quedan SIN COMMIT y sin staging. No se ejecutaron
fetch, push, merge, rebase, deploy, publicación ni escrituras remotas en esta etapa.
El fetch de la etapa anterior terminó correctamente: origin/main continuó en
c3e4672, un commit detrás del main local 76c546f y sin commits remotos exclusivos.
Ese dato no equivale a una nueva consulta remota durante la implementación.

### Archivos modificados o nuevos

| Archivo | Función |
| --- | --- |
| backend/premium/angel-eli-profile.js (nuevo) | Contrato Node privado angel-eli-v1: nueve secciones ordenadas, medios exactos, horario y Drive; pistas seguras después de autorización. |
| js/core/public-event-resolver.js | Emite perfil del evento solo después de la validación Premium y relectura del puntero existentes. Rechaza contrato final inconsistente. |
| server.js | La preview firmada de este evento conserva firma, caducidad, pertenencia y archivado; valida Premium, relee estado y responde con contenido/perfil seguro. |
| js/core/invitation-data-source.js | Asocia perfiles público y firmado con la respuesta mediante WeakMap, nunca con permisos declarados dentro del snapshot. Rechaza perfiles faltantes o cruzados. |
| js/invitacion.js | Reutiliza el adaptador aprobado también en público y preview firmada con perfil autorizado. |
| js/events/angel-eli-presentation.js | Usa medios, Drive y horario canónicos finales; dibuja Caminata exactamente una vez desde su sección canónica. Conserva compatibilidad local anterior. |
| backend/http/static-policy.js | Añade exactamente 19 rutas literales; mantiene todas las reglas anteriores y la entrada editorial de 76c546f. |
| scripts/prepare-angel-eli-public.js (nuevo) | Preparación local explícita del snapshot y aprobación privados; conserva todas las entradas recibidas y rechaza reactivar un digest revocado. |
| scripts/angel-eli-public-preview.js (nuevo) | Simulador loopback que ejecuta server.js real con lecturas en memoria; no crea cliente real de Supabase y bloquea todo método de escritura. |
| test/angel-eli-public.test.js (nuevo) | Ocho pruebas agrupadas de contrato, confianza del cliente, autorización, servidor HTTP, preview y recursos. |
| test/angel-eli-local.test.js | Conserva aislamiento y 404 privados; actualiza hash literal de la política tras revisar la adición exacta de 19 rutas. Los nuevos positivos y negativos HTTP se cubren arriba. |
| docs/angel-eli-integration-local.md | Este informe y resultados. |

No hay cambios en CSS de diseño, recursos multimedia, archivos de Kaly y Joha,
Civil, SQL, adaptador RPC, servicio editorial, precondiciones de concurrencia ni
clientes administrativos. La diferencia de static-policy.js respecto de main se
limita a las 19 rutas exactas (17 multimedia conservados más CSS/JS del evento).
No se abre un directorio ni se habilitan archivos privados, scripts o backend.

### Snapshot, presentación y autorización privados

Preparados y excluidos por .gitignore:

- .dev/premium/angel-eli-public.event.json
- .dev/premium/angel-eli-public.authorization.json

El snapshot usa el perfil angel-eli-v1 y exactamente este orden: Portada,
Nuestra historia, Fiesta, Asistencia, Vestimenta, Regalos, Carpeta compartida,
Caminata, Cierre. No incluye fotografia-pareja. Carpeta usa el tipo Premium
existente collaborative-album, con la URL Drive aprobada y su política exacta.
Caminata es media-closing con media_id caminata y referencia al MP4 aprobado.
Los fondos sin texto están en media.items; no se eliminan los originales de Git.

El horario canónico de Fiesta y el HTML coinciden exactamente en
`20:00 hs. a 4:00 a.m hs`. Se conserva el horario general de ceremonia original
porque no es el de Fiesta; no se altera la imagen aprobada de Nuestra historia.
La dirección canónica coincide con la capa visual y el mapa existentes.
La reserva de blanco y Elegante Sport del snapshot coinciden con las capas.

El motor compartido recibe las ocho secciones que renderiza originalmente;
el adaptador dedicado dibuja la novena, Caminata, usando la entrada canónica.
El snapshot sigue teniendo nueve secciones sin mutaciones y el DOM final también:
no se agrega una segunda Caminata ni se aplica el enlace/horario local anterior
sobre el contenido final. El perfil confiable exige orden, tipos, medios, música,
RSVP, horario y enlace acordados antes de autorizar esa presentación.

La configuración privada añade el digest final y la URL del álbum sin reemplazar
las entradas previas del archivo de entrada, incluidas revocaciones. Se comprobó
igualdad de esas entradas y aceptación del contenido final; startup PASS en el
simulador y respuesta HTTP pública 200. El contenido y el digest no se incluyen
en este informe ni en Git. No se modificaron los archivos privados originales.

IMPORTANTE: el archivo de entrada disponible es la autorización LOCAL de este
evento, no la configuración completa del servicio productivo. Esta salida no
puede reemplazar por sí sola los secretos de producción: al preparar un despliegue
habrá que combinarla con la configuración operativa vigente y preservar todos
los demás eventos y revocaciones. No se consultó ni se modificó esa configuración.

### Pruebas ejecutadas

- Node 22.23.4: suite completa `node.exe --test`, 120/120 aprobadas, 0 fallidas,
  0 omitidas. Incluye regresiones Kaly/Joha, Civil, Premium y endurecimiento
  editorial. Operaciones editoriales exclusivamente con dobles/datos simulados.
- HTTP real ejecutando server.js/resolver/política estática reales y sustituyendo
  únicamente acceso a datos y escucha por un simulador loopback: perfil público
  y firmado correctos, no-store, cero escrituras y métodos de escritura 405.
- 19 recursos exactos: 200; ambos MP4 con Range bytes=0-99: 206 y 100 bytes.
  Archivos .dev, autorización, backend, .env, scripts, desconocidos, directorios,
  extensiones alternativas, backups y rutas codificadas: 404.
- Autorización ausente, digest equivocado, revocación o contenido alterado:
  público 404 y preview 403. Un contrato con horario contradictorio tampoco
  recibe perfil aunque posea aprobación para su digest.
- Token manipulado/vencido, evento o versión cruzados, archivado y propietario
  incorrecto: denegados. La preview de draft autorizado funciona pero no lo
  vuelve público. Pistas dentro del contenido y respuestas no vinculadas no
  habilitan el adaptador del cliente.
- Chrome 156 headless con emulación de escritorio 1366x900, móvil 390x844 y
  320x740: nueve secciones/una Caminata, portada automática sin controles,
  proporción completa y alineación 540 px máximo, bloqueo inicial hasta fin,
  alternativa ante fallo, scroll vertical sin barra numérica ni desbordamiento.
- Chrome: Caminata silenciada inline en bucle, vuelta natural al principio,
  pausa fuera de pantalla y reinicio al regresar; música general continuó tras
  interacción real. Fondos fijos, seis secuencias activas de palabras, relojes
  sincronizados y 2.000 ms entre última palabra completa y comienzo de fade
  (precisión numérica de los keyframes; la pantalla depende del refresco).
- Chrome: Cierre en tres líneas sin superposición; movimiento reducido deja
  todas las palabras fijas y sin animaciones. Firma oculta durante portada y
  disponible después, panel de marca con apertura/cierre/Escape; Regalos con
  apertura/cierre/Escape. Revisión final del cliente actual en los tres tamaños.
- Destinos Drive, marca, RSVP y mapa inspeccionados con target blank y
  noopener noreferrer; no se abrieron enlaces externos ni se enviaron mensajes.
- Preview firmada renderizada en Chrome móvil. No es una prueba en dispositivo
  físico ni Safari; no se verificaron permisos de carga Drive con otra cuenta.
- `git diff --check` sin errores. Solo avisos de conversión LF/CRLF de Git.

Binario Node 22 y NODE_PATH son los documentados arriba; se reutilizaron las
dependencias instaladas sin modificar otro worktree. Logs fuera del repositorio:

- %TEMP%/angel-eli-public-full-node22.log
- %TEMP%/angel-eli-public-browser-qa.log
- %TEMP%/angel-eli-public-final-smoke.log
- Capturas: %TEMP%/angel-eli-public-review/ (incluye Cierre con movimiento reducido).

### Vista previa y pendientes reales

Vista previa local disponible del flujo público SIMULADO, no publicado:

    http://127.0.0.1:4186/invitacion.html?id=angel-eli-boda

Reinicio desde este worktree, con Node 22 y dependencias disponibles:

    node scripts/angel-eli-public-preview.js

El script usa los dos archivos privados preparados, un puntero publicado simulado
y la ruta pública real; ese puntero existe solo en memoria. No representa una
publicación editorial real. No hay credenciales productivas ni escrituras de base.

Quedan pendientes revisión/aprobación de este diff y de la vista visual, eventual
commit autorizado, integración remota, identificación del proveedor/dominio,
autorización operativa combinada y validación del snapshot persistido/preview
firmada en el entorno real. No se ejecutó ningún paso editorial remoto.
Reutilizar íntegramente el procedimiento de la sección 8 del informe base:
GET de estado, nueva versión inmutable con precondiciones frescas, preview
firmada, draft → in_review → approved y publicación únicamente tras autorización.
Conservar expectedPublishedVersionId, expectedPublicationRevision, recibos y
reconciliación ante 409/428/timeout; no usar el CLI genérico/legacy como atajo.

Los bloqueos técnicos de perfil/recursos/snapshot están resueltos en este diff
local, no desplegados. La autorización privada quedó preparada y probada aquí,
no instalada en producción. Las pruebas locales no sustituyen la aprobación
visual ni la comprobación final del entorno real y sus permisos.

## Precisión operativa posterior — 30/10/2026

Ver [preparación operativa y secuencia exacta](angel-eli-operational-runbook.md).
La API GitHub se consultó por GET autenticado: main remoto sigue en c3e4672,
solo se observó CI de tests, sin despliegues/entornos/URL de hosting registrados.
Proveedor, servicio, dominio y disparadores siguen sin identificar con evidencia;
se solicitó enlace público o de panel sin pedir secretos. No se asumió un host.

Drive fue aprobado por su propietario, confirmado por el usuario. Esa aprobación
se distingue de una prueba independiente de carga desde otra cuenta, no realizada.
No debe seguir figurando como permiso del propietario pendiente ni como un bloqueo
automático nuevo. Las referencias anteriores a ese pendiente son históricas.

Se verificó con Node 22 y datos simulados una combinación que conserva los scopes
existentes aprobados y revocados, mantiene las decisiones previas y permite Ángel
y Eli, sin escrituras. La configuración real completa del servicio sigue pendiente;
la lista local de este evento nunca debe reemplazarla. El nuevo documento detalla
configuración, conservación de secretos, preflight de contratos 76c546f, despliegue,
flujo editorial existente, reconciliación de resultados ambiguos y postcondiciones.
En esta revisión solo se modificó documentación; no se cambiaron código ni archivos
privados preparados, ni se ejecutaron commit/push/deploy/publicación/escrituras editoriales.

### URL de producción aportada y comprobada (30/10/2026)

El usuario aportó la invitación entregada en
https://invitaciones-web-nl0b.onrender.com/invitacion.html?id=kaly-joha-nuestra-boda.
GET respondió 200, con x-render-origin-server: Render, no-store y no-referrer.
Render y el dominio público quedan identificados. Las afirmaciones anteriores
sobre proveedor/dominio desconocidos corresponden a la revisión previa a recibir
esta URL. Ver sección 7 del runbook para evidencia y procedimiento de Render.

Faltan ID/configuración interna del servicio, rama y Auto-Deploy, release activa,
configuración Premium completa y compatibilidad operativa 76c546f. No se dedujo
el SHA desplegado a partir de un solo archivo JavaScript. No se invocaron hooks,
secrets, mutaciones editoriales ni comandos de despliegue; solo GET de recursos
públicos y actualización documental local. La aprobación del propietario de
Drive se mantiene distinguida de una prueba técnica independiente no realizada.

### Estado de Render confirmado por el usuario y divergencia de producción

Capturas según datos aportados: servicio invitaciones-web, repo
jopoblete-maker/invitaciones-web, rama main, Auto-Deploy Off y activo 85d604a.
El SHA se resuelve completo y sin ambigüedad a
85d604a6e75932c634aefd2ed173fd91255fc1f3. El ID srv-… no fue aportado.

Fetch origin completado correctamente: origin/main permanece en c3e4672.
Activo tiene dos commits exclusivos sobre origin/main (c025024 y 85d604a).
Frente a HEAD integración d8194e2, diverge 2 commits del activo / 4 de integración;
ancestro común c3e4672. Ver sección 8 del runbook para el diff y escenarios.

No desplegar esta integración directamente: retiraría landing/comercial y
catálogo/visor presentes en el activo, incluidas 44 imágenes de muestras. Un
Deploy latest commit de main hoy seleccionaría c3e4672, también sin esos cambios
y sin Ángel y Eli. Con Auto-Deploy Off un push por sí solo no inicia auto-deploy
de Render; no se accionó ningún otro disparador.

Se requiere reconciliar una futura base de release que conserve lo desplegado,
el endurecimiento editorial y la entrega autorizada; no se hizo esa integración
ni se modificó main en este cierre documental. La habilitación pública sigue
sin commit. La lista local de autorizaciones no puede sustituir la operativa
completa: pendientes concretos enumerados en la sección 8 del runbook.

## Integración local que conserva la versión desplegada — estado vigente

Merge f7976ba6f22e6a2f4d81d85d1789f769c3ca5c9b, padres d8194e2 y
85d604a6e75932c634aefd2ed173fd91255fc1f3. 85d604a y 76c546f son antecesores
confirmados. Se incorporaron los dos commits de catálogo/comercial sin reescribir
historial, modificar main/otros worktrees ni eliminar archivos del activo.

Se verificaron 61 archivos comerciales/de catálogo idénticos al activo, incluidas
las 44 imágenes, y la política estática exacta del activo más la entrada editorial.
Los 13 archivos locales públicos previos se respaldaron y restauraron; solo la
allowlist y el hash estricto de su test necesitaron combinar las adiciones.
No hubo conflictos de comportamiento ni cambios de diseño. Los archivos privados
siguen idénticos y fuera de Git. Hay un stash de recuperación no privado retenido,
9b6d94f6674f8fa9668f49a9eaf336bc9c46da64; no aplicarlo de nuevo sobre este worktree.

Validación Node 22.23.4: merge limpio 118/118; candidato con habilitación pública
restaurada 126/126, incluidas regresiones catálogo/comercial, Kaly y Joha, Civil,
Ángel y Eli y endurecimiento editorial. diff --check pasó. HTTP real local comprobó
44 imágenes con bytes iguales al activo, recursos comerciales/editoriales 200,
Ángel y Eli con nueve secciones/una Caminata y privados/desconocidos 404.

La preview existente quedó reiniciada con el mismo script en 127.0.0.1:4186.
Ver sección 9 del runbook para evidencia, respaldo, candidato y pendientes Premium.
La pérdida de catálogo descrita en la auditoría anterior queda resuelta LOCALMENTE.
La habilitación pública y estos informes siguen sin commit: f7976ba por sí solo
no los incluye. main remoto sigue en c3e4672 según la referencia almacenada;
Deploy latest commit del servicio main no seleccionaría este candidato local.
Sin push, deploy, publicación ni escrituras SQL/Supabase.

### Destino de Cómo llegar corregido (30/10/2026)

La fuente definitiva privada y su preparación usan ahora exactamente
https://maps.app.goo.gl/NCyLci7MA9XXWAwG9. Se actualizó la aprobación privada para
el digest nuevo, conservando las entradas previas. No hay autorización productiva
instalada ni commit nuevo. Chrome móvil/escritorio confirmó clic y apertura en
pestaña nueva con noopener noreferrer; 27/27 pruebas pertinentes Node 22 aprobadas.

Maps resuelve a Hernán Cortez 1710, B1812 Carlos Spegazzini, Provincia de Buenos Aires.
Difiere de Hernán Cortés 17, todavía visible: se informó al usuario y se conserva
ese texto pendiente de confirmación, sin alterar distribución ni horario. Ver
sección 10 del runbook. Preview 4186 reiniciada con el snapshot actualizado.

### Dirección de Fiesta confirmada y aplicada

Hernán Cortez 1710 ya coincide en fuente definitiva, snapshot privado y capa HTML.
Se conservan Carlos Spegazzini, Buenos Aires; horario 20:00 hs. a 4:00 a.m hs;
y https://maps.app.goo.gl/NCyLci7MA9XXWAwG9. Se recalculó y aprobó el digest local
nuevo, sin perder entradas previas de autorización; los archivos siguen privados.
La confirmación del propietario resuelve el pendiente de texto de la sección anterior.

Ajuste mínimo exclusivo de tamaño del texto de dirección: 7.5 → 7.4 cqw para que
quepa en una línea y no roce el ícono del fondo. Sin cambios de posición, tipografía,
colores, imágenes ni animaciones. 27/27 pruebas pertinentes Node 22 y comprobación
Chrome escritorio/móvil/320 px sin cortes, superposiciones o desbordamientos.
Ver sección 11 del runbook. Preview existente disponible en 4186; sin commit ni
operaciones remotas. Kaly y Joha y Civil permanecen intactos.

## Cierre local autorizado de la habilitación pública

Se revisó y guardó en un commit nuevo específico, hijo de f7976ba, el manifiesto
explícito de 14 archivos enumerado en sección 12 del runbook. Se conserva el
historial, el código activo 85d604a, catálogo/comercial y 76c546f. La dirección
confirmada Hernán Cortez 1710 y su enlace Maps están en perfil, preparación y
presentación; snapshot y autorización reales continúan privados y fuera de Git.
Las referencias anteriores a habilitación sin commit son históricas a partir
de este cierre. Consultar el SHA del commit que contiene esta sección.

Suite completa Node 22.23.4: 126/126 aprobadas y diff --check correcto. Se verificó
aceptación del digest vigente y startup PASS. Del archivo privado activo se
retiraron tres aprobaciones obsoletas SOLO de Ángel y Eli, sin referencia en el
simulador de una única versión; queda una vigente. Se conservaron las entradas
de otros eventos y revocaciones (no había ninguna en ese archivo local), sin
tocar configuración real remota. Hay respaldo privado de auditoría fuera de Git.
No hay justificación para mantener las tres antiguas como autoridad local activa.

La configuración operativa completa de producción sigue pendiente y nunca debe
reemplazarse por esta lista local. Faltan verificación de variables/contratos
76c546f, despliegue del SHA autorizado y proceso editorial real con precondiciones.
No se hizo push, deploy, publicación ni cambios de main, otros worktrees, Kaly
y Joha, Civil, SQL o Supabase. La vista previa sigue siendo simulada/local.
