const editedImages = {
    capa1: [],
    capa2: [],
    capa3: []
};

const layoutState = {
    capa1: { objectPosition: "50% 25%", scale: 1, align: "flex-end", offsetY: 78, contentScale: "medium" },
    capa2: { objectPosition: "50% 35%", scale: 1, align: "center", offsetY: 50, contentScale: "medium" },
    capa3: { objectPosition: "50% 35%", scale: 1, align: "center", offsetY: 50, contentScale: "medium" },
    audioButton: { verticalEdge: "top", horizontalEdge: "left", verticalOffset: 22, horizontalOffset: 22 }
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/svg+xml"];
const ALLOWED_AUDIO_TYPES = ["audio/mpeg"];
const FONT_FAMILIES = {
    playfair: '"Playfair Display", serif',
    montserrat: '"Montserrat", sans-serif',
    "great-vibes": '"Great Vibes", cursive',
    cinzel: '"Cinzel", serif',
    "dancing-script": '"Dancing Script", cursive',
    "alex-brush": '"Alex Brush", cursive',
    "cormorant-garamond": '"Cormorant Garamond", serif',
    poppins: '"Poppins", sans-serif',
    pacifico: '"Pacifico", cursive',
    "bebas-neue": '"Bebas Neue", sans-serif',
    "monsieur-la-doulaise": '"Monsieur La Doulaise", cursive',
    "pinyon-script": '"Pinyon Script", cursive',
    "bodoni-moda": '"Bodoni Moda", serif',
    prata: '"Prata", serif'
};

const editorState = {
    cropper: null,
    target: null,
    index: 0,
    source: ""
};

let administrativePassword = "";
let adminEventCreate;
let createPending = false;
let createAttempt = null;
let createRecovery = "";
let createFoundId = "";
let createRevision = 0;
let adminEditorialClient;
let adminEditorialWorkflowRunner;
let adminWorkingVersionRunner;
let adminDraftSaveRunner;
let adminEditorialViewGuard;
let currentEditorialState = null;
let currentEditorialVersion = null;
let currentEditorialEditorModel = null;
let currentEditorialDraftValues = null;
let blockedEditorialActionKey = "";
let adminDashboard;
let dashboardEvents = [];
let dashboardNextCursor = null;
let dashboardLoading = false;
let dashboardGeneration = 0;
let dashboardPreviewPending = false;
const dashboardSnapshots = new Map();
let adminEventDetail;
let detailRevision = 0;
let detailDescription = null;
let detailContentMessage = "";
const detailSnapshots = new Map();
let dashboardReturnPosition = null;

const EDITORIAL_TEXT_INPUTS = Object.freeze({
    heroTitle: "editorialHeroTitle",
    heroSubtitle: "editorialHeroSubtitle",
    address: "editorialAddress",
    city: "editorialCity",
    closingTitle: "editorialClosingTitle",
    closingMessage: "editorialClosingMessage",
    closingNames: "editorialClosingNames"
});

document.addEventListener("DOMContentLoaded", () => {
    bindAuthentication();
    bindEditorialReader();
    bindDashboard();
    bindEventCreation();
});

function showLivePreview() {
    const panel = document.getElementById("livePreviewPanel");
    if (panel) panel.hidden = false;
}

function bindPreviewNavigation() {
    document.querySelectorAll("[data-preview-page]").forEach((button) => {
        button.addEventListener("click", () => {
            const page = Number(button.dataset.previewPage);
            document.getElementById("previewTrack").style.transform = `translateX(-${page * 33.333333}%)`;
        });
    });
}

function bindLayoutControls() {
    const ids = ["layoutLayer", "layoutX", "layoutY", "layoutScale", "layoutAlign", "layoutScaleContent", "layoutOffsetY", "audioVerticalEdge", "audioHorizontalEdge", "audioVerticalOffset", "audioHorizontalOffset"];
    ids.forEach((id) => {
        document.getElementById(id)?.addEventListener("input", updateLayoutFromControls);
        document.getElementById(id)?.addEventListener("change", updateLayoutFromControls);
    });
    document.getElementById("layoutLayer")?.addEventListener("change", syncLayoutControls);
    syncLayoutControls();
}

function updateLayoutFromControls() {
    const layer = document.getElementById("layoutLayer").value;
    layoutState[layer] = {
        objectPosition: `${document.getElementById("layoutX").value}% ${document.getElementById("layoutY").value}%`,
        scale: Number(document.getElementById("layoutScale").value) / 100,
        align: document.getElementById("layoutAlign").value,
        offsetY: Number(document.getElementById("layoutOffsetY").value),
        contentScale: document.getElementById("layoutScaleContent").value
    };
    layoutState.audioButton = {
        verticalEdge: document.getElementById("audioVerticalEdge").value,
        horizontalEdge: document.getElementById("audioHorizontalEdge").value,
        verticalOffset: Number(document.getElementById("audioVerticalOffset").value),
        horizontalOffset: Number(document.getElementById("audioHorizontalOffset").value)
    };
    updateRangeLabels();
    updateLivePreview();
}

function syncLayoutControls() {
    const config = layoutState[document.getElementById("layoutLayer").value];
    const [x, y] = config.objectPosition.split(" ");
    document.getElementById("layoutX").value = parseInt(x, 10);
    document.getElementById("layoutY").value = parseInt(y, 10);
    document.getElementById("layoutScale").value = Math.round(config.scale * 100);
    document.getElementById("layoutAlign").value = config.align;
    document.getElementById("layoutOffsetY").value = config.offsetY;
    document.getElementById("layoutScaleContent").value = config.contentScale;
    const audio = layoutState.audioButton;
    document.getElementById("audioVerticalEdge").value = audio.verticalEdge;
    document.getElementById("audioHorizontalEdge").value = audio.horizontalEdge;
    document.getElementById("audioVerticalOffset").value = audio.verticalOffset;
    document.getElementById("audioHorizontalOffset").value = audio.horizontalOffset;
    updateRangeLabels();
    updateLivePreview();
}

function updateRangeLabels() {
    document.getElementById("layoutXValue").textContent = `${document.getElementById("layoutX").value}%`;
    document.getElementById("layoutYValue").textContent = `${document.getElementById("layoutY").value}%`;
    document.getElementById("layoutScaleValue").textContent = `${document.getElementById("layoutScale").value}%`;
    document.getElementById("layoutOffsetYValue").textContent = `${document.getElementById("layoutOffsetY").value}%`;
    document.getElementById("audioVerticalOffsetValue").textContent = `${document.getElementById("audioVerticalOffset").value}%`;
    document.getElementById("audioHorizontalOffsetValue").textContent = `${document.getElementById("audioHorizontalOffset").value}%`;
}

function updateLivePreview() {
    const images = [getAdminLayerSource(1), getAdminLayerSource(2), getAdminLayerSource(3)];
    const slides = document.querySelectorAll(".preview-slide");
    slides.forEach((slide, index) => {
        const config = layoutState[`capa${index + 1}`];
        slide.style.backgroundImage = images[index] ? `url("${images[index]}")` : "none";
        slide.style.setProperty("--page-position", config.objectPosition);
        slide.style.setProperty("--page-scale", config.scale);
        slide.style.setProperty("--content-offset-y", `${config.offsetY}%`);
        slide.style.setProperty("--content-scale", config.contentScale === "small" ? "0.88" : config.contentScale === "large" ? "1.08" : "1");
        const content = slide.querySelector(".preview-copy, .preview-detail");
        if (content) {
            content.style.removeProperty("top");
            content.style.removeProperty("bottom");
            content.style.removeProperty("transform");
            content.style.removeProperty("scale");
        }
    });
    const audio = layoutState.audioButton;
    document.querySelectorAll(".preview-audio").forEach((button) => {
        button.style.setProperty("--audio-top", audio.verticalEdge === "top" ? `${audio.verticalOffset}%` : "auto");
        button.style.setProperty("--audio-bottom", audio.verticalEdge === "bottom" ? `${audio.verticalOffset}%` : "auto");
        button.style.setProperty("--audio-left", audio.horizontalEdge === "left" ? `${audio.horizontalOffset}%` : "auto");
        button.style.setProperty("--audio-right", audio.horizontalEdge === "right" ? `${audio.horizontalOffset}%` : "auto");
    });
    const title = document.getElementById("nombre")?.value.trim() || "";
    const subtitle = document.getElementById("subtitulo")?.value.trim() || "";
    document.getElementById("previewTitle").textContent = title;
    document.getElementById("previewSubtitle").textContent = subtitle;
    document.getElementById("previewDate").textContent = document.getElementById("fecha")?.value || "";
    const previewLocation = [
        document.getElementById("lugar")?.value.trim(),
        document.getElementById("direccion")?.value.trim()
    ].filter(Boolean).join(" - ");
    document.getElementById("previewPlace").textContent = previewLocation || "";
}

function getAdminLayerSource(index) {
    const target = `Capa${index}`;
    return selectedImageFile(target) || selectedImageUrl(target);
}

function bindFontPreview() {
    const fontSelect = document.getElementById("fontFamily");
    const titleInput = document.getElementById("nombre");
    if (!fontSelect || !titleInput) return;

    const updatePreview = () => {
        const previewTitle = document.getElementById("fontPreviewTitle");
        const previewBox = document.getElementById("fontPreviewBox");
        if (!previewTitle || !previewBox) return;

        previewTitle.textContent = titleInput.value.trim() || "Festejo de mis 60 aÃ±os";
        previewBox.style.fontFamily = FONT_FAMILIES[fontSelect.value] || FONT_FAMILIES.playfair;
    };

    fontSelect.addEventListener("change", updatePreview);
    titleInput.addEventListener("input", updatePreview);
    titleInput.addEventListener("input", updateLivePreview);
    document.getElementById("subtitulo")?.addEventListener("input", updateLivePreview);
    document.getElementById("lugar")?.addEventListener("input", updateLivePreview);
    document.getElementById("direccion")?.addEventListener("input", updateLivePreview);
    document.getElementById("fecha")?.addEventListener("input", updateLivePreview);
    updatePreview();
}

function bindMediaSourceMode(target) {
    const mode = document.getElementById(`sourceMode${target}`);
    const fileInput = document.getElementById(`file${target}`);
    const urlInput = document.getElementById(`url${target}`);
    if (!mode || !fileInput || !urlInput) return;

    const updateVisibility = () => {
        const useUrl = mode.value === "url";
        fileInput.hidden = useUrl;
        urlInput.hidden = !useUrl;
        updateLivePreview();
    };

    mode.addEventListener("change", updateVisibility);
    urlInput.addEventListener("input", updateLivePreview);
    updateVisibility();
}

function bindAuthentication() {
    const authForm = document.getElementById("authForm");
    const logoutButton = document.getElementById("btnLogout");

    authForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const passwordInput = document.getElementById("loginPassword");
        const error = document.getElementById("authError");
        if (!passwordInput.value) {
            error.textContent = "Ingresa la credencial administrativa.";
            return;
        }
        administrativePassword = passwordInput.value;
        passwordInput.value = "";
        error.textContent = "";
        showAdmin();
    });

    logoutButton.addEventListener("click", () => resetForAuthentication(""));
}

