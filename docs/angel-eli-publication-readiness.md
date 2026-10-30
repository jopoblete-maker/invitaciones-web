# Ángel y Eli: cierre local y preparación de publicación

Auditoría local del 29 de octubre de 2026, actualizada para conservar los ajustes
visuales aprobados posteriores a f55ca5e en un nuevo commit local, sin amend.
Este cierre solo actualiza documentación y conserva los cambios existentes;
no introduce cambios adicionales en el diseño. No se ejecutan fetch, push,
merge, cherry-pick, despliegue, publicación editorial ni operaciones directas
contra SQL o Supabase.

**Resultado: versión visual local conservada y probada; publicación bloqueada
hasta completar la habilitación pública y la preparación editorial descritas aquí.**

## 1. Git y alcance

- Rama: cliente/angel-eli.
- Base conservada: f55ca5e1e54495d1214ed3cc6d8561cbc6016d15,
  feat(angel-eli): preserve approved local invitation; contiene 32 archivos.
- El nuevo commit debe ser hijo directo de esa base e incluir únicamente los
  cuatro archivos de ajustes indicados abajo. Su SHA se consulta con git log -1;
  este informe se incluye en él y por eso no incorpora su propio hash.
- No se modifica ni se reemplaza f55ca5e.
- main local: 76c546f77ee7d7209cdb7e17dfe3d89f332cfee2.
- Ancestro común main/HEAD: c3e4672d8e8dfdba5b4125e0e29bb777a2f167ee.
- Esta rama contiene, además de los commits de Ángel y Eli, dos commits ajenos
  ausentes de main: c025024 (comercial) y 85d604a (catálogo).
  main contiene 76c546f (precondiciones editoriales), ausente
  de esta rama. **No integrar la rama completa como si solo contuviera Ángel y Eli.**
- origin/main almacenado localmente apunta a c3e4672. No se hizo fetch:
  esto NO describe necesariamente el estado remoto actual.
- El worktree de main contiene dos recursos ajenos sin seguimiento:
  cierre-premium.webp y ornamento-floral.svg, dentro de
  assets/templates/boda-fiesta-premium/. No se modificaron. La integración debe
  realizarse en un worktree aparte.

## 2. Archivos del nuevo commit y entrega ya conservada

Selección explícita del nuevo commit, sin archivos compartidos ni recursos nuevos:

    css/events/angel-eli.css
    js/events/angel-eli-presentation.js
    test/angel-eli-playback.test.js
    docs/angel-eli-publication-readiness.md

El inventario siguiente ya está versionado en f55ca5e; no debe volver a añadirse
como si fuera trabajo pendiente ni arrastrar commits de catálogo/comercial.

Los cuatro archivos compartidos incluidos en f55ca5e:

    js/core/invitation-data-source.js
    js/invitacion.js
    scripts/dev-preview-server.js
    scripts/premium-local-preview.js

Los diez archivos de código, pruebas y fixture incluidos en f55ca5e:

    css/events/angel-eli.css
    js/events/angel-eli-presentation.js
    scripts/angel-eli-local-input.js
    scripts/angel-eli-preview-profile.js
    scripts/preview-angel-eli.js
    test/angel-eli-local.test.js
    test/angel-eli-playback.test.js
    test/angel-eli-text-animation.test.js
    test/angel-eli-walking-video.test.js
    test/fixtures/angel-eli.synthetic.json

Los diecisiete recursos conservados, incluidos los originales no mostrados:

    assets/events/angel-eli/angel-eli-caminata.mp4
    assets/events/angel-eli/carpeta.png
    assets/events/angel-eli/cierre.png
    assets/events/angel-eli/confirmacion.png
    assets/events/angel-eli/fiesta.png
    assets/events/angel-eli/historia.png
    assets/events/angel-eli/musica.mp3
    assets/events/angel-eli/pareja.png
    assets/events/angel-eli/portada.mp4
    assets/events/angel-eli/regalos.png
    assets/events/angel-eli/vestimenta.png
    assets/events/fondos-sin-texto/asistencia-fondo.png
    assets/events/fondos-sin-texto/carpeta-fondo.png
    assets/events/fondos-sin-texto/cierre-fondo.png
    assets/events/fondos-sin-texto/fiesta-fondo.png
    assets/events/fondos-sin-texto/regalos-fondo.png
    assets/events/fondos-sin-texto/vestimenta-fondo.png

Documentación incluida en ambos cierres:

    docs/angel-eli-publication-readiness.md

