const editedImages = {
    header: [],
    separador: [],
    galeria: []
};

const editorState = {
    cropper: null,
    target: null,
    index: 0,
    source: ""
};

document.addEventListener("DOMContentLoaded", () => {
    bindImageInput("fileHeader", "header", "previewHeader");
    bindImageInput("fileSeparador", "separador", "previewSeparador");
    bindImageInput("fileGaleria", "galeria", "previewGaleria");
    bindEditorControls();
    document.getElementById("adminForm").addEventListener("submit", handleSubmit);
});

function bindImageInput(inputId, target, previewId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener("change", async () => {
        const files = Array.from(input.files || []);
        editedImages[target] = [];

        for (const file of files) {
            editedImages[target].push(await fileToBase64(file));
        }

        renderPreviews(target, previewId);

        if (editedImages[target][0]) {
            openEditor(target, 0);
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
        const musicaBase64 = musicaFile ? await fileToBase64(musicaFile) : null;

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
            fecha: document.getElementById("fecha").value,
            horario: valueOf("horario"),
            lugar: valueOf("lugar"),
            direccion: valueOf("direccion"),
            linkMaps: valueOf("linkMaps"),
            estilos: {
                colorFondo: document.getElementById("colorFondo").value,
                colorTexto: document.getElementById("colorTexto").value,
                colorBoton: document.getElementById("colorBoton").value
            },
            multimedia: {
                personajeHeader: editedImages.header[0] || urlHeader || "",
                personajeSeparador: editedImages.separador[0] || urlSeparador || "",
                musica: musicaBase64 || urlMusica || "",
                galeria: editedImages.galeria.concat(galeriaUrls)
            },
            confirmacion: {
                tel1: valueOf("tel1"),
                nombre1: valueOf("nombre1"),
                tel2: valueOf("tel2"),
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
            <a href="${linkInvitacion}" target="_blank">${linkInvitacion}</a>
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

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
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