function showAdmin() {
    document.getElementById("authPanel").hidden = true;
    document.getElementById("adminForm").hidden = false;
    document.getElementById("btnLogout").hidden = false;
    navigateAdmin("dashboard");
    document.getElementById("loadEditorialEvents").focus();
}

function navigateAdmin(view) {
    const detail = view === "detail";
    document.getElementById("adminDashboard").hidden = view !== "dashboard";
    document.getElementById("editorialDetail").hidden = !detail;
    document.getElementById("adminEventCreate").hidden = view !== "create";
}

function resetEventCreation() {
    createRevision += 1;
    createPending = false;
    createAttempt = null;
    createRecovery = "";
    createFoundId = "";
    adminEventCreate?.reset();
}

function bindEventCreation() {
    adminEventCreate = AdminEventCreate.createView({ document, onSubmit: submitNewEvent,
        onCancel: () => { resetEventCreation(); navigateAdmin("dashboard"); restoreDashboardPosition(); },
        onCheck: checkNewEvent, onOpen: openFoundEvent });
    document.getElementById("newEventButton").addEventListener("click", () => {
        rememberDashboardPosition(); resetEventCreation(); navigateAdmin("create"); adminEventCreate.focus();
    });
}

function creationOperation() {
    const generation = dashboardGeneration;
    const revision = createRevision;
    const password = administrativePassword;
    return { password, isCurrent: () => Boolean(administrativePassword)
        && generation === dashboardGeneration && revision === createRevision };
}

function creationAccessError(error) {
    if (error.status === 401 || error.status === 403) {
        resetForAuthentication(error.status === 401 ? "Credencial administrativa inválida." : "Acceso administrativo rechazado.");
        return true;
    }
    return false;
}

async function submitNewEvent(values) {
    if (createPending || ["uncertain", "created", "found"].includes(createRecovery) || !administrativePassword) return;
    adminEventCreate.clearErrors();
    const built = AdminEventCreateBuilder.build(values);
    if (!built.valid) { adminEventCreate.showErrors(built.errors); return; }
    createAttempt = { eventId: built.content.id, content: built.content };
    createFoundId = "";
    const attempt = createAttempt;
    const operation = creationOperation();
    createPending = true;
    adminEventCreate.update({ pending: true, message: "Creando borrador…" });
    try {
        await adminEditorialClient.createEvent({ ...attempt, password: operation.password });
        if (!operation.isCurrent()) return;
        createRecovery = "created";
        try {
            await loadCreatedEvent(attempt.eventId, operation);
        } catch (error) {
            if (!operation.isCurrent() || creationAccessError(error)) return;
            adminEventCreate.update({ blocked: true, check: true, message: "Evento creado; no se pudo cargar el detalle." });
        }
    } catch (error) {
        if (!operation.isCurrent() || creationAccessError(error)) return;
        if (error.code === "EVENT_ALREADY_EXISTS" || error.status === 409) {
            createRecovery = "collision";
            adminEventCreate.update({ check: true, message: "El ID está ocupado. Puedes editarlo o consultar el evento existente." });
        } else if (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(error.code)
            || (error.status >= 500 && error.status !== 503)) {
            createRecovery = "uncertain";
            adminEventCreate.update({ blocked: true, check: true,
                message: "Resultado incierto. Comprueba el ID antes de volver a enviar." });
        } else {
            createRecovery = "";
            const message = error.status === 422 ? "El backend rechazó el contenido. Revisa los datos."
                : error.status === 429 ? "Límite de solicitudes alcanzado. Espera antes de reintentar."
                : error.status === 503 ? "Servicio administrativo no disponible. Intenta más tarde."
                : "No se pudo crear el borrador. Revisa los datos.";
            adminEventCreate.update({ message });
        }
    } finally { if (operation.isCurrent()) createPending = false; }
}

async function checkNewEvent() {
    if (createPending || !createAttempt || !administrativePassword) return;
    const id = createAttempt.eventId;
    const previous = createRecovery;
    const operation = creationOperation();
    createPending = true;
    adminEventCreate.update({ pending: true, blocked: true, check: true, message: "Comprobando el ID…" });
    try {
        if (previous === "created") {
            await loadCreatedEvent(id, operation);
            return;
        }
        await adminEditorialClient.getEditorialState({ eventId: id, password: operation.password });
        if (!operation.isCurrent()) return;
        createFoundId = id;
        createRecovery = "found";
        adminEventCreate.update({ blocked: true, open: true, message: "Se encontró un evento con este ID." });
    } catch (error) {
        if (!operation.isCurrent() || creationAccessError(error)) return;
        if (error.status === 404 && previous !== "created") {
            createRecovery = "retry";
            adminEventCreate.update({ check: true, message: "No se encontró el evento en esta consulta. Puedes reintentar conscientemente con el mismo ID." });
        } else {
            adminEventCreate.update({ blocked: true, check: true, message: previous === "created"
                ? "Evento creado; no se pudo cargar el detalle." : "No se pudo comprobar el resultado. Vuelve a consultar el ID." });
        }
    } finally { if (operation.isCurrent()) createPending = false; }
}

async function openFoundEvent() {
    if (createPending || !createFoundId) return;
    await manageDashboardEvent(createFoundId, { preserveReturn: true });
}

async function loadCreatedEvent(eventId, operation) {
    const state = await adminEditorialClient.getEditorialState({ eventId, password: operation.password });
    if (!operation.isCurrent()) return;
    const working = state.versions.find(version => version.versionId === state.currentWorkingVersionId);
    if (!working || !state.currentWorkingVersionId) throw new Error("Missing working version.");
    const snapshot = await adminEditorialClient.getVersion({ eventId, versionId: state.currentWorkingVersionId, password: operation.password });
    if (!operation.isCurrent()) return;
    const event = { ...state, workingVersion: working,
        publishedVersion: state.versions.find(version => version.versionId === state.publishedVersionId) || null,
        summary: AdminEventSummary.project({ working: snapshot.content }) };
    const filters = { text: document.getElementById("dashboardSearch").value,
        status: document.getElementById("dashboardStatusFilter").value,
        workflow: document.getElementById("dashboardWorkflowFilter").value };
    if (AdminDashboard.filterEvents([event], filters).length) {
        dashboardEvents = AdminDashboard.mergeEvents(dashboardEvents, [event]);
        adminDashboard.update({ events: dashboardEvents });
    }
    const loaded = await manageDashboardEvent(eventId, { preserveReturn: true });
    if (operation.isCurrent() && !loaded) {
        navigateAdmin("create");
        throw new Error("Detail could not be loaded.");
    }
}