Los recursos suman 43.740.317 bytes y ya están versionados en f55ca5e.

Fuera del commit: node_modules, credenciales, .env y los tres archivos privados
.dev/premium/angel-eli-boda.event.json, .authorization.json y .local-version.json.
Estos últimos están ignorados y son necesarios para reconstruir la vista previa
comercial local. Conservarlos por el canal privado; no forzar su inclusión en Git.
El fixture del test es sintético y no reemplaza los datos reales.

## 3. Contenido y recursos confirmados

Orden visual final: nueve secciones con desplazamiento vertical, sin barra
numérica ni espacio reservado para ella:

1. Portada: portada.mp4.
2. Nuestra historia: historia.png.
3. Fiesta: fiesta-fondo.png y capas HTML.
4. Asistencia: asistencia-fondo.png y capas HTML.
5. Vestimenta: vestimenta-fondo.png y capas HTML.
6. Regalos: regalos-fondo.png y diálogo existente.
7. Carpeta compartida: carpeta-fondo.png y enlace habilitado.
8. Caminata: angel-eli/angel-eli-caminata.mp4.
9. Cierre: cierre-fondo.png y tres líneas «Ángel», «y», «Eli».

El archivo de Caminata está dentro de assets/events/angel-eli/, no directamente
en assets/events/. Es vertical, 720 × 1080; la última comprobación en Chrome
registró 390 × 585 en móvil y 540 × 810 en escritorio, sin deformación.

Horario visible de Fiesta: 20:00 hs. a 4:00 a.m hs.

Destino exacto del botón:

    https://drive.google.com/drive/folders/16IxkPzVLFbdmBiKsCoyjmjMZU82ByYul?usp=drive_link

Es un enlace con target="_blank" y rel="noopener noreferrer". No se verificaron
los permisos de carga con otra cuenta.

La portada conserva su bloqueo inicial y la salida accesible ante fallo.
Su ancho máximo es 540 px, centrado y alineado con Nuestra historia; el video
se muestra completo, sin recorte ni deformación y sin hueco superior.
La firma «YCOR Digital ✦ Pedí la tuya» es una única instancia flotante abajo
a la izquierda, fuera del Cierre. Conserva el componente comercial existente,
formato de la referencia final local de Kaly y Joha y enlace
https://wa.me/5491157339281 con target="_blank" y rel="noopener noreferrer".
Permanece oculta e inerte hasta terminar la portada o usar Continuar; después
queda disponible al recorrer la invitación. Respeta áreas seguras y evita
solaparse con las acciones. El panel conserva apertura, cierre y Escape.
Caminata tiene su controlador de visibilidad independiente, no bloquea scroll
y no interviene sobre la música. Las seis capas animadas están identificadas por
contenido, no por número: fiesta, confirmacion, vestimenta, regalos,
carpeta-compartida y cierre. La espera completa dura 2.000 ms después de terminar
la aparición de la última palabra; movimiento reducido deja todo fijo.

## 4. Validaciones y aislamiento

- Suite completa con Node 22.23.4: 117 pruebas, 117 aprobadas, 0 fallidas.
- Comando ejecutado: node.exe --test, con el binario Node 22 indicado abajo.
- git diff --check: salida 0; solo avisos informativos de conversión LF/CRLF.
- Auditoría base: recursos originales del snapshot verificados por el loader
  local y autorización/preparación Premium local aceptadas.
- Auditoría base: 17 recursos multimedia y el JS/CSS del evento, 19 respuestas HTTP 200 en
  la vista previa local.
- En esa auditoría, la política estática de producción se ejercitó con Express en un puerto
  loopback temporal, sin iniciar el servidor real ni acceder a Supabase:
  los mismos 19 recursos devolvieron HTTP 404, como exige hoy la allowlist.
- Auditoría base: selector devDraft=angel-eli-boda en hostname no local, invalid-preview.
- Este cierre confirmó HTTP 200 para la URL de vista previa local.
- La verificación Chrome más reciente del diseño aprobado comprobó escritorio
  (1366 px), móvil (390 px) y 320 px: nueve secciones, sin barra numérica,
  sin hueco superior ni desbordamiento horizontal; portada y sección siguiente
  con idéntico ancho y alineación, antes y después de desbloquear.
- El recorrido de firma flotante comprobó ocultación inicial, final natural,
  fallo y Continuar, apertura/cierre/Escape y separación de acciones y música.
  La última comprobación de portada conservó las verificaciones de firma,
  música y animación. Los bucles, pausa y regreso de Caminata se comprobaron
  en el recorrido anterior; su controlador no cambió desde entonces.
