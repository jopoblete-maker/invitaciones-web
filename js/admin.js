const editedImages = {
    header: [],
    separador: [],
    galeria: []
};

const ADMIN_PASSWORD_HASH = "702e0afc3ebf1b22464cb509747357e3f0fa371ed7bf0df3b25c3d9114abb662";
const ADMIN_SESSION_KEY = "invitacionesAdminSession";
const SESSION_DURATION_MS = 30 * 60 * 1000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/svg+xml"];
const ALLOWED_AUDIO_TYPES = ["audio/mpeg"];

const editorState = {
    cropper: null,
    target: null,
    index: 0,
    source: ""
};

document.addEventListener("DOMContentLoaded", () => {
    bindAuthentication();
    bindImageInput("fileHeader", "header", "previewHeader");
    bindImageInput("fileSeparador", "separador", "previewSeparador");
    bindImageInput("fileGaleria", "galeria", "previewGaleria");
    bindEditorControls();
    document.getElementById("adminForm").addEventListener("submit", handleSubmit);
});

function bindAuthentication() {
    const authForm = document.getElementById("authForm");
    const logoutButton = document.getElementById("btnLogout");
    const passwordInput = document.getElementById("adminPassword");

    if (isAuthenticated()) showAdmin(passwordInput, "");

    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const password = document.getElementById("loginPassword").value;
        const hash = await hashValue(password);
        const error = document.getElementById("authError");

        if (hash !== ADMIN_PASSWORD_HASH) {
            error.textContent = "La clave de acceso no es válida.";
            return;
        }

        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
            token: hash,
            expiresAt: Date.now() + SESSION_DURATION_MS
        }));
        error.textContent = "";
        showAdmin(passwordInput, password);
    });

    logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        document.getElementById("adminForm").hidden = true;
        logoutButton.hidden = true;
        document.getElementById("authPanel").hidden = false;
        document.getElementById("loginPassword").value = "";
        passwordInput.value = "";
    });
}

function showAdmin(passwordInput, password) {
    document.getElementById("authPanel").hidden = true;
    document.getElementById("adminForm").hidden = false;
    document.getElementById("btnLogout").hidden = false;
    if (password) passwordInput.value = password;
}

function isAuthenticated() {
    try {
        const session = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || "null");
        return session?.token === ADMIN_PASSWORD_HASH && session.expiresAt > Date.now();
    } catch {
        return false;
    }
}

async function hashValue(value) {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
                editedImages[target].push(await fileToBase64(file));
            }

            renderPreviews(target, previewId);

            if (editedImages[target][0]) {
                openEditor(target, 0);
            }
        } catch (error) {
            input.value = "";
            editedImages[target] = [];
            renderPreviews(target, previewId);
            window.alert(error.message);
        }
    });
}

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
        header: "previewHeader",
        separador: "previewSeparador",
        galeria: "previewGaleria"
    }[target];
}

async function handleSubmit(event) {
    event.preventDefault();

    const resultBox = document.getElementById("resultBox");
    resultBox.style.display = "none";

    try {
        const musicaFile = document.getElementById("fileMusica").files[0];
        if (musicaFile) validateFile(musicaFile, ALLOWED_AUDIO_TYPES, MAX_AUDIO_SIZE);
        const musicaBase64 = musicaFile ? await fileToBase64(musicaFile) : null;
        const marcaAguaFile = document.getElementById("fileMarcaAgua").files[0];
        if (marcaAguaFile) validateFile(marcaAguaFile, ["image/png", "image/svg+xml"], MAX_IMAGE_SIZE);
        const marcaAguaBase64 = marcaAguaFile
            ? await tintWatermark(marcaAguaFile, document.getElementById("colorMarcaAgua").value)
            : "";

        const urlHeader = valueOf("urlHeader");
        const urlSeparador = valueOf("urlSeparador");
        const urlMusica = valueOf("urlMusica");
        const urlGaleria = valueOf("urlGaleria");
        const galeriaUrls = urlGaleria
            ? urlGaleria.split(",").map((url) => url.trim()).filter(Boolean)
            : [];

        const id = valueOf("idEvento");
        const payload = {
            password: valueOf("adminPassword"),
            id,
            tema: valueOf("tema"),
            nombre: valueOf("nombre"),
            subtitulo: valueOf("subtitulo"),
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
                efectoFlyer: document.getElementById("efectoFlyer").checked
            },
            multimedia: {
                personajeHeader: editedImages.header[0] || urlHeader || "",
                personajeSeparador: editedImages.separador[0] || urlSeparador || "",
                musica: musicaBase64 || urlMusica || "",
                marcaAgua: marcaAguaBase64,
                galeria: editedImages.galeria.concat(galeriaUrls)
            },
            confirmacion: {
                tel1: normalizeWhatsAppPhone(valueOf("tel1")),
                nombre1: valueOf("nombre1"),
                tel2: normalizeWhatsAppPhone(valueOf("tel2")),
                nombre2: valueOf("nombre2")
            }
        };

        const response = await fetch("/api/eventos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Ocurrió un error al guardar");
        }

        const linkInvitacion = `${window.location.origin}/invitacion.html?id=${data.id}`;
        resultBox.className = "success";
        resultBox.innerHTML = `
            <strong>Invitación guardada con éxito.</strong><br><br>
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

function valueOf(id) {
    return document.getElementById(id).value.trim();
}

function normalizeWhatsAppPhone(value) {
    let phone = String(value || "").replace(/\D/g, "");
    if (!phone) return "";

    if (phone.startsWith("0")) phone = phone.slice(1);
    if (!phone.startsWith("549")) phone = `549${phone}`;

    return phone;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
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
        throw new Error(`El archivo ${file.name} supera el tamaño máximo permitido.`);
    }
}

async function tintWatermark(file, color) {
    const source = await fileToBase64(file);
    const image = await loadImage(source);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/png");
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