function bindDashboard() {
    adminEventDetail = AdminEventDetail.createDetail({ document, onAction: executeEditorialAction });
    adminDashboard = AdminDashboard.createDashboard({
        document,
        onManage: manageDashboardEvent,
        onPreview: previewDashboardEvent,
        onLoadMore: () => loadEditorialEvents({ more: true })
    });
    adminDashboard.reset();
    document.getElementById("dashboardOpenDetail").addEventListener("click", () => {
        rememberDashboardPosition();
        navigateAdmin("detail");
        document.getElementById("eventDetailTechnical").open = true;
        document.getElementById("editorialEventId").focus();
    });
    document.getElementById("dashboardBack").addEventListener("click", returnToDashboard);
}

async function manageDashboardEvent(eventId, { preserveReturn = false } = {}) {
    if (!preserveReturn) rememberDashboardPosition();
    document.getElementById("eventDetailTechnical").open = false;
    document.getElementById("editorialEventId").value = eventId;
    document.getElementById("editorialEventSelect").value = eventId;
    navigateAdmin("detail");
    document.getElementById("dashboardBack").focus({ preventScroll: true });
    return await loadEditorialState();
}

async function returnToDashboard() {
    navigateAdmin("dashboard");
    restoreDashboardPosition();
    const state = currentEditorialState;
    if (!state || !dashboardEvents.some((event) => event.eventId === state.eventId)) return;
    const generation = dashboardGeneration;
    const password = administrativePassword;
    const metadata = (id) => state.versions.find((version) => version.versionId === id) || null;
    const event = { ...state, workingVersion: metadata(state.currentWorkingVersionId), publishedVersion: metadata(state.publishedVersionId) };
    try {
        event.summary = await loadDashboardSummary(event, password);
        if (generation !== dashboardGeneration || !administrativePassword) return;
        dashboardEvents = AdminDashboard.mergeEvents(dashboardEvents, [event]);
        adminDashboard.update({ events: dashboardEvents });
        restoreDashboardPosition();
    } catch (error) {
        if (generation === dashboardGeneration) handleDashboardError(error);
    }
}

function rememberDashboardPosition() {
    const focused = document.activeElement;
    dashboardReturnPosition = { x: window.scrollX || 0, y: window.scrollY || 0,
        id: focused?.id, eventId: focused?.dataset?.eventId };
}

function restoreDashboardPosition() {
    if (!dashboardReturnPosition) return;
    const { x, y, id, eventId } = dashboardReturnPosition;
    const focus = id ? document.getElementById(id) : Array.from(document.querySelectorAll("[data-event-id]")).find((node) => node.dataset.eventId === eventId);
    (focus || document.getElementById("loadEditorialEvents"))?.focus({ preventScroll: true });
    window.scrollTo?.(x, y);
}

function handleDashboardError(error) {
    if (["UNAUTHORIZED", "FORBIDDEN"].includes(error.code)) {
        resetForAuthentication(error.message);
        return;
    }
    adminDashboard?.update({ message: error.message || "No se pudieron cargar los eventos. Intenta nuevamente." });
}

async function loadDashboardSummary(event, password) {
    const generation = dashboardGeneration;
    const snapshots = {};
    for (const [source, versionId] of [["working", event.currentWorkingVersionId], ["published", event.publishedVersionId]]) {
        if (generation !== dashboardGeneration) return AdminEventSummary.project();
        if (!versionId) continue;
        const key = JSON.stringify([event.eventId, versionId]);
        if (!dashboardSnapshots.has(key)) {
            dashboardSnapshots.set(key, adminEditorialClient.getVersion({ eventId: event.eventId, versionId, password }));
        }
        try {
            snapshots[source] = (await dashboardSnapshots.get(key)).content;
        } catch (error) {
            if (["UNAUTHORIZED", "FORBIDDEN"].includes(error.code)) throw error;
            // Keep failed promises too: no duplicate reads within this loaded session.
        }
        const summary = AdminEventSummary.project(snapshots);
        if (summary.source !== "none") return summary;
    }
    return AdminEventSummary.project(snapshots);
}

async function previewDashboardEvent(eventId) {
    if (dashboardPreviewPending) return;
    const event = dashboardEvents.find((entry) => entry.eventId === eventId);
    if (!event || !AdminDashboard.canPreview(event)) {
        adminDashboard.update({ message: "Vista previa no disponible para este evento." });
        return;
    }
    const generation = dashboardGeneration;
    dashboardPreviewPending = true;
    try {
        await requestPrivatePreview({
            eventId,
            versionId: event.currentWorkingVersionId || event.publishedVersionId,
            status: document.getElementById("dashboardStatus"),
            isCurrent: () => generation === dashboardGeneration && Boolean(administrativePassword)
        });
    } finally {
        if (generation === dashboardGeneration) dashboardPreviewPending = false;
    }
}

function bindEditorialReader() {
    const readerForm = document.getElementById("editorialReaderForm");
    adminEditorialClient = AdminEditorialClient.createAdminEditorialClient();
    adminEditorialWorkflowRunner = AdminEditorialWorkflow.createActionRunner({
        client: adminEditorialClient,
        confirmPublication: requestPublicationConfirmation
    });
    adminWorkingVersionRunner = AdminEditorialClient.createWorkingVersionRunner({
        client: adminEditorialClient,
        confirmCreation: requestWorkingVersionConfirmation
    });
    adminDraftSaveRunner = AdminEventEditor.createDraftSaveRunner({
        client: adminEditorialClient,
        confirmSave: requestDraftSaveConfirmation
    });
    adminEditorialViewGuard = AdminEditorialWorkflow.createViewGuard();
    document.getElementById("loadEditorialEvents")?.addEventListener("click", loadEditorialEvents);
    document.getElementById("editorialReloadStateButton")?.addEventListener("click", loadEditorialState);
    document.getElementById("editorialEventSelect")?.addEventListener("change", (event) => {
        document.getElementById("editorialEventId").value = event.target.value;
        if (event.target.value) {
            loadEditorialState();
        } else {
            adminEditorialViewGuard.begin("");
            clearEditorialState();
        }
    });
    document.getElementById("editorialEventId")?.addEventListener("input", handleEditorialEventInput);
    document.getElementById("editorialCreateVersionButton")?.addEventListener("click", createWorkingVersion);
    document.getElementById("editorialPreviewButton")?.addEventListener("click", requestPrivatePreview);
    document.getElementById("editorialTextEditor")?.addEventListener("submit", saveEditorialTexts);
    Object.entries(EDITORIAL_TEXT_INPUTS).forEach(([name, inputId]) => {
        document.getElementById(inputId)?.addEventListener("input", (event) => {
            if (currentEditorialEditorModel?.fields[name]?.blocked === false && currentEditorialDraftValues) {
                currentEditorialDraftValues[name] = event.target.value;
            }
        });
    });
    readerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await loadEditorialState();
    });
}

function handleEditorialEventInput(event) {
    const eventId = event.target.value.trim();
    adminEditorialViewGuard.begin(eventId);
    if (!currentEditorialState || eventId !== currentEditorialState.eventId) {
        clearEditorialState();
    }
}

async function loadEditorialEvents({ more = false } = {}) {
    if (!administrativePassword) return resetForAuthentication("Credencial administrativa invalida.");
    if (dashboardLoading || (more && !dashboardNextCursor)) return;
    const generation = dashboardGeneration;
    const password = administrativePassword;
    dashboardLoading = true;
    adminDashboard.update({ loading: true, message: "Cargando eventos…" });
    try {
        const result = await adminEditorialClient.listEvents({ password, cursor: more ? dashboardNextCursor : undefined });
        if (generation !== dashboardGeneration) return;
        // Bound concurrent snapshot reads; descriptive failures stay local to each row.
        const events = AdminDashboard.mergeEvents([], result.events);
        let index = 0;
        await Promise.all(Array.from({ length: Math.min(4, events.length) }, async () => {
            while (index < events.length && generation === dashboardGeneration) {
                const event = events[index++];
                event.summary = await loadDashboardSummary(event, password);
            }
        }));
        if (generation !== dashboardGeneration) return;
        dashboardEvents = more ? AdminDashboard.mergeEvents(dashboardEvents, events) : events;
        dashboardNextCursor = result.nextCursor;
        const select = document.getElementById("editorialEventSelect");
        const selected = select.value;
        select.replaceChildren(new Option("Selecciona un evento", ""));
        dashboardEvents.forEach((event) => select.append(new Option(`${event.eventId} (${event.eventStatus})`, event.eventId)));
        select.value = selected;
        adminDashboard.update({ events: dashboardEvents, nextCursor: dashboardNextCursor,
            message: dashboardNextCursor ? "Eventos cargados. Hay más eventos disponibles." : "Carga completa. Resumen sobre los eventos cargados." });
    } catch (error) {
        if (generation === dashboardGeneration) handleDashboardError(error);
    } finally {
        if (generation === dashboardGeneration) {
            dashboardLoading = false;
            adminDashboard.update({ loading: false });
        }
    }
}