- Este cierre repitió la suite completa, no los recorridos de Chrome: conserva
  las evidencias del código aprobado, sin afirmar una nueva prueba de navegador.

No hay diferencias de estos ajustes frente a f55ca5e en recursos Kaly y Joha, recursos
y stylesheet Civil, RSVP compartido, registro de templates, backend o SQL.
Las pruebas de Kaly y Joha, Civil, autorización y publicación forman parte de la
suite completa aprobada. El adaptador exige ID, variante, modo local y perfil
de Ángel y Eli; la música automática nueva solo se activa para ese contexto.

Los cuatro archivos compartidos de f55ca5e sí requieren revisión al integrar.
No se modificaron nuevamente en este cierre. En particular,
la decoración antes aplicada a todo boda-fiesta-premium ahora se limita a los
dos IDs de Kaly ya contemplados; se conserva su ruta, pero no debe presentarse
este cambio como si no hubiera edición de código compartido.

Este resultado cubre el worktree actual. No se probó aún la futura integración
con main ni una versión pública, y no se verificó el estado de producción remoto.

## 5. Bloqueos de publicación

1. El adaptador solo se habilita con source.mode local-premium, loopback y
   eventProfile angel-eli-local-v1. La ruta pública no lo ejecuta.
2. La allowlist de backend/http/static-policy.js no sirve los 19 recursos nuevos.
   Debe ampliarse con rutas exactas, preservando todas las reglas existentes;
   no abrir directorios enteros ni exponer .dev.
3. La respuesta Premium pública no emite el perfil específico que necesita el
   adaptador. La preview editorial firmada devuelve el contenido sin las pistas
   Premium y el cliente solo obtiene esas pistas en modo local-premium o public.
   Falta habilitar ambos recorridos con autorización del servidor, sin confiar
   en permisos declarados por el contenido ni retirar controles de otros eventos.
4. El snapshot privado tiene nueve secciones FUENTE, pero incluye
   fotografia-pareja y no incluye Caminata. El adaptador descarta la primera y
   agrega la segunda. El snapshot conserva 18:30 h y no lleva data.url para
   carpeta-compartida; el horario final, Drive y fondos se definen en el adaptador.
   Antes de publicar hay que preparar un snapshot/contrato de presentación
   versionado coherente con la versión visual final y sus recursos, incluida la
   firma flotante, ausencia de barra numérica y portada alineada a 540 px. No publicar
   el JSON actual por el simple hecho de que también tenga nueve secciones.
5. Falta instalar y verificar la autorización Premium OPERATIVA para el digest
   exacto del contenido definitivo. La autorización de .dev es solo local.
   Conservar las entradas existentes de otros eventos, incluidas revocaciones;
   no reemplazar la configuración productiva por el archivo local de Ángel y Eli.
6. El CLI publish:event llama al validador genérico sin contexto Premium. La
   comprobación local devuelve INVALID para Vestimenta y Regalos por opciones
   estructurales Premium ausentes. No recomendar ese CLI como publicador listo
   para este evento; no usar --legacy ni --overwrite para evitar la validación.
   La API editorial autenticada y su servicio Premium son el recorrido existente.
7. La integración con main debe conservar 76c546f. El test local de protección
   fija el hash de static-policy.js de HEAD, que ya difiere legítimamente del de
   main por las precondiciones editoriales. Habrá que revisar esa aserción contra
   la base integrada y las ampliaciones autorizadas; no cambiar hashes a ciegas.
8. No hay descriptor ni workflow de despliegue en el repositorio: solo CI de tests.
   Falta confirmar proveedor, servicio, rama desplegada, dominio y si un push
   dispara auto-deploy. No se puede dar un comando específico del proveedor como
   verificado. El runtime existente es Node/Express, no un sitio estático.

## 6. Procedimiento futuro: conservación e integración

La conservación local de la entrega base ya se realizó en f55ca5e. El cierre
actual autoriza únicamente un segundo commit local con los cuatro ajustes.
Ninguno de ellos declara que la publicación esté lista.

En este worktree, revisar nuevamente estado, rama y Node 22. Añadir únicamente:

    git add -- css/events/angel-eli.css js/events/angel-eli-presentation.js test/angel-eli-playback.test.js docs/angel-eli-publication-readiness.md
    git diff --cached --check
    git diff --cached --stat
    git diff --cached --name-only
    git commit -m "fix(angel-eli): finalize cover and floating branding"

