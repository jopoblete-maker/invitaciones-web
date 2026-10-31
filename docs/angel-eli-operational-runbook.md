# Ángel y Eli: preparación operativa — 30 de octubre de 2026

> Estado vigente: cierre local de habilitación pública y dirección confirmada; ver sección 12.
> Se conserva el merge f7976ba y sus antecesores 85d604a/76c546f. Secciones 1–11: historial.

Las secciones 1–11 registran etapas anteriores. La sección 12 documenta el commit
local autorizado y prevalece sobre referencias históricas a cambios sin commit.

En la auditoría operativa inicial este informe no autorizaba ni ejecutaba
commit, push, despliegue, configuración remota o publicación. No se escribieron
datos editoriales ni se accedió directamente a SQL/Supabase. Solo se actualizaron
este documento y el enlace/resumen del informe de integración. El código y los
archivos privados preparados se conservaron sin cambios durante esta revisión.

## 1. Fuentes consultadas y resultado real

Consultas autenticadas GET a la API de GitHub, sin mostrar credenciales:

| Fuente | Resultado verificado |
| --- | --- |
| Repositorio jopoblete-maker/invitaciones-web | Público; rama predeterminada main; homepage vacía. |
| GET /repos/jopoblete-maker/invitaciones-web/branches/main | SHA c3e4672d8e8dfdba5b4125e0e29bb777a2f167ee; protected=false. No se modificó ninguna referencia Git. |
| GET /repos/jopoblete-maker/invitaciones-web/commits/main/status | Lista de estados externos vacía. |
| GET /repos/jopoblete-maker/invitaciones-web/commits/main/check-runs | Check test de GitHub Actions completado con success. Corresponde al main remoto, no a este diff sin commit. |
| GET /repos/jopoblete-maker/invitaciones-web/deployments?per_page=5 | Lista vacía. |
| GET /repos/jopoblete-maker/invitaciones-web/environments?per_page=20 | Lista vacía. |
| GET /repos/jopoblete-maker/invitaciones-web/pages | HTTP 404. No se obtuvo URL de Pages. |

La consulta web pública inicial no pudo recuperar el repositorio; se continuó
con la API autenticada GET. La credencial Git existente se usó solo en memoria.
No se imprimió ni guardó en los documentos o logs. No se consultaron secretos
remotos ni se ejecutaron comandos de despliegue.