async function loadEditorialState() {
    const eventId = document.getElementById("editorialEventId").value.trim();
    const status = document.getElementById("editorialReaderStatus");
    if (!administrativePassword) {
        resetForAuthentication("Credencial administrativa invalida.");
        return;
    }

    const operation = adminEditorialViewGuard.begin(eventId);
    const recoveringDraftSave = adminDraftSaveRunner.requiresRefresh(eventId);
    const recoveringWorkingVersion = adminWorkingVersionRunner.requiresRefresh(eventId);
    const recovering = recoveringDraftSave || recoveringWorkingVersion;
    clearEditorialState({ preserveRecovery: recovering });
    status.textContent = "Verificando credencial y cargando evento...";
    try {
        const recoveryRunner = recoveringDraftSave ? adminDraftSaveRunner : adminWorkingVersionRunner;
        const state = recovering
            ? await recoveryRunner.refresh({
                eventId,
                password: administrativePassword,
                isCurrent: () => adminEditorialViewGuard.isCurrent(operation)
                    && document.getElementById("editorialEventId").value.trim() === eventId
            })
            : await adminEditorialClient.getEditorialState({ eventId, password: administrativePassword });
        if (!adminEditorialViewGuard.acceptState(operation, state)) return;
        currentEditorialState = state;
        blockedEditorialActionKey = "";
        renderEditorialState(state);
        const editorLoaded = await loadEditorialTextEditor(state, operation);
        if (!adminEditorialViewGuard.isCurrent(operation)) return;
        if (editorLoaded !== null) {
            status.textContent = editorLoaded
                ? "Acceso administrativo confirmado. Draft V2 listo para editar."
                : "Acceso administrativo confirmado.";
        }
        return editorLoaded !== null;
    } catch (error) {
        if (!adminEditorialViewGuard.isCurrent(operation)) return;
        if (error.code === "UNAUTHORIZED") {
            resetForAuthentication("Credencial administrativa invalida.");
            return;
        }
        if (error.code === "FORBIDDEN") {
            resetForAuthentication("Acceso administrativo rechazado.");
            return;
        }
        status.classList.add("error");
        status.textContent = error.code === "SERVER_ERROR"
            ? "Error del servidor administrativo."
            : error.message;
        if (adminWorkingVersionRunner.requiresRefresh(eventId) || adminDraftSaveRunner.requiresRefresh(eventId)) {
            document.getElementById("editorialReloadStateButton").hidden = false;
        }
        return false;
    }
}

function resetForAuthentication(message) {
    resetEventCreation();
    administrativePassword = "";
    dashboardGeneration += 1;
    dashboardLoading = false;
    dashboardPreviewPending = false;
    dashboardEvents = [];
    dashboardNextCursor = null;
    dashboardSnapshots.clear();
    dashboardReturnPosition = null;
    adminDashboard?.reset();
    document.getElementById("editorialEventSelect")?.replaceChildren(new Option("Selecciona un evento", ""));
    adminEditorialViewGuard?.reset();
    document.getElementById("adminForm").hidden = true;
    document.getElementById("btnLogout").hidden = true;
    document.getElementById("authPanel").hidden = false;
    document.getElementById("authError").textContent = message;
    document.getElementById("loginPassword").value = "";
    clearEditorialState();
}

function clearEditorialState({ preserveRecovery = false } = {}) {
    const state = document.getElementById("editorialState");
    detailRevision += 1;
    detailDescription = null;
    detailSnapshots.clear();
    adminEventDetail?.clear();
    const descriptionStatus = document.getElementById("eventDetailDescriptionStatus");
    if (descriptionStatus) descriptionStatus.textContent = "";
    state.hidden = true;
    const status = document.getElementById("editorialReaderStatus");
    status.classList.remove("error");
    status.textContent = "";
    document.getElementById("editorialReloadStateButton").hidden = !preserveRecovery;
    document.getElementById("editorialCreateVersionButton")?.setAttribute("hidden", "");
    document.getElementById("editorialPreviewButton")?.setAttribute("hidden", "");
    clearEditorialTextEditor();
    currentEditorialState = null;
}

function detailStateKey(state) {
    return JSON.stringify([state.eventId, state.currentWorkingVersionId, state.publishedVersionId]);
}

function renderDetailPresentation(state) {
    if (!adminEventDetail) return;
    const action = AdminEditorialWorkflow.getAvailableAction(state);
    const blocked = adminEditorialViewGuard.requiresRefresh()
        || adminEditorialWorkflowRunner.isPending()
        || adminWorkingVersionRunner.isPending()
        || adminDraftSaveRunner.isPending();
    const description = detailDescription?.key === detailStateKey(state) ? detailDescription : null;
    adminEventDetail.render(AdminEventDetail.buildViewModel({
        state,
        summary: description?.summary || AdminEventSummary.project(),
        action,
        actionDisabled: blocked || editorialActionKey(action) === blockedEditorialActionKey,
        contentMessage: detailContentMessage || (!state.currentWorkingVersionId
            ? description?.schemaVersion === 1
                ? "Contenido V1 no compatible con el editor textual V2. No hay versión de trabajo."
                : "No hay versión de trabajo para editar."
            : "Verificando disponibilidad del editor…")
    }));
}

async function loadDetailDescription(state, revision) {
    const key = detailStateKey(state);
    const snapshots = {};
    let schemaVersion;
    let failed = false;
    for (const [role, versionId] of [["working", state.currentWorkingVersionId], ["published", state.publishedVersionId]]) {
        if (!versionId) continue;
        if (revision !== detailRevision || currentEditorialState !== state) return;
        const snapshotKey = JSON.stringify([state.eventId, versionId]);
        if (!detailSnapshots.has(snapshotKey)) {
            detailSnapshots.set(snapshotKey, adminEditorialClient.getVersion({
                eventId: state.eventId, versionId, password: administrativePassword
            }));
        }
        try {
            const version = await detailSnapshots.get(snapshotKey);
            if (revision !== detailRevision || currentEditorialState !== state) return;
            snapshots[role] = version.content;
            const projection = AdminEventSummary.project(snapshots);
            if (projection.source !== "none") { schemaVersion = version.content.schema_version; break; }
        } catch (_) { failed = true; }
    }
    if (revision !== detailRevision || currentEditorialState !== state) return;
    detailDescription = { key, summary: AdminEventSummary.project(snapshots), schemaVersion };
    if (failed && detailDescription.summary.source === "none") {
        document.getElementById("eventDetailDescriptionStatus").textContent = "No se pudo cargar la descripción. El estado y las versiones siguen disponibles.";
    }
    renderDetailPresentation(state);
}

function renderEditorialState(editorialState) {
    document.getElementById("editorialState").hidden = false;
    renderDetailPresentation(editorialState);
    const revision = ++detailRevision;
    if (adminEventDetail) {
        document.getElementById("eventDetailDescriptionStatus").textContent = "";
        loadDetailDescription(editorialState, revision);
    }
    const sourceVersionId = AdminEditorialClient.workingVersionSource(editorialState);
    const createButton = document.getElementById("editorialCreateVersionButton");
    if (createButton) {
        createButton.hidden = !sourceVersionId;
        createButton.disabled = !sourceVersionId
            || adminEditorialViewGuard.requiresRefresh()
            || adminWorkingVersionRunner.isPending()
            || adminEditorialWorkflowRunner.isPending()
            || adminDraftSaveRunner.isPending();
    }
    document.getElementById("editorialReloadStateButton").hidden = !adminEditorialViewGuard.requiresRefresh();
    const previewButton = document.getElementById("editorialPreviewButton");
    if (previewButton) {
        previewButton.hidden = false;
        previewButton.disabled = editorialState.eventStatus !== "active"
            || !(editorialState.currentWorkingVersionId || editorialState.publishedVersionId);
        previewButton.title = previewButton.disabled ? "Vista previa no disponible: evento archivado o sin versión" : "Vista previa temporal";
    }
}