Todo el procedimiento restante es FUTURO y NO EJECUTADO. Después del segundo
commit, guardar su SHA. Solo cuando se habiliten operaciones
remotas: ejecutar git fetch origin y revisar nuevamente main...origin/main.
Resolver la diferencia de la base editorial antes de definir el destino:
no sobrescribir main ni su commit 76c546f, no mover los recursos ajenos de su
worktree y no suponer que origin/main sigue en el SHA observado hoy.

Con una base main ya acordada, un worktree de integración separado evita
arrastrar los commits de catálogo/comercial:

    $aeBase = 'f55ca5e1e54495d1214ed3cc6d8561cbc6016d15'
    $aeAdjustments = (git rev-parse cliente/angel-eli).Trim()
    if ((git rev-parse "$aeAdjustments^").Trim() -ne $aeBase) { throw 'Revisar el rango antes de integrar' }
    git worktree add -b integracion/angel-eli ../invitaciones-web-integracion-angel-eli main
    git -C ../invitaciones-web-integracion-angel-eli cherry-pick $aeBase $aeAdjustments

Es imprescindible integrar ambos commits en ese orden: el segundo por sí solo
no incluye la entrega base ni sus recursos. No sustituir estos cherry-picks por
merge de toda cliente/angel-eli. En esa rama
separada completar los bloqueos públicos sin modificar el diseño, y crear otro
commit para esa habilitación. Revisar la diferencia frente a la base acordada,
ejecutar la suite completa en Node 22, probar la preview editorial persistida y
el aislamiento Kaly/Civil. La suite actual no sustituye esa validación integrada.

Solo después, y tras confirmar qué dispara auto-deploy, publicar la rama:

    git push -u origin integracion/angel-eli

Abrir PR a la base main acordada; esperar el CI de .github/workflows/test.yml
(npm ci --no-audit --no-fund y npm test, Node 22), revisar y autorizar la
integración. Registrar el SHA resultante para el despliegue.

## 7. Procedimiento futuro: despliegue técnico

Después de identificar el servicio real y de autorizarlo:

1. Desplegar el SHA integrado y revisado usando el mecanismo de ese servicio.
   No atribuir a GitHub Actions un deploy que este repositorio no configura.
2. Runtime Node 22; instalación npm ci --omit=dev; inicio npm start, que ejecuta
   node server.js. No existe una etapa npm run build. PORT lo suministra el host
   o se usa 3000.
3. Conservar ADMIN_PASSWORD, SUPABASE_URL, SUPABASE_KEY y las políticas
   administrativas existentes. No copiar .env ni credenciales al commit.
4. Instalar la configuración Premium privada ya revisada mediante los secretos
   del servicio, preservando otros eventos. Si se activa el chequeo:
   PREMIUM_AUTHORIZATION_CHECK_ENABLED=true,
   PREMIUM_AUTHORIZATION_REFERENCE_CONTENT=contenido canónico exacto y
   PREMIUM_AUTHORIZATION_CONFIG=configuración combinada. Exigir
   PREMIUM_STARTUP_AUTHORIZATION PASS y verificar que otros Premium sigan
   disponibles; un FAIL afecta el acceso Premium de ese proceso.
5. Verificar los recursos permitidos, reproducción de ambos MP4 (incluido Range
   206), audio, fuentes y CSS/JS. Probar el ID/perfil correcto; no usar la ruta
   loopback como URL entregable. Controlar caché para que sirva el SHA nuevo.

El proveedor, comando de despliegue específico y URL productiva quedan
pendientes de identificación; no fueron consultados ni modificados remotamente.

## 8. Procedimiento futuro: publicación editorial

Despliegue de código y publicación del evento son operaciones distintas.
El flujo existente usa eventos/event_versions y sus punteros; las escrituras
se hacen por API administrativa, nunca con UPDATE/INSERT ni con un cliente
directo a Supabase.

Precondiciones: bloqueos de la sección 5 resueltos, dominio y Origin permitidos
confirmados, credencial administrativa en un canal privado y snapshot definitivo
validado por el servicio Premium. Usar exclusivamente eventId angel-eli-boda.
No confundir el UUID de .local-version.json con una versión persistida.

Solicitudes autenticadas con X-Admin-Password; POST con Content-Type
application/json y Origin administrativo permitido. No registrar credenciales.