Referencias consultables: [repositorio](https://github.com/jopoblete-maker/invitaciones-web),
[check observado](https://github.com/jopoblete-maker/invitaciones-web/actions/runs/38803334575/job/116657731967).

Se revisaron package.json, .env.example, server.js, la política estática,
contratos editoriales/Premium, documentación y .github/workflows/test.yml.
No hay descriptor de hosting ni workflow de deploy en el checkout; el historial
visible de los nombres usuales de esos descriptores tampoco identificó uno.
El workflow existente instala Node 22, ejecuta npm ci y npm test: solo CI.
No se encontraron CLI de hosting disponibles entre los proveedores comprobados.

| Dato operativo | Estado |
| --- | --- |
| Repositorio de código y CI | Identificados en GitHub. |
| Proveedor de producción | Render, confirmado por URL aportada y cabecera HTTP x-render-origin-server: Render; ver actualización de la sección 7. |
| Servicio/proyecto y su ID | Nombre invitaciones-web confirmado por datos de capturas aportados por el usuario; hostname invitaciones-web-nl0b.onrender.com. El ID interno srv-… y workspace/proyecto no fueron aportados. |
| Dominio público y origen administrativo | Base pública https://invitaciones-web-nl0b.onrender.com confirmada. Dominios personalizados y orígenes administrativos configurados aún sin verificar. |
| Release/SHA actualmente desplegado | Capturas según transcripción del usuario: 85d604a. Resuelto en Git como 85d604a6e75932c634aefd2ed173fd91255fc1f3. No procede de inferencia por archivos HTTP. |
| Rama observada por el proveedor | main, confirmada por los datos de capturas aportados. Repo conectado: jopoblete-maker/invitaciones-web. |
| Auto-deploy por push/merge, manual o webhook | Auto-Deploy Off, confirmado por los datos de capturas aportados. Un push por sí solo no dispara auto-deploy de Render mientras siga Off; no se invocaron ni auditaron hooks externos. |
| Runtime requerido | Node >=22 <23, Express; arranque npm start → node server.js; sin etapa npm run build. |
| Acceso al panel/API del servicio | La URL pública fue aportada; no se dispone del enlace/ID interno ni acceso autenticado al panel/API de Render. |

Bloqueo vigente: la base activa 85d604a diverge de la integración y está por
delante de origin/main. Ver sección 8 antes de decidir la próxima release.
Auto-Deploy está Off según capturas; faltan ID interno y configuración operativa. No se adivinaron dominios ni se
trató la preview 127.0.0.1 como servicio de producción.

## 2. Configuración requerida: verificado frente a pendiente

No se inspeccionaron valores del entorno productivo. Los nombres y contratos
siguientes están verificados en el código; la presencia/valor remoto sigue
pendiente en todos los casos. La preview usa configuración simulada aislada.

| Configuración | Contrato verificado y uso | Falta verificar en el servicio |
| --- | --- | --- |
| Node 22.x | package.json exige >=22 <23; pruebas locales con 22.23.4. | Versión real del runtime y del instalador. |
| PORT | Lo suministra el host; fallback 3000; Express escucha el puerto. | Puerto/asignación y proxy del servicio. No imponer 4186. |
| ADMIN_PASSWORD | Obligatoria al arrancar; autentica API administrativa. | Presencia y continuidad del secreto vigente. No rotarlo ni copiarlo a Git. |
| SUPABASE_URL | Obligatoria al arrancar; cliente servidor existente. | Proyecto correcto mediante metadatos autorizados, sin revelar valor ni cambiarlo. |
| SUPABASE_KEY | Obligatoria al arrancar. | Presencia/rol y continuidad del secreto servidor vigente; nunca exponer al navegador. |
| ADMIN_ALLOWED_ORIGINS | Lista separada por comas de orígenes http/https exactos, sin rutas, credenciales ni comodín *. Falla cerrado si es inválida. | Origen real del panel y conservación de todos los orígenes legítimos existentes. |
| ADMIN_RATE_LIMIT_WINDOW_SECONDS | Entero de 1 a 86400. Sin valor válido, la administración falla cerrada. | Valor operativo y disponibilidad del limitador remoto existente. |
| ADMIN_RATE_LIMIT_MAX_REQUESTS | Entero de 1 a 100000. Sin valor válido, la administración falla cerrada. | Valor operativo y continuidad de la política actual. |
| PREVIEW_SIGNING_KEY | Necesaria para firma de preview y cursores administrativos. No hay clave por defecto válida. | Secreto vigente presente; conservarlo. Una rotación invalidaría enlaces/cursores previos. |
| PREVIEW_TTL_SECONDS | Default 300 segundos; usar entero positivo válido. | Valor real y caducidad esperada de enlaces. |
| PREMIUM_AUTHORIZATION_CONFIG | JSON completo de entradas privadas, no una ruta de archivo ni la lista local reducida. Ausencia/configuración inválida deniega Premium. | Exportación privada completa y vigente, combinación revisada, tamaño admitido por el host y formato sin doble serialización. |
| PREMIUM_AUTHORIZATION_CHECK_ENABLED | Opt-in: true ejecuta el chequeo; false/vacío/ausente lo desactiva; valor distinto da FAIL. | Estado vigente y decisión explícita sobre activarlo. No alterar silenciosamente. |
| PREMIUM_AUTHORIZATION_REFERENCE_CONTENT | Contenido canónico independiente en JSON; requerido si el chequeo está activo. No es un manifest ni se reconstruye desde la autorización. | Conservar referencia vigente si está activa y sigue siendo válida. Si se decide apuntar a Ángel y Eli, usar el snapshot definitivo exacto, sin perder la validación separada de otros eventos. |
| YCOR_API_BASE_URL | Solo herramientas editoriales/bridge locales; no configura el servidor de producción. | URL HTTPS real antes de usar el cliente operativo; no usar localhost como destino remoto. |
| YCOR_ADMIN_PASSWORD | Solo herramientas editoriales locales; usar un canal privado. | Credencial autorizada, sin ponerla en argumentos, documentación ni historial. |

.env.example no enumera hoy las tres variables Premium ni PORT; sus contratos
están en server.js y backend/premium. No se modificó el ejemplo en este cierre.
NODE_PATH hacia otro worktree se usó solo para pruebas locales: no es una
configuración de despliegue. El artefacto productivo debe instalar sus propias
dependencias con npm ci --omit=dev usando Node 22.

Un PREMIUM_STARTUP_AUTHORIZATION FAIL deshabilita TODO Premium de ese proceso,
no solo Ángel y Eli. Si se activa el chequeo, exigir PASS antes de avanzar.
Un DISABLED no prueba aceptación de las autorizaciones: validarlas por separado.

## 3. Conservar todas las autorizaciones Premium

La salida .dev/premium/angel-eli-public.authorization.json conserva todas las
entradas del archivo LOCAL de entrada del evento y añade el digest definitivo.
NO contiene evidencia de que sea el conjunto completo de producción. No usarla
como reemplazo de PREMIUM_AUTHORIZATION_CONFIG.

La combinación real requiere este procedimiento, sin editar producción todavía:

1. Obtener por lectura autorizada del servicio identificado una copia completa
   de la configuración vigente. Guardarla solo en almacenamiento privado fuera
   de Git, con sello temporal/referencia de versión privada. No pegarla en chat.
   Si no se puede obtener o probar su integridad/completitud, detenerse.
2. Obtener también un inventario privado de scopes/revisiones y snapshots de
   referencia necesarios para comprobar los Premium ya servidos. Usar interfaces
   administrativas existentes y lecturas permitidas; no SQL directo.
3. Leer esa configuración COMPLETA y el snapshot definitivo privado; llamar al
   export existente addAuthorization(fullConfiguration, finalSnapshot) de
   scripts/prepare-angel-eli-public.js. No volver a ejecutar el CLI sobre una
   carpeta ya preparada ni sustituir fullConfiguration por el archivo local.
4. Comprobar deepEqual de todas las entradas originales con el prefijo de la
   salida y que la entrada original no se mutó. No filtrar revocaciones, eventos
   ajenos, digests anteriores ni revisiones históricas. No ordenar/deduplicar como
   forma de corregir un archivo que no se entiende.
5. El scope es (eventId, templateSlug, canonicalDigest); gana su revisión más alta,
   también si es revoked. La unicidad de revisión es por scope. Para un digest
   nuevo se añade una entrada; si ya hay aprobación efectiva, no se duplica;
   si la revisión efectiva está revocada, el helper se detiene. No incrementar
   la revisión para eludir una revocación sin autorización explícita.
6. Validar proveedor, presupuesto JSON (12 MiB, profundidad 100, valores 100000)
   y límite de variable del hosting, todavía desconocido. Comprobar el contenido
   canónico definitivo con el MISMO createEventVersionEditorialService y su
   preparePremiumContent, adaptador de escritura prohibido y proveedor combinado.
   Probar cada snapshot activo conocido contra la configuración combinada y
   verificar que sus revocaciones sigan denegadas. No basta con contar entradas.
7. Guardar el resultado en un NUEVO archivo privado (sin sobrescribir backups),
   no en Git. Registrar solo resultado/counts/referencias no sensibles en el
   informe; no registrar manifests, valores financieros, claves ni digests privados.
8. Justo antes de una instalación futura, releer la versión de configuración del
   servicio: si cambió desde la exportación, detenerse y recombinar la copia más
   reciente. Evitar sobrescribir autorizaciones añadidas por otro operador.
   Mantener respaldo privado de configuración y release anteriores.

VERIFICADO AHORA con Node 22 y datos íntegramente simulados: combinación
preservó entradas aprobadas y revocadas; un Premium anterior siguió aceptado,
la revocación de mayor revisión siguió denegada y Ángel y Eli fue aceptado;
cero llamadas al adaptador de escritura. Log local:
%TEMP%/angel-eli-authorization-merge-audit.log.
También se había comprobado que la preparación privada real local conserva el
prefijo de entradas de su archivo original y coincide con el digest final.

PENDIENTE: aplicar esta comprobación al conjunto operativo COMPLETO. No se
puede afirmar que todas las autorizaciones reales están combinadas sin leerlo.
No se instaló ninguna configuración ni se reactivó ninguna revocación.

## 4. Secuencia futura exacta: condiciones y despliegue

Esta sección es una receta NO EJECUTADA. Cada escritura futura requiere la
autorización correspondiente; no constituye autorización para ejecutarla hoy.

### A. Preflight y definición de la release

1. Identificar panel/proveedor, ID de servicio, dominio HTTPS, proyecto de datos,
   release/SHA actual, rama configurada y auto-deploy. Verificarlos por lecturas
   del panel/API; registrar enlaces no secretos. No hacer push mientras se
   desconozca si activa un deploy.
2. Reconciliar rama destino y main remoto mediante lecturas/fetch futuros
   autorizados. Conservar 76c546f y los dos cherry-picks, sin catálogo/comercial.
   La referencia GitHub consultada sigue en c3e4672. No desplegar d8194e2:
   este HEAD no contiene la habilitación pública aún sin commit.
3. Revisar el diff completo, archivos nuevos, snapshot y vista local; excluir
   .dev/premium, credenciales y archivos ajenos. Solo tras autorización separada,
   crear la release versionada y revisar/validar el SHA exacto que se desplegará.
   No desplegar un worktree sucio ni atribuir a CI del main viejo validación de
   esa release. Ejecutar suite completa en Node 22 y git diff --check; CI debe
   corresponder al SHA final revisado.
4. Preparar la configuración combinada según sección 3 sin cambiar los demás
   secretos/orígenes. Conservar la referencia de startup existente o documentar
   explícitamente su cambio. Verificar todos los Premium conocidos offline.
5. Leer estado/versión actual de angel-eli-boda por API administrativa existente,
   sin mutaciones. Registrar evento activo, punteros, workflow y revisión cadena.
   Un 404 solo habilita tratarlo como nuevo si es respuesta estructurada
   EVENT_NOT_FOUND del servicio correcto; HTML 404, timeout, 401 o 5xx no prueban
   inexistencia. Si está archivado o hay trabajo no identificado, detenerse.
6. Verificar compatibilidad operativa de 76c546f: lectura de
   admin_event_publication_state con publication_revision en texto y contratos
   RPC publish_event_version_audited/rollback_event_version con precondiciones
   nuevas. El GET correcto acredita la lectura, NO demuestra por sí solo las
   firmas o la atomicidad de los RPC de escritura. Exigir evidencia previa o
   inspección autorizada de metadatos existentes y validación aislada. Si falta
   contrato/compatibilidad, detener el despliegue y preparar un alcance separado;
   no ejecutar SQL, cambiar firmas ni volver al flujo legacy como solución.
7. Obtener una línea base de solo lectura de las invitaciones entregadas y de
   Premium ya activos: contenido público, recursos y estado esperado. Usar los
   IDs y URLs realmente confirmados del servicio, sin asumir que un fixture local
   es una invitación publicada. No enviar RSVP ni mensajes de WhatsApp.

### B. Despliegue técnico, separado de publicación editorial

8. Tras identificar el mecanismo y autorizarlo, desplegar exactamente el SHA
   revisado y la configuración combinada, con control de versión de secretos
   frente a la exportación. La acción/botón/comando de ese proveedor queda
   pendiente: no existe evidencia para inventar uno. El proceso que debe ejecutar
   el servicio sí está verificado: Node 22; npm ci --omit=dev; npm start
   (node server.js). Sin npm run build y sin scripts/*preview* en producción.
9. Confirmar release/SHA activo por metadatos del proveedor, salud del proceso y
   logs sin secretos. Si startup check está activo, exigir PASS; ante FAIL detener
   el avance porque puede afectar a todos los Premium. Confirmar orígenes,
   limitadores y clave de preview sin rotaciones accidentales.
10. Comprobar sobre el dominio real: las 19 rutas exactas y su contenido contra
    el artefacto; Range 206 en ambos MP4; archivos privados/desconocidos 404;
    /invitacion.html con no-store y no-referrer; lecturas públicas/API con las
    cabeceras esperadas. No exigir una ruta /health o endpoint SHA que no existe.
    El SHA debe acreditarse por el proveedor, no por un simple HTTP 200 de portada.
11. Repetir lecturas de Kaly y Joha, Civil y otros Premium contra la línea base.
    Si no hay publicación previa de Ángel y Eli, su ruta pública debe seguir
    denegada mientras solo exista draft; si había versión publicada, debe seguir
    sirviendo esa versión hasta el paso editorial autorizado.
12. Si falla el despliegue, no publicar. Reconciliar release/configuración actual
    antes de reintentar. Un rollback técnico eventual requiere autorización y
    release/configuración compatibles; no aplicar restauraciones ciegas ni cambiar
    punteros editoriales para ocultar una incidencia técnica.

## 5. Secuencia editorial existente, después del despliegue validado

Ejecutar exclusivamente para eventId angel-eli-boda y con autorización futura.
Usar panel/clientes existentes: js/core/admin-editorial-client.js,
js/core/admin-editorial-workflow.js y scripts/event-editorial-api-client.js.
No usar publish:event genérico, --legacy, --overwrite ni escrituras directas.

Cabeceras: X-Admin-Password por canal privado; POST con Content-Type
application/json y Origin administrativo permitido. No guardar el secreto en
argumentos, cuerpos versionados, terminales compartidas o logs. Base URL =
dominio HTTPS verificado; no el simulador local.

| Paso | Solicitud exacta | Precondición y comprobación |
| --- | --- | --- |
| E1 | GET /api/admin/eventos/angel-eli-boda | Obtener estado fresco y guardar P=publishedVersionId, W=currentWorkingVersionId, R=publicationRevision (cadena), versiones/status. |
| E2 nuevo, solo ante EVENT_NOT_FOUND confirmado | POST /api/admin/eventos con {eventId:"angel-eli-boda", content:SNAPSHOT_FINAL} | Guardar UUID retornado. No usar IDs locales/simulados. |
| E2 existente | POST /api/admin/eventos/angel-eli-boda/versions con {content:SNAPSHOT_FINAL, expectedWorkingVersionId:W, sourceVersionId:FUENTE_OBSERVADA_O_NULL, initialWorkflow:"draft"} | Fuente elegida de las versiones del mismo evento observadas en E1. Si ya existe exactamente la versión final adecuada, reconciliar/reutilizarla; no crear duplicados ante incertidumbre. No sobreescribir una versión inmutable. |
| E3 | GET /api/admin/eventos/angel-eli-boda/versions/UUID | Comparar el canónico persistido con el snapshot privado definitivo (digest local, sin imprimirlo). Confirmar evento, UUID, nueve secciones y datos finales. |
| E4 | POST /api/admin/eventos/angel-eli-boda/versions/UUID/preview | Usar el token del previewUrl devuelto en /invitacion.html?previewToken=TOKEN; también responde GET /api/preview?token=TOKEN. Verificar perfil, nueve secciones, una Caminata, música, portada, animaciones y botones en el entorno real. Token privado y con caducidad. |
| E5 | POST /api/admin/eventos/angel-eli-boda/versions/UUID/workflow con {expectedStatus:"draft", targetStatus:"in_review"} | Releer estado y comprobar transición del mismo UUID. Si ya está en otra fase, reconciliar antes de avanzar. |
| E6 | POST /api/admin/eventos/angel-eli-boda/versions/UUID/workflow con {expectedStatus:"in_review", targetStatus:"approved"} | Solo después de aprobación visual. Releer y confirmar approved. |
| E7 | GET /api/admin/eventos/angel-eli-boda | Confirmar UUID aprobado y estado activo, releer P y R frescos. No reutilizar una revisión anterior a las comprobaciones. |
| E8 | POST /api/admin/eventos/angel-eli-boda/versions/UUID/publish con {expectedPublishedVersionId:P, expectedPublicationRevision:R} | Confirmación PUBLICAR angel-eli-boda en el panel. P debe ser UUID observado o null explícito; R cadena decimal, nunca Number. Mantener recibo y postcondiciones de 76c546f. |
| E9 | GET de estado y GET /api/eventos/angel-eli-boda | Estado/recibo deben corresponder al UUID objetivo y revisión esperada; publishedVersionId=UUID y currentWorkingVersionId=null. Usar EditorialPreconditions.receipt/resultingRevision, sin asumir incremento cuando el objetivo ya era el publicado. Respuesta pública versionId=UUID y perfil angel-eli-v1. |
| E10 | GET /invitacion.html?id=angel-eli-boda en el dominio real | Repetir recorrido móvil/escritorio, medios completos, autoplay/fallback, música tras interacción, botones, navegación y no duplicados. Comparar Kaly/Joha y Civil con su línea base sin mutaciones. Registrar release/SHA/UUID/revisión/fecha sin secretos. |

### Reconciliación y errores: no repetir escrituras a ciegas

- 409 confirmado: releer estado y revisar el actor/cambio concurrente. Invalidar
  la confirmación anterior y recalcular la operación antes de una nueva autorización.
- 428: obtener precondiciones frescas; nunca omitirlas ni usar un endpoint antiguo.
- 401/403: detenerse y revisar credencial/origen/permisos; no cambiar políticas
  para eludir el rechazo. 429: respetar Retry-After; 5xx: investigar/reconciliar.
- Timeout, error de red, JSON/recibo inválido o resultado ambiguo: el aborto local
  NO deshace la escritura remota. Mantener el bloqueo de recuperación del cliente
  editorial y consultar estado/versiones. Un GET aún sin cambios NO demuestra
  que un POST pendiente nunca vaya a completar. No pulsar publicar repetidamente.
- Si recibo/estado muestran completada la operación exacta, conciliarla sin otro
  POST. Si otra operación intervino o no se puede determinar el resultado,
  detenerse y resolver la incertidumbre; no elegir la versión más nueva a ciegas.
- Cualquier rollback editorial es otra autorización, por la API existente, con
  expectedPublishedVersionId, expectedPublicationRevision y expectedWorkingVersionId
  frescos. Si es la primera publicación no hay necesariamente una versión anterior
  válida: no inventar un rollback a null ni manipular la base.

## 6. Drive y pendientes que realmente siguen abiertos

Drive: APROBADO POR EL PROPIETARIO, confirmado por el usuario en esta revisión.
La URL exacta ya fue comprobada en código/DOM con target blank y noopener
noreferrer. No se hizo una prueba técnica de carga desde otra cuenta y no se
presenta la aprobación del propietario como si fuera esa prueba. Esa comprobación
independiente no realizada no invalida la confirmación aportada ni se agrega como
un nuevo bloqueo automático para publicar.

Pendientes operativos bloqueantes: verificar ID/configuración interna del servicio
Render y mecanismo de despliegue; obtener/verificar configuración operativa completa;
acreditar compatibilidad real de contratos 76c546f; revisión y release versionada
autorizada; despliegue y preview persistida/aprobación real, todos con autorización
posterior. No se verificó el estado editorial remoto de Ángel y Eli porque falta
acceso administrativo apropiado. El dominio público ya quedó confirmado. No se inventó su UUID o existencia.

La implementación local conserva la evidencia 120/120 con Node 22.23.4 del cierre
anterior. No se repitió la suite por esta edición documental: el código no cambió.
Se añadió la auditoría de combinación simulada descrita arriba y git diff --check.
La vista previa local sigue en http://127.0.0.1:4186/invitacion.html?id=angel-eli-boda;
es un flujo público simulado sin persistencia ni publicación remota.

## 7. Actualización tras recibir la URL pública (30/10/2026)

URL aportada por el usuario:

    https://invitaciones-web-nl0b.onrender.com/invitacion.html?id=kaly-joha-nuestra-boda

Consultas GET efectivas de solo lectura:

| Recurso | Resultado |
| --- | --- |
| Página de la invitación entregada | HTTP 200, sin redirección; HTML de invitación. |
| Cabecera del origen | x-render-origin-server: Render; proveedor confirmado. server: cloudflare identifica una capa de entrega y no sustituye esa identificación. |
| Privacidad del documento | Cache-Control: no-store; Referrer-Policy: no-referrer. |
| /js/invitacion.js | HTTP 200; JavaScript disponible. Su SHA-256 normalizado coincide con ese archivo en c3e4672 y 76c546f, que comparten ese mismo archivo. No coincide con HEAD de integración. Esta coincidencia NO identifica el SHA global de la release desplegada. |

No se consultaron ni modificaron datos editoriales, configuración o formularios.
No se enviaron mensajes ni RSVP. No se inspeccionaron cuerpos con datos privados
de las APIs editoriales. La consulta web no pudo recuperar la URL; el GET directo
posterior con acceso de red autorizado sí terminó correctamente.

Base pública confirmada para las futuras consultas del runbook:
https://invitaciones-web-nl0b.onrender.com. La futura URL de Ángel y Eli sería
/invitacion.html?id=angel-eli-boda en esa base; esto no afirma que esté publicado.
El origen público conocido es https://invitaciones-web-nl0b.onrender.com, pero
no se verificó que sea uno de los orígenes administrativos efectivamente permitidos.
La lista de dominios personalizados tampoco se conoce.

Se consultó la documentación oficial vigente de Render:
[Deploying on Render](https://render.com/docs/deploys).
Está verificado como comportamiento del proveedor, NO como ajuste de este servicio:

- Settings > Auto-Deploy permite On Commit, After CI Checks Pass u Off. La
  ausencia de un deploy en GitHub no permite decidir cuál está configurado aquí.
- Deploys muestra historial y release activa. Es la lectura necesaria para
  acreditar el SHA desplegado y su relación con la rama/repositorio conectados.
- Manual Deploy > Deploy a specific commit acepta un SHA y desactiva auto-deploys.
  Ese efecto es un cambio de configuración: no ejecutarlo sin autorizarlo también.
- Deploy latest commit depende de la rama conectada; no usarlo sin verificar qué
  SHA desplegaría. No asumir que usa integracion/angel-eli.
- Un Deploy Hook de Render dispara despliegue incluso mediante GET. No visitarlo
  como si fuera una consulta de solo lectura. No se invocó ningún hook.

Para completar los pasos A1/B8 con el servicio real, falta lectura autenticada de:
ID y nombre interno, workspace/proyecto, repo y branch conectados, Auto-Deploy,
build/start/pre-deploy commands, runtime, release actual, dominios y metadatos de
variables/configuración. No hay credenciales de Render ni enlace interno de ese
servicio disponibles en este contexto. El hostname por sí solo no acredita esos
valores ni habilita la lectura de secretos del panel.

En consecuencia, proveedor y dominio dejan de ser incógnitas; permanecen pendientes
los ajustes internos, configuración operativa completa y compatibilidad de los
contratos 76c546f. No se modificó el procedimiento editorial ni se ejecutó ningún
paso de escritura. Kaly y Joha y Civil permanecen intactos.

## 8. Estado confirmado por capturas y comparación Git actualizada (30/10/2026)

Fuente: datos de las capturas de Render transcritos/confirmados por el usuario.
No se recibieron aquí las imágenes como archivos ni se obtuvo acceso autenticado
independiente al panel. Esa procedencia se distingue de las consultas HTTP y Git.

| Campo | Dato confirmado/aportado |
| --- | --- |
| Proveedor | Render (también corroborado por HTTP anteriormente). |
| Nombre del servicio | invitaciones-web. |
| Repositorio conectado | jopoblete-maker/invitaciones-web. |
| Rama de despliegue | main. |
| Auto-Deploy | Off. |
| Commit activo abreviado | 85d604a. |
| Commit activo completo resuelto en Git | 85d604a6e75932c634aefd2ed173fd91255fc1f3. La abreviatura se resuelve sin ambigüedad en el repositorio disponible. |
| ID interno de Render | Pendiente; el nombre del servicio no es un ID srv-… ni permite inventarlo. |

Se ejecutó git fetch origin con éxito, sin pull/merge/rebase/push. Después del fetch:

- origin/main = c3e4672d8e8dfdba5b4125e0e29bb777a2f167ee.
- main local, sin modificar = 76c546f77ee7d7209cdb7e17dfe3d89f332cfee2.
- HEAD integración = d8194e2e739f82fe55f8a148575fc674978c5b0c.
- Ancestro común de activo e integración = c3e4672.
- Activo frente a origin/main: 2 commits exclusivos del activo, 0 del remoto.
- Activo frente a integración: 2 exclusivos del activo y 4 de la integración.

Relación resuelta:

    c3e4672  origin/main
    ├─ c025024  landing/comercial y solicitudes de invitaciones
    │  └─ 85d604a  catálogo de 22 muestras y visor (ACTIVO según capturas)
    └─ 76c546f  endurecimiento editorial (main local)
       └─ ae7ca22  entrega base Ángel y Eli
          └─ 22bf4b6  portada alineada y firma flotante
             └─ d8194e2  baseline de aislamiento e informe (HEAD integración)
                + habilitación pública y documentación SIN COMMIT

Por tanto, 85d604a no es un ancestro del HEAD de integración ni este último es
un avance lineal del activo. origin/main tampoco representa hoy la release activa.
Render puede ejecutar un SHA distinto del HEAD de su rama conectada; con estas
lecturas no se determina cómo/cuándo se seleccionó ese SHA y no se inventa una causa.

### Qué entraría o se retiraría en el próximo despliegue

| Acción futura | Resultado según las referencias actuales |
| --- | --- |
| Push sin otro disparador, con Auto-Deploy todavía Off | No inicia por sí solo el auto-deploy de Render. No publica un evento editorial. No se inspeccionaron automatizaciones externas/hook que alguien pueda invocar aparte. |
| Manual Deploy latest commit de la rama configurada main, sin actualizarla antes | Seleccionaría c3e4672, no 85d604a ni la integración. Retiraría los dos commits catálogo/comercial activos y NO incorporaría Ángel y Eli ni 76c546f. |
| Desplegar main local 76c546f tras una futura actualización remota autorizada | Incorporaría endurecimiento editorial respecto del main remoto; seguiría sin los dos commits activos de catálogo/comercial y sin la entrega Ángel y Eli. |
| Desplegar específicamente HEAD integración d8194e2 | Incorporaría 76c546f y los tres commits específicos integrados; retiraría catálogo/comercial presentes en activo. NO incluiría la habilitación pública que aún está sin commit. |
| Crear una futura release con HEAD integración más el diff público actual y desplegarla | Añadiría perfil público/preview firmada, allowlist de 19 recursos y adaptador canónico de Ángel y Eli. Seguiría retirando catálogo/comercial si no se reconcilia primero la base activa. El snapshot y aprobación privados no viajan en Git ni se publican automáticamente. |
| Publicar una rama integracion/angel-eli sin cambiar la rama del servicio | No cambia qué rama usa Deploy latest commit; el servicio sigue configurado para main. No se hizo ese push ni un cambio de rama. |

Comparación real git diff 85d604a HEAD: 119 archivos, 2587 inserciones y 1499
eliminaciones, incluyendo binarios. No es un diff limitado al cliente:

- Entrarían los 17 recursos de Ángel y Eli, CSS/adaptador y pruebas/documentos ya
  versionados, además de las protecciones editoriales de 76c546f.
- Se retirarían las 44 imágenes de 22 muestras de assets/catalogo/muestras/,
  js/core/catalog-samples.js, css/comercial.css, js/comercial.js,
  js/core/commercial-contact.js e invitacion-legacy.html, entre otros archivos.
- Cambiarían index.html, catalogo.html, js/catalogo.js, css/catalogo.css,
  js/core/template-catalog.js y la allowlist estática respecto de producción.
  Se perderían el landing/contacto comercial y el catálogo/visor desplegados.
- El diff público SIN COMMIT añade después cambios en server.js, resolver,
  cliente/adaptador, perfil Node y scripts/tests; no está incluido en esos 119
  archivos como release versionada. Debe revisarse completo antes de fijar un SHA.

BLOQUEO HISTÓRICO, resuelto localmente en sección 9: no se debía desplegar la integración previa sobre el
servicio activo. Hay que acordar y preparar, bajo autorización separada, una
base de release que conserve los cambios actualmente desplegados que deban
permanecer y añada 76c546f + Ángel y Eli + habilitación pública. No se resolvió
ese problema fusionando ramas, cambiando main, cherry-pickeando más commits ni
restaurando archivos ajenos en esta tarea: el alcance actual es documentación.
No se debe presentar la exclusión histórica de commits comerciales como si no
tuviera consecuencias sobre la producción que ahora se confirmó.

No hay cambios directos entre 85d604a y HEAD en las rutas inspeccionadas de
recursos Kaly y Joha y estilos Civil/Premium. Esto no sustituye la prueba del
motor compartido sobre la futura release reconciliada. La suite local 120/120
valida el worktree actual, no una combinación futura aún inexistente ni la
conservación del catálogo activo. Esa combinación requerirá pruebas propias.

### Pendientes concretos de configuración Premium

1. Obtener una lectura privada COMPLETA y vigente de PREMIUM_AUTHORIZATION_CONFIG
   del servicio real. No se aportaron valores de variables en estas capturas y no
   se conoce todavía su inventario efectivo. No imprimirla en chat/documentos.
2. Conservar todas sus entradas, scopes, digests y revisiones históricas, incluidas
   revocaciones. La salida local de Ángel y Eli no es la configuración completa
   del servicio y NO debe reemplazarla. Recombinar solo sobre esa copia completa,
   verificar igualdad de las entradas previas y que ninguna revisión revocada se
   reactive. Los scopes efectivos se deciden por su revisión más alta.
3. Confirmar que la aprobación añadida corresponde al digest exacto del snapshot
   final privado, con nueve secciones, una Caminata tras Carpeta, Drive y horario
   aprobados. La combinación está probada localmente/simulada; falta comprobarla
   junto a todas las autorizaciones reales y snapshots actualmente servidos.
4. Verificar el valor vigente de PREMIUM_AUTHORIZATION_CHECK_ENABLED, sin cambiarlo
   silenciosamente. Si es true, validar la referencia canónica independiente
   PREMIUM_AUTHORIZATION_REFERENCE_CONTENT y exigir startup PASS. Conservar la
   referencia actual o aprobar explícitamente su sustitución, verificando también
   los eventos anteriores. Un FAIL bloquea todo Premium de ese proceso.
5. Validar presupuesto JSON y límites reales de variables de Render; conservar
   formato JSON correcto, sin doble serialización ni rutas de archivo en lugar
   del JSON. La configuración combinada debe estar versionada/respaldada en un
   canal privado, fuera de Git. Justo antes de instalarla, releer su versión para
   no pisar cambios de otro operador. No se instaló nada en este cierre.
6. Confirmar continuidad de ADMIN_PASSWORD, SUPABASE_URL/KEY, PREVIEW_SIGNING_KEY,
   ADMIN_ALLOWED_ORIGINS, TTL de preview y parámetros del limitador. La base
   pública ya se conoce, pero no se verificaron esos valores ni orígenes permitidos.
7. Acreditar compatibilidad operativa de la lectura de revisión y RPCs endurecidos
   de 76c546f antes de desplegarlo. El activo 85d604a no contiene ese commit; eso
   NO permite deducir el estado actual del esquema remoto. No ejecutar SQL ni
   quitar precondiciones para superar una incompatibilidad.
8. Leer el estado editorial real de angel-eli-boda por la API existente cuando
   haya acceso administrativo apropiado. No asumir que existe/no existe ni usar
   UUID del simulador. Tras release y autorización operativa verificadas, seguir
   E1–E10 con versión inmutable, preview firmada, aprobación y precondiciones
   frescas, sin escrituras editoriales durante esta preparación.

Persisten asimismo ID interno del servicio, runtime/build/start efectivos,
configuración de dominios y disponibilidad del acceso de lectura al panel/API.
Drive permanece aprobado por su propietario; la prueba independiente de carga
no se realizó y no se transforma en un bloqueo nuevo.

Validación de esta actualización: fetch exitoso, resolución de SHA, ancestros,
conteos de divergencia y diff real; git diff --check. No se repitieron pruebas de
producto porque solo cambió documentación. No se ejecutó commit, push, deploy,
publicación, escritura editorial, SQL ni cambios de configuración remota.

## 9. Candidato local que conserva el código activo (30/10/2026)

Se incorporó 85d604a mediante merge real, sin cherry-pick de sustitución, rebase,
amend ni reescritura. Esto resuelve localmente la divergencia de contenido descrita
en sección 8. No se modificaron main, ramas de otros worktrees ni el servicio Render.

| Dato | Resultado |
| --- | --- |
| Rama de trabajo | integracion/angel-eli. |
| Commit de merge | f7976ba6f22e6a2f4d81d85d1789f769c3ca5c9b. |
| Primer padre | d8194e2e739f82fe55f8a148575fc674978c5b0c. |
| Segundo padre | 85d604a6e75932c634aefd2ed173fd91255fc1f3. |
| 85d604a antecesor del resultado | Confirmado con merge-base --is-ancestor, salida 0. |
| 76c546f antecesor del resultado | Confirmado con merge-base --is-ancestor, salida 0. |
| main local conservado | 76c546f77ee7d7209cdb7e17dfe3d89f332cfee2. |
| origin/main almacenado | c3e4672d8e8dfdba5b4125e0e29bb777a2f167ee. No hubo fetch adicional en esta integración. |
| Cambios públicos locales anteriores | Restaurados, SIN COMMIT y sin staging; no forman parte aún del SHA de merge. |

### Revisión y conservación del contenido activo

Los dos commits exclusivos del activo eran c025024 (landing, contacto comercial,
solicitudes y página legacy) y 85d604a (22 muestras, 44 imágenes y visor).
El merge fue automático, sin conflictos. No se tomaron decisiones que alteren
el comportamiento aprobado ni se descartaron cambios de una de las líneas.

Antes de completar el merge se verificó que los 61 archivos de catálogo/comercial
exceptuando la política estática coinciden con el contenido de 85d604a, normalizando
solo CRLF/LF en texto y comparando bytes exactos de binarios. La política combinada
coincidió exactamente con la del activo más la entrada editorial de 76c546f.
No hay archivos eliminados respecto de 85d604a en el commit resultante.

Quedan conservados index.html, catalogo.html, el visor y sus módulos, contacto
comercial, invitacion-legacy.html, los tests de catálogo/comercial y las 44 imágenes.
También quedan conservados 76c546f, la entrega base de Ángel y Eli, portada,
firma flotante, música, secciones/animaciones aprobadas y las protecciones del motor.
No se modificaron recursos ni datos de Kaly y Joha o Civil.

El commit de merge incluye la adaptación necesaria del hash literal esperado en
el test de aislamiento al baseline activo+editorial auditado. No se eliminaron
aserciones, no se calcularon expectativas desde el archivo bajo prueba y no se
alteraron los otros cinco hashes protegidos.

### Preservación de los cambios locales sin commit

Antes del merge se respaldaron los 13 archivos explícitos no privados. Se guardó
un stash limitado a esas rutas, sin .dev/premium, .env ni secretos:
9b6d94f6674f8fa9668f49a9eaf336bc9c46da64.
Se mantiene como respaldo de recuperación; NO debe aplicarse otra vez sobre el
worktree actual, porque el contenido ya fue restaurado.

Respaldo adicional fuera de Git: la ruta está en
%TEMP%/angel-eli-before-active-merge-path.txt; el directorio referenciado contiene
los archivos no privados y un manifiesto de hashes. Los privados solo se
verificaron por hash; no se copiaron al stash ni al commit.

Once archivos locales se restauraron idénticos (comprobación de contenido con
normalización CRLF/LF), antes de actualizar los informes por esta etapa. Los dos
puntos compartidos se combinaron de forma mecánica:

- backend/http/static-policy.js conserva catálogo/comercial y editorial más las
  19 rutas exactas públicas previamente aprobadas para Ángel y Eli.
- test/angel-eli-local.test.js conserva los cambios públicos locales y el hash
  literal de la política combinada, sin reducir la protección.

La restauración no produjo conflictos. Los archivos privados
.dev/premium/angel-eli-public.event.json y
.dev/premium/angel-eli-public.authorization.json permanecen byte a byte idénticos
al inicio. Ninguno está versionado. La habilitación pública, sus archivos nuevos
y documentación siguen pendientes de un commit específico autorizado; no se
mezclaron silenciosamente con el commit de merge.

### Validaciones ejecutadas

- Node 22.23.4, suite completa del merge limpio: 118/118 aprobadas. El merge se
  completó después de esa validación y de revisar el índice sin archivos privados.
- Node 22.23.4, suite completa tras restaurar la habilitación pública: 126/126
  aprobadas, 0 fallidas/omitidas. Incluye catálogo/muestras/visor, comercial,
  Kaly y Joha, Civil, Ángel y Eli público/preview firmada, autorización y
  precondiciones editoriales. Operaciones editoriales solo simuladas.
- git diff --check y revisión del índice del merge: sin errores de espacios.
- Prueba real HTTP del simulador existente: GET 200 y bytes iguales a 85d604a
  en las 44 imágenes; landing, catálogo, legacy, módulos comerciales y módulo
  editorial 200; respuesta pública Ángel y Eli con nueve secciones y una Caminata;
  privados/desconocidos 404.
- No se repitió Chrome en esta etapa: no se cambió el diseño aprobado. Las pruebas
  de esta etapa son la suite Node, auditorías Git/bytes y HTTP real local.

Logs fuera del repositorio:

- %TEMP%/angel-eli-preserve-active-merge-node22.log (118/118).
- %TEMP%/angel-eli-preserve-active-full-node22.log (126/126).
- %TEMP%/angel-eli-preserve-active-http-audit.log (HTTP y 44 binarios).

La preview existente se reinició con el mismo script y Node 22 para cargar la
política combinada; no se creó otro servidor de aplicación. Sigue disponible:

    http://127.0.0.1:4186/invitacion.html?id=angel-eli-boda

El primer intento de reinicio encontró el puerto ocupado y permitió detectar
que aún respondía el proceso anterior con su política en memoria. Se sustituyó
solo el proceso conocido de esta sesión; la auditoría HTTP final pasó contra
el nuevo proceso. No se modificó código para resolver esa situación.

### Qué es candidato a desplegar ahora y qué sigue pendiente

f7976ba conserva ya todo el código versionado de la base activa, sus funciones
comerciales, endurecimiento editorial y entrega Ángel y Eli. Desplegar ESTE SHA
por sí solo todavía NO incorpora la habilitación pública que está sin commit.
El candidato funcional probado es f7976ba más el diff local público restaurado;
no tiene aún un SHA único y no debe describirse como una release lista para deploy.
El snapshot/autorización privados tampoco se envían ni publican automáticamente.

El bloqueo de pérdida de catálogo/comercial queda resuelto en la rama LOCAL.
La rama conectada de Render sigue siendo main y su Auto-Deploy sigue Off según
la confirmación aportada, sin cambios de configuración. Un Deploy latest commit
hoy seguiría seleccionando el main remoto c3e4672, NO este candidato. Ninguna
referencia remota se actualizó durante esta tarea.

Pendientes reales antes de cualquier publicación:

1. Revisión/aprobación y commit específico del diff público preservado y sus
   documentos, excluyendo todos los privados; después, integración/remoto y
   despliegue del SHA definitivo únicamente con autorización separada.
2. Lectura privada de la configuración OPERATIVA completa de
   PREMIUM_AUTHORIZATION_CONFIG. Combinar sobre ella la aprobación del digest
   definitivo sin perder otros eventos, revisiones, revocaciones ni scopes.
   No reemplazarla por la lista local de Ángel y Eli. Revalidar todos los Premium
   conocidos y el digest del snapshot privado con el proveedor combinado.
3. Verificar CHECK_ENABLED y REFERENCE_CONTENT vigentes, preservar o aprobar su
   ajuste explícito, límites reales de variables de Render y startup PASS si el
   chequeo está activo. Respaldar/reconciliar la versión de configuración antes
   de una instalación futura; un FAIL puede bloquear todo Premium.
4. Confirmar secretos/orígenes/limitadores/preview vigentes y compatibilidad real
   de contratos endurecidos 76c546f. No ejecutar SQL ni quitar precondiciones.
5. Obtener el estado editorial remoto de Ángel y Eli mediante la API existente,
   preparar versión inmutable con expectativas frescas, comprobar snapshot
   persistido y preview firmada, y aprobar visualmente antes de publicar.
   No usar UUID simulados, publicar por CLI genérico ni escribir directamente en DB.
6. Identificar ID interno y ajustes efectivos de build/start/runtime del servicio
   y acreditar el SHA al desplegar. La aprobación del propietario de Drive sigue
   confirmada y separada de la prueba independiente de carga no realizada.

No se hizo push, deploy, publicación ni escritura remota/SQL/Supabase. No se
reescribieron commits, no se modificaron main u otros worktrees y no se añadieron
archivos privados al historial. El único commit creado fue el merge local descrito.

## 10. Corrección del destino de Fiesta (30/10/2026)

Destino exacto solicitado y aplicado:
https://maps.app.goo.gl/NCyLci7MA9XXWAwG9.

La consulta GET del enlace devolvió 302 hacia Google Maps /place/Hernán Cortez
1710, B1812 Carlos Spegazzini, Provincia de Buenos Aires; el destino devolvió 200.
Esto DIFIERE del texto aprobado vigente: Hernán Cortés 17. Se informó la diferencia
al usuario antes de cambiar texto. No se cambió la dirección escrita ni el diseño;
queda pendiente su confirmación para corregir también el texto y el campo address.
La afirmación histórica de dirección y mapa coincidentes deja de aplicar desde
esta corrección. La ciudad/provincia coinciden, pero difieren número y grafía.

Se actualizó únicamente location.maps_url en el snapshot definitivo privado de
Ángel y Eli. backend/premium/angel-eli-profile.js incorpora el destino exacto en
el contrato y scripts/prepare-angel-eli-public.js lo asigna al preparar el contenido
final: una futura regeneración/publicación no recuperará el enlace de búsqueda
anterior. El adaptador sigue leyendo event.googleMapsUrl desde ese contenido,
sin hardcodear un segundo destino contradictorio en el botón.

El nuevo contenido tiene otro digest. Se añadió su aprobación al archivo privado
combinado local conservando todas las entradas anteriores, sin sobrescribir scopes
ni revocaciones. Los dos archivos privados siguen ignorados, fuera de Git. Para
producción habrá que combinar la aprobación del snapshot ACTUAL, no una copia
anterior al cambio de Maps, con la configuración operativa completa ya requerida.
No se modificó ninguna autorización o configuración remota.

Verificación ejecutada: 27/27 pruebas pertinentes con Node 22.23.4 (perfil público,
fuente local, portada/audio, animación de palabras y Caminata); assert del URL final
y de la normalización al motor, además de rechazo del enlace antiguo en el perfil.
Chrome móvil 390 px y escritorio 1366 px: clic real del botón abre otra pestaña de
Maps, href exacto, target blank y rel noopener noreferrer. Permanecen nueve secciones
y horario 20:00 hs. a 4:00 a.m hs; la dirección visible conserva el texto anterior.
No se editaron lugares ni se enviaron cambios a Google Maps.

La vista previa existente se reinició con el mismo script y Node 22 para cargar
el snapshot/autorización nuevos. GET de página y API comprobados; disponible en:
http://127.0.0.1:4186/invitacion.html?id=angel-eli-boda.

Logs: %TEMP%/angel-eli-map-correction-node22.log y
%TEMP%/angel-eli-map-button-browser.log. git diff --check sin errores.
Sin commit, push, deploy, publicación ni cambios de Kaly y Joha o Civil.

## 11. Dirección confirmada por el propietario y aplicada (30/10/2026)

El propietario confirmó reemplazar el texto de Fiesta por Hernán Cortez 1710.
Se aplicó; queda resuelta la diferencia pendiente descrita en la sección 10.

Fuente definitiva y snapshot privado coinciden:

- location.address: Hernán Cortez 1710, Carlos Spegazzini, Buenos Aires.
- Fiesta data.address y capa visible: Hernán Cortez 1710.
- location.maps_url: https://maps.app.goo.gl/NCyLci7MA9XXWAwG9, sin cambios.
- Localidad: Carlos Spegazzini, Buenos Aires, sin cambios.
- Horario: 20:00 hs. a 4:00 a.m hs, sin cambios.

backend/premium/angel-eli-profile.js fija dirección canónica y calle de Fiesta;
scripts/prepare-angel-eli-public.js asigna ambos datos al preparar el contenido;
js/events/angel-eli-presentation.js usa el campo canónico para la capa HTML y
conserva la corrección en su texto de respaldo. El contrato rechaza una dirección
anterior en cualquiera de esos dos campos. Las pruebas cubren esa consistencia.

El snapshot .dev/premium/angel-eli-public.event.json fue actualizado solo en los
campos de dirección. Su digest cambió y se añadió la aprobación correspondiente
a .dev/premium/angel-eli-public.authorization.json, preservando todas las entradas
previas. Ambos siguen privados/ignorados. La futura configuración operativa debe
combinar la aprobación del snapshot vigente, no una anterior a esta corrección.
No se cambió ningún secreto ni autorización de producción.

La revisión visual inicial mostró un salto de 1710 a otra línea que rozaba el
ícono del fondo. Se ajustó exclusivamente el tamaño de .ae-copy--address en el
CSS del evento, de 7.5cqw a 7.4cqw, conservando posición, tipografía, peso, color,
contenido posterior, imágenes y animaciones. La dirección completa queda ahora
en UNA línea y el ícono permanece despejado. No se modificaron fondos ni recursos.

Validación: 27/27 pruebas pertinentes con Node 22.23.4; Chrome escritorio 1366 px,
móvil 390 px y 320 px con fuentes cargadas: palabras en la misma línea, todas
dentro de la tarjeta, separación de título/localidad/horario y sin desbordamiento.
Se comprobó animación de palabras activa y se revisó la captura con movimiento
reducido para visualizar el texto completo; conserva la distribución fija durante
el ciclo. Revisión visual de la captura móvil confirmó el ícono despejado.

Logs y capturas fuera de Git: %TEMP%/angel-eli-address-node22.log,
%TEMP%/angel-eli-address-browser.log y %TEMP%/angel-eli-address-{mobile,desktop,320}.png.
La preview existente quedó reiniciada con el mismo script y Node 22 y el snapshot
actualizado en http://127.0.0.1:4186/invitacion.html?id=angel-eli-boda.
Sin commit, push, deploy, publicación ni cambios de Kaly y Joha o Civil.

## 12. Cierre local de habilitación pública y dirección confirmada (30/10/2026)

Se revisó el diff completo y se seleccionaron explícitamente los 14 archivos de
esta entrega, incluidos los archivos nuevos y los informes. El commit que contiene
esta sección es un hijo nuevo de f7976ba6f22e6a2f4d81d85d1789f769c3ca5c9b, sin amend.
Su hash se consulta con git log -1: el documento no puede incorporar su propio SHA.
Los commits anteriores y la integración del código desplegado se conservan.

### Manifest explícito del commit

    backend/http/static-policy.js
    backend/premium/angel-eli-profile.js
    css/events/angel-eli.css
    docs/angel-eli-integration-local.md
    docs/angel-eli-operational-runbook.md
    js/core/invitation-data-source.js
    js/core/public-event-resolver.js
    js/events/angel-eli-presentation.js
    js/invitacion.js
    scripts/angel-eli-public-preview.js
    scripts/prepare-angel-eli-public.js
    server.js
    test/angel-eli-local.test.js
    test/angel-eli-public.test.js

Se guardan perfil confiable público/preview firmada, validación Premium existente,
allowlist de 19 rutas exactas, contrato de nueve secciones, render único de Caminata,
fuente de dirección y enlace correctos, scripts locales y pruebas. Continúan
vigentes 76c546f, catálogo/comercial y las 44 imágenes del activo 85d604a.
No se incorporan archivos de otros worktrees, SQL, credenciales, snapshots reales,
autorizaciones ni ningún archivo de .dev/premium. Los fixtures de las pruebas son
sintéticos y no contienen valores privados del evento real.

Dirección final: Hernán Cortez 1710; localidad Carlos Spegazzini, Buenos Aires;
Maps https://maps.app.goo.gl/NCyLci7MA9XXWAwG9; Fiesta 20:00 hs. a 4:00 a.m hs.
La fuente definitiva privada, el perfil, su preparación y la presentación coinciden.
Se conserva el ajuste aprobado de 7.4cqw para evitar salto/superposición.

### Revisión y depuración de aprobaciones locales de Ángel y Eli

Se auditó el archivo privado ACTIVO del simulador. Tenía cuatro aprobaciones de
Ángel y Eli: una vigente y tres de estados anteriores (preview local inicial,
primera preparación pública y cambio de Maps previo a confirmar la dirección).
Solo existe angel-eli-public.event.json como snapshot local de Ángel y Eli en
este worktree; el simulador declara una única versión en memoria y no persiste
versiones editoriales. Los archivos requeridos por la preview legacy local no
están en este worktree. Ninguno de esos tres digests anteriores es necesario
para el procedimiento local activo, y no se conserva como aprobación operativa.

Se retiraron únicamente esas tres entradas approved del archivo privado activo,
conservando una aprobación válida para el digest definitivo actual. La copia
previa se archivó como respaldo privado de auditoría en
%TEMP%/angel-eli-authorization-before-final-cleanup-*/authorization.private.json,
fuera de Git y fuera de la configuración que carga el simulador. No debe usarse
como reemplazo automático de la configuración depurada.

Se preservaron por igualdad las entradas de otros eventos y todas las revocaciones;
en este archivo concreto sus cantidades eran cero. NO se afirma que sea el
inventario completo de producción. Ninguna autorización/revocación de otros
archivos o eventos se modificó. El snapshot definitivo no cambió en esta depuración.

El proveedor privado combinado y el mismo servicio editorial aceptaron el
contenido vigente; startup PASS; cero llamadas al adaptador de escritura.
Los tres scopes antiguos retirados ya no tienen estado de autorización en ese
archivo. La simulación se reinició usando la lista depurada y continúa disponible.
Auditoría sin secretos ni digests en el informe:
%TEMP%/angel-eli-final-authorization-audit.json.

El helper addAuthorization se mantiene aditivo para la futura combinación con
la configuración REAL completa: no elimina automáticamente digests de otras
versiones potencialmente publicadas o necesarias para rollback. Cualquier limpieza
futura de Ángel y Eli debe justificar las referencias publicadas/de trabajo y el
procedimiento de recuperación antes de retirar aprobaciones; no se extrapola esta
limpieza de un simulador de una versión al estado remoto desconocido. Se preservan
siempre revocaciones y otros eventos. No se acumulan aprobaciones locales obsoletas
sin propósito ni se reinstala la lista histórica al preparar el despliegue.

### Validación final y configuración remota aún pendiente

- Suite completa repetida con Node 22.23.4: 126/126 aprobadas, cero fallidas u omitidas.
  Log: %TEMP%/angel-eli-public-final-commit-node22.log. Incluye catálogo/comercial,
  Kaly y Joha, Civil, Ángel y Eli, preview firmada, autorización y concurrencia.
- git diff --check y revisión del índice seleccionado: sin errores.
- Dirección, localidad, Maps y horario validados por contrato y pruebas. Chrome
  de la etapa anterior comprobó escritorio/móvil/320 px y texto en una sola línea,
  sin cortes ni superposición; no se cambió diseño ni se repitió Chrome en este cierre.
- Aceptación real local de la configuración privada depurada y GET de la vista
  previa. Archivos privados permanecen ignorados y excluidos del commit.

Pendientes bloqueantes de producción, sin modificaciones remotas en este cierre:

1. Obtener/verificar la configuración Premium OPERATIVA completa de Render y las
   versiones realmente publicadas/de trabajo de los eventos. Esta lista local
   depurada no puede reemplazar PREMIUM_AUTHORIZATION_CONFIG del servicio.
2. Combinar la aprobación del digest definitivo con esa configuración completa,
   preservando todas las autorizaciones/revocaciones de otros eventos y aprobaciones
   de Ángel y Eli que tengan una necesidad operativa demostrada. Si la configuración
   cambió desde su exportación, detenerse/recombinar antes de instalarla.
3. Verificar CHECK_ENABLED, referencia canónica independiente, límites de variables
   y startup PASS si corresponde; mantener secretos, orígenes y limitadores vigentes.
4. Acreditar compatibilidad real de los contratos de lectura/RPC de 76c546f sin
   SQL directo ni debilitamiento de precondiciones. Identificar ID interno Render,
   runtime/build/start efectivos y release/ramas a desplegar.
5. Autorizar por separado integración/remoto y despliegue del SHA final revisado.
   Render sigue con main y Auto-Deploy Off según la confirmación aportada; no se
   cambió. Un Deploy latest commit no selecciona una rama local por sí mismo.
6. Leer/reconciliar el estado editorial real de angel-eli-boda, crear/reutilizar la
   versión correcta mediante API existente, comprobar snapshot persistido y preview
   firmada, aprobar visualmente y publicar solo con autorización posterior y
   precondiciones frescas. No usar UUID simulados ni el CLI genérico como atajo.

Drive permanece aprobado por su propietario, separado de una prueba técnica de
carga independiente no realizada. No es un nuevo bloqueo automático.
No se hizo push, deploy, publicación ni escritura SQL/Supabase. main, otros
worktrees, Kaly y Joha y Civil permanecen intactos.