function clearEditorialTextEditor() {
    detailContentMessage = "";
    const form = document.getElementById("editorialTextEditor");
    if (form) {
        form.hidden = true;
        form.reset();
    }
    Object.values(EDITORIAL_TEXT_INPUTS).forEach((inputId) => {
        const input = document.getElementById(inputId);
        if (input) input.disabled = false;
    });
    document.querySelectorAll(".editorial-field-status").forEach((status) => { status.textContent = ""; });
    const editorStatus = document.getElementById("editorialEditorStatus");
    if (editorStatus) {
        editorStatus.classList.remove("error");
        editorStatus.textContent = "";
    }
    currentEditorialVersion = null;
    currentEditorialEditorModel = null;
    currentEditorialDraftValues = null;
}

async function loadEditorialTextEditor(editorialState, operation) {
    clearEditorialTextEditor();
    const versionId = editorialState?.currentWorkingVersionId;
    if (!versionId) {
        if (adminEventDetail) renderDetailPresentation(editorialState);
        return false;
    }
    try {
        const version = await adminEditorialClient.getVersion({
            eventId: editorialState.eventId,
            versionId,
            password: administrativePassword
        });
        if (!adminEditorialViewGuard.isCurrent(operation)
            || document.getElementById("editorialEventId").value.trim() !== editorialState.eventId
            || currentEditorialState?.currentWorkingVersionId !== versionId) return false;
        const model = AdminEventEditor.createEditorModel({ editorialState, version });
        if (!model.eligible) {
            detailContentMessage = version.content?.schema_version === 1
                ? "Contenido V1 no compatible con el editor textual V2."
                : version.workflowStatus !== "draft"
                    ? "El contenido sólo puede editarse en una versión de trabajo en borrador."
                    : model.reason;
            if (adminEventDetail) renderDetailPresentation(editorialState);
            return false;
        }
        currentEditorialVersion = version;
        currentEditorialEditorModel = model;
        currentEditorialDraftValues = editorValuesFromModel(model);
        renderEditorialTextEditor(model, currentEditorialDraftValues);
        detailContentMessage = "Editando los textos de la versión de trabajo en borrador.";
        if (adminEventDetail) renderDetailPresentation(editorialState);
        return true;
    } catch (error) {
        if (!adminEditorialViewGuard.isCurrent(operation)) return false;
        detailContentMessage = "Snapshot no disponible: no se pudo verificar el contenido para editar.";
        if (adminEventDetail) renderDetailPresentation(editorialState);
        const status = document.getElementById("editorialReaderStatus");
        status.classList.add("error");
        status.textContent = `El estado editorial se cargó, pero no se pudo verificar el draft: ${editorialErrorMessage(error)}`;
        return null;
    }
}

function editorValuesFromModel(model) {
    return Object.fromEntries(Object.entries(EDITORIAL_TEXT_INPUTS)
        .filter(([name]) => model.fields[name] && !model.fields[name].blocked)
        .map(([name]) => [name, model.fields[name].value]));
}

function renderEditorialTextEditor(model, values = currentEditorialDraftValues || editorValuesFromModel(model)) {
    let editableFields = 0;
    Object.entries(EDITORIAL_TEXT_INPUTS).forEach(([name, inputId]) => {
        const input = document.getElementById(inputId);
        const status = document.getElementById(`${inputId}Status`);
        const field = model.fields[name];
        input.value = field && !field.blocked ? values[name] ?? field.value : "";
        input.disabled = !field || field.blocked;
        if (status) status.textContent = field?.blocked ? field.reason : "";
        if (field && !field.blocked) editableFields += 1;
    });
    const button = document.getElementById("editorialSaveTextButton");
    button.disabled = editableFields === 0 || adminDraftSaveRunner.isPending();
    document.getElementById("editorialTextEditor").hidden = false;
}

function editorialActionKey(action) {
    return action ? `${action.eventId}|${action.versionId}|${action.kind}` : "";
}

function requestPublicationConfirmation(action) {
    const phrase = AdminEditorialWorkflow.publicationPhrase(action.eventId);
    return window.prompt(
        [
            "Esta accion cambiara la invitacion publica.",
            "",
            `Evento: ${action.eventId}`,
            `Version UUID: ${action.versionId}`,
            `Numero de version: ${action.versionNumber}`,
            "",
            `Escribi exactamente: ${phrase}`
        ].join("\n"),
        ""
    );
}

function requestWorkingVersionConfirmation(details) {
    const sourceLabel = details.sourceVersionNumber
        ? `Version ${details.sourceVersionNumber} (${details.sourceVersionId})`
        : details.sourceVersionId;
    const lines = [
        "Se creará una nueva versión de trabajo en estado draft.",
        "",
        `Evento: ${details.eventId}`,
        `Fuente: ${sourceLabel}`
    ];
    if (details.replacesWorkingVersion) {
        lines.push(
            "",
            "Ya existe una versión de trabajo.",
            `El puntero cambiará desde ${details.expectedWorkingVersionId} a la nueva versión.`,
            "La versión anterior ya no podrá continuar su workflow ni publicarse.",
            "",
            "Confirma explícitamente que deseas continuar."
        );
    } else {
        lines.push("", "Confirma que deseas crear la versión de trabajo desde esta fuente.");
    }
    return window.confirm(lines.join("\n"));
}

function requestDraftSaveConfirmation(details) {
    return window.confirm([
        "Cada guardado crea una nueva versión draft.",
        "El puntero de trabajo se moverá a la nueva versión y la anterior dejará de poder avanzar o publicarse.",
        "",
        `Evento: ${details.eventId}`,
        `Draft actual: versión ${details.sourceVersionNumber} (${details.sourceVersionId})`,
        "",
        "Confirma que deseas guardar estos textos como otra versión."
    ].join("\n"));
}

function readEditorialTextValues(model) {
    const values = Object.fromEntries(Object.entries(EDITORIAL_TEXT_INPUTS)
        .filter(([name]) => model.fields[name] && !model.fields[name].blocked)
        .map(([name, inputId]) => [name, document.getElementById(inputId).value]));
    currentEditorialDraftValues = { ...values };
    return values;
}