| Paso | Método y ruta | Cuerpo y comprobación |
| --- | --- | --- |
| Leer estado | GET /api/admin/eventos/angel-eli-boda | Obtener punteros y versiones actuales. Solo un EVENT_NOT_FOUND/404 confirmado permite tratarlo como evento nuevo. |
| Crear evento nuevo | POST /api/admin/eventos | eventId="angel-eli-boda", content=snapshot definitivo. Guardar versionId devuelto. |
| Crear versión existente | POST /api/admin/eventos/angel-eli-boda/versions | content, expectedWorkingVersionId explícito del GET, sourceVersionId=currentWorkingVersionId o publishedVersionId o null; initialWorkflow="draft". Nunca sobreescribir una versión inmutable. |
| Verificar snapshot | GET /api/admin/eventos/angel-eli-boda/versions/UUID | Comparar contenido persistido con el definitivo antes de avanzar. |
| Preview privada | POST /api/admin/eventos/angel-eli-boda/versions/UUID/preview | Abrir /invitacion.html?previewToken=TOKEN extraído del previewUrl devuelto. El enlace tiene caducidad. Validar nueve secciones, recursos, música, videos, animaciones y botones. |
| Enviar a revisión | POST /api/admin/eventos/angel-eli-boda/versions/UUID/workflow | {"expectedStatus":"draft","targetStatus":"in_review"}. |
| Aprobar | POST /api/admin/eventos/angel-eli-boda/versions/UUID/workflow | Tras aprobación visual: {"expectedStatus":"in_review","targetStatus":"approved"}. |
| Releer estado | GET /api/admin/eventos/angel-eli-boda | Confirmar UUID aprobado y punteros actuales; guardar publishedVersionId y publicationRevision frescos. |
| Publicar | POST /api/admin/eventos/angel-eli-boda/versions/UUID/publish | En la base main con 76c546f: {"expectedPublishedVersionId":VALOR_DEL_GET_O_NULL,"expectedPublicationRevision":"REVISION_DEL_GET"}. La revisión es una cadena, no un número convertido. |
| Confirmar resultado | GET estado y GET /api/eventos/angel-eli-boda | El recibo debe corresponder al UUID y revisión esperados; publishedVersionId debe seleccionar esa versión, currentWorkingVersionId debe ser null. Verificar la invitación pública. |

El cliente existente scripts/event-editorial-api-client.js sirve para leer
estado y crear evento/versión por API. Para workflow/publicación usar el panel y
js/core/admin-editorial-client.js de la base integrada. El panel exige la frase
PUBLICAR angel-eli-boda y vuelve a verificar el estado antes de mutar.
No saltarse las precondiciones nuevas del main ni recurrir al publisher legacy.

Ante 409, 428, timeout o respuesta ambigua, releer y conciliar estado antes de
reintentar; no reenviar publicaciones a ciegas. Si se necesitara rollback,
requeriría autorización separada y la API del main integrado con sus tres
precondiciones explícitas; no usar el contrato antiguo de esta rama.

La URL pública prevista según el router es:

    <DOMINIO_CONFIRMADO>/invitacion.html?id=angel-eli-boda

No existe confirmación remota actual de evento, UUID, aprobación, publicación,
permisos de Drive ni dominio entregable.

## 9. Evidencia local y reproducción

Binario usado:

    C:\Users\poble\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe

Prueba ejecutada desde este checkout:

    & 'C:\Users\poble\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe' --test
    git diff --check

Log de la suite repetida para este cierre:
%TEMP%\angel-eli-final-adjustments-node22.log.
Inventario de recursos, tamaños, SHA-256 y respuestas HTTP de la auditoría base
(los recursos multimedia no cambiaron; los hashes anteriores de JS/CSS no
representan los ajustes actuales):
%TEMP%\angel-eli-release-audit.json.
Evidencias Chrome conservadas de la versión aprobada:
%TEMP%\angel-eli-cover-aligned-qa.log,
%TEMP%\angel-eli-floating-brand-qa.log y
%TEMP%\angel-eli-walking-order-qa.log.
Capturas locales ignoradas, excluidas del commit:
.dev/premium/review/angel-eli-cover-aligned-desktop.png,
.dev/premium/review/angel-eli-cover-aligned-mobile.png y
.dev/premium/review/angel-eli-cover-aligned-mobile-320.png.

Vista previa local disponible:

    http://127.0.0.1:4175/invitacion.html?devDraft=angel-eli-boda

En este cierre solo se actualizó el informe; los otros tres archivos conservan
los ajustes visuales ya aprobados. Los logs están fuera del repo. No se envían
mensajes de WhatsApp ni se verifican permisos de Drive con otra cuenta.