async function saveEditorialTexts(event) {
    event.preventDefault();
    const observedState = currentEditorialState;
    const sourceVersion = currentEditorialVersion;
    const model = currentEditorialEditorModel;
    const selectedEventId = document.getElementById("editorialEventId").value.trim();
    const editorStatus = document.getElementById("editorialEditorStatus");
    if (!observedState || !sourceVersion || !model
        || selectedEventId !== observedState.eventId
        || sourceVersion.versionId !== observedState.currentWorkingVersionId
        || adminEditorialViewGuard.requiresRefresh()
        || adminWorkingVersionRunner.isPending()
        || adminEditorialWorkflowRunner.isPending()
        || adminDraftSaveRunner.isPending()) return;

    let projection;
    try {
        projection = AdminEventEditor.applyEdits(model, readEditorialTextValues(model));
    } catch (error) {
        editorStatus.classList.add("error");
        editorStatus.textContent = error.message;
        return;
    }

    const operation = adminEditorialViewGuard.begin(observedState.eventId);
    const saveButton = document.getElementById("editorialSaveTextButton");
    saveButton.disabled = true;
    document.getElementById("editorialCreateVersionButton").disabled = true;
    document.querySelectorAll(".editorial-workflow-action").forEach((button) => { button.disabled = true; });
    editorStatus.classList.remove("error");
    editorStatus.textContent = "Verificando el draft vigente...";

    try {
        const result = await adminDraftSaveRunner.run({
            observedState,
            sourceVersion,
            content: projection.content,
            password: administrativePassword,
            isCurrent: () => adminEditorialViewGuard.isCurrent(operation)
                && document.getElementById("editorialEventId").value.trim() === observedState.eventId
        });
        if (result.outcome === "stale-view" || result.outcome === "busy") return;

        if (result.state) {
            if (!adminEditorialViewGuard.acceptState(operation, result.state)) return;
            currentEditorialState = result.state;
        } else if (!adminEditorialViewGuard.isCurrent(operation)) {
            return;
        }

        if (result.outcome === "success") {
            clearEditorialTextEditor();
            renderEditorialState(result.state);
            const loaded = await loadEditorialTextEditor(result.state, operation);
            if (!adminEditorialViewGuard.isCurrent(operation)) return;
            const status = document.getElementById("editorialReaderStatus");
            status.classList.remove("error");
            status.textContent = loaded
                ? `Versión ${result.created.versionNumber} guardada. La vista previa privada usa esta versión persistida.`
                : `Versión ${result.created.versionNumber} guardada. El estado se actualizó y la vista previa privada usa la versión persistida, pero el editor no pudo recargar su snapshot.`;
            return;
        }
        if (result.outcome === "cancelled") {
            renderEditorialState(result.state);
            renderEditorialTextEditor(model, currentEditorialDraftValues);
            editorStatus.textContent = "Guardado cancelado. No se realizaron cambios.";
            return;
        }
        if (result.outcome === "stale" || result.outcome === "conflict") {
            clearEditorialTextEditor();
            renderEditorialState(result.state);
            await loadEditorialTextEditor(result.state, operation);
            const status = document.getElementById("editorialReaderStatus");
            status.classList.add("error");
            status.textContent = "El draft cambió en el servidor. Se recargó el evento; revisá los textos e iniciá nuevamente el guardado.";
            return;
        }
        if (result.outcome === "accepted-refresh-failed") {
            adminEditorialViewGuard.requireRefresh(operation);
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            const status = document.getElementById("editorialReaderStatus");
            status.classList.add("error");
            status.textContent = "El guardado pudo haberse completado, pero no se pudo actualizar el estado. Recargá el estado editorial; no repitas el guardado.";
            return;
        }
        if (result.outcome === "mutation-unknown" || result.outcome === "refresh-required") {
            adminEditorialViewGuard.requireRefresh(operation);
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            const status = document.getElementById("editorialReaderStatus");
            status.classList.add("error");
            status.textContent = "No se pudo confirmar si la versión fue creada. Recargá el estado editorial antes de intentar nuevamente.";
            return;
        }
        if (result.outcome === "conflict-refresh-failed") {
            adminEditorialViewGuard.requireRefresh(operation);
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            const status = document.getElementById("editorialReaderStatus");
            status.classList.add("error");
            status.textContent = "El guardado encontró un conflicto y no se pudo actualizar la vista. Recargá el estado editorial; no hubo reintento automático.";
            return;
        }
        if (result.outcome === "unavailable") {
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            const status = document.getElementById("editorialReaderStatus");
            status.classList.add("error");
            status.textContent = "El draft dejó de ser editable. Recargá el estado editorial antes de continuar.";
        }
    } catch (error) {
        if (!adminEditorialViewGuard.isCurrent(operation)) return;
        if (error.code === "UNAUTHORIZED") {
            resetForAuthentication("Credencial administrativa invalida.");
            return;
        }
        if (error?.status === undefined) {
            adminEditorialViewGuard.requireRefresh(operation);
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            const status = document.getElementById("editorialReaderStatus");
            status.classList.add("error");
            status.textContent = "No se pudo confirmar el estado de la operación. Recargá el estado editorial antes de intentar nuevamente.";
            return;
        }
        editorStatus.classList.add("error");
        editorStatus.textContent = error?.status === 422
            ? "El snapshot editado es incompatible con el validador actual. No se creó una versión."
            : editorialErrorMessage(error);
        renderEditorialState(currentEditorialState);
        document.getElementById("editorialSaveTextButton").disabled = false;
    } finally {
        if (adminEditorialViewGuard.isCurrent(operation) && currentEditorialState) renderEditorialState(currentEditorialState);
    }
}

async function createWorkingVersion() {
    const observedState = currentEditorialState;
    const selectedEventId = document.getElementById("editorialEventId").value.trim();
    if (!observedState
        || selectedEventId !== observedState.eventId
        || !AdminEditorialClient.workingVersionSource(observedState)
        || adminEditorialViewGuard.requiresRefresh()
        || adminWorkingVersionRunner.isPending()
        || adminEditorialWorkflowRunner.isPending()
        || adminDraftSaveRunner.isPending()) return;

    const operation = adminEditorialViewGuard.begin(observedState.eventId);
    const status = document.getElementById("editorialReaderStatus");
    const button = document.getElementById("editorialCreateVersionButton");
    button.disabled = true;
    status.classList.remove("error");
    status.textContent = "Obteniendo el snapshot y verificando el estado vigente...";

    try {
        const result = await adminWorkingVersionRunner.run({
            observedState,
            password: administrativePassword,
            isCurrent: () => adminEditorialViewGuard.isCurrent(operation)
                && document.getElementById("editorialEventId").value.trim() === observedState.eventId
        });

        if (result.outcome === "stale-view" || result.outcome === "busy") return;
        if (result.state) {
            if (!adminEditorialViewGuard.acceptState(operation, result.state)) return;
            currentEditorialState = result.state;
            clearEditorialTextEditor();
            renderEditorialState(result.state);
            await loadEditorialTextEditor(result.state, operation);
        } else if (!adminEditorialViewGuard.isCurrent(operation)) {
            return;
        }

        if (result.outcome === "success") {
            blockedEditorialActionKey = "";
            status.textContent = `Versión ${result.created.versionNumber} creada en draft y estado actualizado.`;
            return;
        }
        if (result.outcome === "cancelled") {
            status.textContent = "Creación cancelada. No se realizaron cambios.";
            return;
        }
        if (result.outcome === "stale" || result.outcome === "conflict") {
            status.classList.add("error");
            status.textContent = "El estado cambió en el servidor. Se recargó el evento; inicia nuevamente la creación.";
            return;
        }
        if (result.outcome === "accepted-refresh-failed") {
            adminEditorialViewGuard.requireRefresh(operation);
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            status.classList.add("error");
            status.textContent = "La creación pudo haberse completado, pero no se pudo actualizar la vista. Consulta nuevamente el evento antes de realizar otra acción; no repitas la creación.";
            return;
        }
        if (result.outcome === "mutation-unknown" || result.outcome === "refresh-required") {
            adminEditorialViewGuard.requireRefresh(operation);
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            status.classList.add("error");
            status.textContent = "No se pudo confirmar si la versión fue creada. Recargá el estado editorial antes de intentar nuevamente.";
            return;
        }
        if (result.outcome === "conflict-refresh-failed") {
            adminEditorialViewGuard.requireRefresh(operation);
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            status.classList.add("error");
            status.textContent = "La creación encontró un conflicto y no se pudo actualizar la vista. Consulta nuevamente el evento; no hubo reintento automático.";
        }
    } catch (error) {
        if (!adminEditorialViewGuard.isCurrent(operation)) return;
        if (error.code === "UNAUTHORIZED") {
            resetForAuthentication("Credencial administrativa invalida.");
            return;
        }
        status.classList.add("error");
        status.textContent = error?.status === 422
            ? "No se pudo crear la versión: el snapshot fuente es incompatible con el validador actual."
            : editorialErrorMessage(error);
    } finally {
        if (adminEditorialViewGuard.isCurrent(operation) && currentEditorialState) {
            renderEditorialState(currentEditorialState);
        }
    }
}

async function executeEditorialAction(action, button) {
    const selectedEventId = document.getElementById("editorialEventId").value.trim();
    if (!action
        || adminEditorialViewGuard.requiresRefresh()
        || adminEditorialWorkflowRunner.isPending()
        || adminWorkingVersionRunner.isPending()
        || adminDraftSaveRunner.isPending()
        || currentEditorialState?.eventId !== action.eventId
        || selectedEventId !== action.eventId) return;
    const operation = adminEditorialViewGuard.begin(action.eventId);
    const status = document.getElementById("editorialReaderStatus");
    button.disabled = true;
    status.classList.remove("error");
    status.textContent = "Verificando el estado vigente...";

    try {
        const result = await adminEditorialWorkflowRunner.run({
            eventId: action.eventId,
            versionId: action.versionId,
            password: administrativePassword,
            requestedKind: action.kind,
            expectedStatus: action.expectedStatus
        });

        if (result.state) {
            if (!adminEditorialViewGuard.acceptState(operation, result.state)) return;
            currentEditorialState = result.state;
            clearEditorialTextEditor();
            renderEditorialState(result.state);
            await loadEditorialTextEditor(result.state, operation);
        } else if (!adminEditorialViewGuard.isCurrent(operation)) {
            return;
        }

        if (result.outcome === "success") {
            blockedEditorialActionKey = "";
            renderEditorialState(result.state);
            status.textContent = action.kind === "publish"
                ? "Version publicada y estado actualizado."
                : "Workflow actualizado.";
            return;
        }
        if (result.outcome === "conflict" || result.outcome === "stale") {
            blockedEditorialActionKey = editorialActionKey(action);
            renderEditorialState(result.state);
            status.classList.add("error");
            status.textContent = "El estado cambio en el servidor. Se recargo el evento y la accion anterior quedo bloqueada.";
            return;
        }
        if (result.outcome === "accepted-refresh-failed") {
            adminEditorialViewGuard.requireRefresh(operation);
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            status.classList.add("error");
            status.textContent = "La operacion fue aceptada, pero no se pudo actualizar la vista. Consulta nuevamente el evento antes de realizar otra accion.";
            return;
        }
        if (result.outcome === "conflict-refresh-failed") {
            adminEditorialViewGuard.requireRefresh(operation);
            clearEditorialTextEditor();
            renderEditorialState(currentEditorialState);
            status.classList.add("error");
            status.textContent = "La operacion encontro un conflicto y no se pudo actualizar la vista. Consulta nuevamente el evento.";
            return;
        }
        if (result.outcome === "cancelled") {
            status.textContent = "Publicacion cancelada. No se realizaron cambios.";
        }
    } catch (error) {
        if (error.code === "UNAUTHORIZED") {
            resetForAuthentication("Credencial administrativa invalida.");
            return;
        }
        status.classList.add("error");
        status.textContent = editorialErrorMessage(error);
    } finally {
        if (adminEditorialViewGuard.isCurrent(operation) && currentEditorialState) {
            renderEditorialState(currentEditorialState);
        } else if (currentEditorialState
            && adminEditorialViewGuard.isSelected(currentEditorialState.eventId)) {
            renderEditorialState(currentEditorialState);
        }
    }
}

function editorialErrorMessage(error) {
    if (error?.status === 429 && error.retryAfter) {
        return `${error.message} Reintenta en ${error.retryAfter} segundos.`;
    }
    return error?.message || "No se pudo completar la operacion editorial.";
}

async function requestPrivatePreview(options = {}) {
    const eventId = options.eventId || document.getElementById("editorialEventId").value.trim();
    const versionId = options.versionId || currentEditorialState?.currentWorkingVersionId || currentEditorialState?.publishedVersionId;
    const status = options.status || document.getElementById("editorialReaderStatus");
    const generation = dashboardGeneration;
    const isCurrent = options.isCurrent || (() => generation === dashboardGeneration && Boolean(administrativePassword)
        && document.getElementById("editorialEventId").value.trim() === eventId);
    if (!versionId) { status.textContent = "Vista previa no disponible: el evento no tiene versión."; return; }
    status.textContent = "Solicitando vista previa...";
    try {
        const result = await adminEditorialClient.requestPreview({ eventId, versionId, password: administrativePassword });
        if (!isCurrent()) return;
        const previewUrl = new URL(result.previewUrl, window.location.origin);
        const invitationUrl = `/invitacion.html?previewToken=${encodeURIComponent(previewUrl.searchParams.get("token"))}`;
        window.open(invitationUrl, "_blank", "noopener,noreferrer");
        status.textContent = `Vista previa válida hasta ${formatDate(result.expiresAt)}.`;
    } catch (error) {
        if (!isCurrent()) return;
        if (["UNAUTHORIZED", "FORBIDDEN"].includes(error.code)) return resetForAuthentication(error.message);
        status.classList.add("error");
        status.textContent = error.code === "TOKEN_EXPIRED" ? "La vista previa expiró. Solicita una nueva." : error.message;
    }
}

function appendDefinition(list, label, value) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = String(value);
    list.append(term, description);
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("es-AR");
}

function bindImageInput(inputId, target, previewId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener("change", async () => {
        try {
            const files = Array.from(input.files || []);
            editedImages[target] = [];

            for (const file of files) {
                validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE);
                editedImages[target].push(await fileToBase64(file, { compressImage: true }));
            }

            renderPreviews(target, previewId);

            if (editedImages[target][0]) {
                openEditor(target, 0);
            }
            updateLivePreview();
        } catch (error) {
            input.value = "";
            editedImages[target] = [];
            renderPreviews(target, previewId);
            window.alert(error.message);
        }
    });
}

/* Legacy media editor disabled during the read-only editorial reconnection.
async function loadExistingEvent() {
    const id = valueOf("idEvento");
    if (!id) {
        window.alert("Ingresa el ID del evento que deseas cargar.");
        return;
    }

    try {
        const response = await fetch(`/api/eventos/${encodeURIComponent(id)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar el evento.");

        const multimedia = data.multimedia || {};
        document.getElementById("template_slug").value = data.datos?.template_slug || data.template_slug || "boda-vertical";
        const legacyImages = [multimedia.personajeHeader, multimedia.personajeSeparador, multimedia.fondoVentana3]
            .map((source, index) => source || multimedia.galeria?.[index] || "");
        const layers = multimedia.capas || {};
        [layers.portada || legacyImages[0], layers.encuentro || legacyImages[1], layers.confirmacion || legacyImages[2]]
            .forEach((source, index) => {
                editedImages[`capa${index + 1}`] = source ? [source] : [];
                const mode = document.getElementById(`sourceModeCapa${index + 1}`);
                const url = document.getElementById(`urlCapa${index + 1}`);
                if (source && !source.startsWith("data:")) {
                    mode.value = "url";
                    url.value = source;
                }
                renderPreviews(`capa${index + 1}`, `previewCapa${index + 1}`);
            });
        document.getElementById("mensaje").value = data.mensaje || data.bendicion || data.dedicatoria || "";
        document.getElementById("fontFamily").value = data.fontFamily || "playfair";
        document.getElementById("colorFondo").value = data.estilos?.colorFondo || "#ffffff";
        document.getElementById("colorTexto").value = data.estilos?.colorTexto || "#333333";
        document.getElementById("colorBoton").value = data.estilos?.colorBoton || "#0d9488";
        document.getElementById("colorSombra").value = data.estilos?.colorSombra || "#000000";
        document.getElementById("colorBordeDecorativo").value = data.estilos?.colorBordeDecorativo || "#b88746";
        ["capa1", "capa2", "capa3"].forEach((layer) => {
            if (data.layoutConfig?.[layer]) {
                layoutState[layer] = { ...layoutState[layer], ...data.layoutConfig[layer] };
                const offsetY = Number(layoutState[layer].offsetY);
                if (!Number.isFinite(offsetY) || offsetY < 50 || offsetY > 95) {
                    layoutState[layer].offsetY = layer === "capa1" ? 78 : 50;
                }
            }
        });
        if (data.layoutConfig?.audioButton) {
            layoutState.audioButton = { ...layoutState.audioButton, ...data.layoutConfig.audioButton };
        }
        document.getElementById("fontFamily").dispatchEvent(new Event("change"));
        syncLayoutControls();
        updateLivePreview();
        window.alert("Evento cargado correctamente.");
    } catch (error) {
        window.alert(error.message);
    }
}

*/

function renderPreviews(target, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;

    preview.innerHTML = editedImages[target]
        .map((src, index) => `
            <button class="media-preview" type="button" data-target="${target}" data-index="${index}">
                <img src="${src}" alt="Vista previa ${index + 1}">
                <span>Editar ${index + 1}</span>
            </button>
        `)
        .join("");

    preview.querySelectorAll(".media-preview").forEach((button) => {
        button.addEventListener("click", () => {
            openEditor(button.dataset.target, Number(button.dataset.index));
        });
    });
}

function bindEditorControls() {
    document.getElementById("btnRotateLeft").addEventListener("click", () => editorState.cropper?.rotate(-90));
    document.getElementById("btnRotateRight").addEventListener("click", () => editorState.cropper?.rotate(90));
    document.getElementById("btnApplyEdit").addEventListener("click", applyCurrentEdit);
    document.getElementById("btnCancelEdit").addEventListener("click", closeEditor);
    document.getElementById("imageFilter").addEventListener("change", updateEditorFilter);
}

function openEditor(target, index) {
    const image = document.getElementById("editorImage");
    const panel = document.getElementById("imageEditor");

    editorState.target = target;
    editorState.index = index;
    editorState.source = editedImages[target][index];

    image.src = editorState.source;
    image.style.filter = filterCss(document.getElementById("imageFilter").value);
    panel.classList.add("is-open");

    if (editorState.cropper) {
        editorState.cropper.destroy();
    }

    editorState.cropper = new Cropper(image, {
        viewMode: 1,
        autoCropArea: 0.92,
        background: false,
        responsive: true,
        movable: true,
        zoomable: true,
        rotatable: true
    });
}

function updateEditorFilter() {
    const image = document.getElementById("editorImage");
    image.style.filter = filterCss(document.getElementById("imageFilter").value);
}

function filterCss(filterName) {
    const filters = {
        warm: "sepia(0.18) saturate(1.16) contrast(1.04) brightness(1.03)",
        cool: "saturate(1.08) hue-rotate(188deg) brightness(1.04)",
        bw: "grayscale(1) contrast(1.08)",
        soft: "contrast(0.96) brightness(1.08) saturate(0.92)",
        none: "none"
    };

    return filters[filterName] || filters.none;
}

function applyCurrentEdit() {
    if (!editorState.cropper || !editorState.target) return;

    const canvas = editorState.cropper.getCroppedCanvas({
        maxWidth: 1600,
        maxHeight: 1600,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high"
    });

    const filteredCanvas = applyCanvasFilter(canvas, document.getElementById("imageFilter").value);
    const result = filteredCanvas.toDataURL("image/jpeg", 0.88);

    editedImages[editorState.target][editorState.index] = result;
    renderPreviews(editorState.target, previewIdForTarget(editorState.target));
    closeEditor();
}

function applyCanvasFilter(sourceCanvas, filterName) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    ctx.filter = filterCss(filterName);
    ctx.drawImage(sourceCanvas, 0, 0);

    return canvas;
}

function closeEditor() {
    document.getElementById("imageEditor").classList.remove("is-open");
    document.getElementById("imageFilter").value = "none";
    document.getElementById("editorImage").style.filter = "none";

    if (editorState.cropper) {
        editorState.cropper.destroy();
        editorState.cropper = null;
    }
}

function previewIdForTarget(target) {
    return {
        capa1: "previewCapa1",
        capa2: "previewCapa2",
        capa3: "previewCapa3"
    }[target];
}

/* Legacy writer disabled during the read-only editorial reconnection.
async function handleSubmit(event) {
    event.preventDefault();

    const resultBox = document.getElementById("resultBox");
    resultBox.style.display = "none";

    try {
        const audioTracks = await collectAudioTracks();
        const layerSources = [1, 2, 3].map((index) => getLayerSource(index));
        const id = valueOf("idEvento");
        const selectTemplate = document.getElementById("template_slug");
        const templateSlug = selectTemplate?.value || "boda-vertical";
        const multimedia = {
            capas: {
                portada: layerSources[0],
                encuentro: layerSources[1],
                confirmacion: layerSources[2]
            },
            personajeHeader: layerSources[0],
            personajeSeparador: layerSources[1],
            musica: "",
            audios: uniqueAudioTracks(audioTracks),
            audioPlayMode: document.getElementById("audioPlayMode").value
        };
        const payload = {
            password: valueOf("adminPassword"),
            id,
            template_slug: templateSlug,
            tema: valueOf("tema"),
            nombre: valueOf("nombre"),
            subtitulo: valueOf("subtitulo"),
            mensaje: valueOf("mensaje"),
            fontFamily: valueOf("fontFamily"),
            fecha: document.getElementById("fecha").value,
            horario: valueOf("horario"),
            lugar: valueOf("lugar"),
            direccion: valueOf("direccion"),
            linkMaps: valueOf("linkMaps"),
            estilos: {
                colorFondo: document.getElementById("colorFondo").value,
                colorTexto: document.getElementById("colorTexto").value,
                colorBoton: document.getElementById("colorBoton").value,
                colorSombra: document.getElementById("colorSombra").value,
                colorBordeDecorativo: document.getElementById("colorBordeDecorativo").value,
                efectoFlyer: document.getElementById("efectoFlyer").checked
            },
            layoutConfig: layoutState,
            multimedia,
            datos: {
                template_slug: templateSlug
            },
            confirmacion: {
                tel1: normalizeWhatsAppPhone(valueOf("tel1")),
                nombre1: valueOf("nombre1"),
                tel2: normalizeWhatsAppPhone(valueOf("tel2")),
                nombre2: valueOf("nombre2")
            }
        };

        validateMediaPayload(payload.multimedia);

        const response = await fetch("/api/eventos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "OcurriÃ³ un error al guardar");
        }

        const linkInvitacion = `${window.location.origin}/invitacion.html?id=${data.id}`;
        resultBox.className = "success";
        resultBox.innerHTML = `
            <strong>InvitaciÃ³n guardada con Ã©xito.</strong><br><br>
            Enlace directo:<br>
            <a href="${linkInvitacion}" target="_blank" rel="noopener noreferrer">${linkInvitacion}</a>
        `;
        resultBox.style.display = "block";
    } catch (error) {
        resultBox.className = "error";
        resultBox.innerHTML = `<strong>Error:</strong> ${escapeHtml(error.message)}`;
        resultBox.style.display = "block";
    }
}

*/

async function collectAudioTracks() {
    const fileInput = document.getElementById("fileMusica");
    const files = Array.from(fileInput.files || []);
    const tracks = [];

    for (const file of files) {
        validateFile(file, ALLOWED_AUDIO_TYPES, MAX_AUDIO_SIZE);
        tracks.push({ src: await fileToBase64(file), name: file.name });
    }

    const urls = document.getElementById("urlMusica").value
        .split(/[\n,]+/)
        .map((url) => url.trim())
        .filter(Boolean);
    urls.forEach(validateExternalUrl);
    urls.forEach((src, index) => tracks.push({ src, name: `Pista web ${index + 1}` }));

    return uniqueAudioTracks(tracks);
}

function uniqueNonEmpty(values) {
    return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function uniqueAudioTracks(tracks) {
    const seen = new Set();
    return tracks.filter((track) => {
        if (!track?.src || seen.has(track.src)) return false;
        seen.add(track.src);
        return true;
    });
}

function valueOf(id) {
    return document.getElementById(id).value.trim();
}

function selectedImageFile(target) {
    const mode = document.getElementById(`sourceMode${target}`)?.value;
    return mode === "file" ? editedImages[target.toLowerCase()][0] || "" : "";
}

function selectedImageUrl(target) {
    const mode = document.getElementById(`sourceMode${target}`)?.value;
    const value = mode === "url" ? valueOf(`url${target}`) : "";
    if (value) validateExternalUrl(value);
    return value;
}

function validateMediaPayload(multimedia) {
    if (!multimedia || typeof multimedia !== "object") {
        throw new Error("La configuraciÃ³n multimedia no es vÃ¡lida.");
    }

    if (!Array.isArray(multimedia.audios)) {
        throw new Error("La lista de audios no es vÃ¡lida.");
    }

    multimedia.audios.forEach((audio, index) => {
        if (!audio || typeof audio !== "object" || typeof audio.src !== "string" || !audio.src.trim()) {
            throw new Error(`El audio ${index + 1} tiene una estructura invÃ¡lida.`);
        }
        if (audio.src.startsWith("data:") && !/^data:audio\/mpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(audio.src)) {
            throw new Error(`El contenido Base64 del audio ${index + 1} no es vÃ¡lido.`);
        }
    });

    if (!multimedia.capas || typeof multimedia.capas !== "object") {
        throw new Error("Las imÃ¡genes de las capas no son vÃ¡lidas.");
    }

    Object.values(multimedia.capas).forEach((source, index) => {
        if (!source) return;
        if (typeof source !== "string") throw new Error(`La imagen de la capa ${index + 1} es invÃ¡lida.`);
        if (source.startsWith("data:") && !/^data:image\/(jpeg|png|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(source)) {
            throw new Error(`El contenido Base64 de la capa ${index + 1} no es vÃ¡lido.`);
        }
        if (!source.startsWith("data:")) validateExternalUrl(source);
    });
}

function getLayerSource(index) {
    const target = `Capa${index}`;
    const fileSource = selectedImageFile(target);
    const urlSource = selectedImageUrl(target);
    return fileSource || urlSource;
}

function validateExternalUrl(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`URL de imagen no vÃ¡lida: ${value}`);
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`La URL debe comenzar con http:// o https://: ${value}`);
    }
}

function normalizeWhatsAppPhone(value) {
    let phone = String(value || "").replace(/\D/g, "");
    if (!phone) return "";

    if (phone.startsWith("0")) phone = phone.slice(1);
    if (!phone.startsWith("549")) phone = `549${phone}`;

    return phone;
}

async function fileToBase64(file, options = {}) {
    if (!file) return null;
    if (options.compressImage && file.type.startsWith("image/") && file.type !== "image/svg+xml") {
        const source = await readFileAsDataUrl(file);
        const image = await loadImage(source);
        const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.82);
    }
    return readFileAsDataUrl(file);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function validateFile(file, allowedTypes, maxSize) {
    if (!allowedTypes.includes(file.type)) {
        throw new Error(`Tipo de archivo no permitido: ${file.name}`);
    }

    if (file.size > maxSize) {
        throw new Error(`El archivo ${file.name} supera el tamaÃ±o mÃ¡ximo permitido.`);
    }
}

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
    });
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

