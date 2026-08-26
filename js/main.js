// Cargar los datos según el parámetro ?id=... o por defecto data.json
const params = new URLSearchParams(window.location.search);
const invitacionId = params.get("id");
const archivoDatos = invitacionId ? `/data/${invitacionId}.json` : "data.json";

document.addEventListener("DOMContentLoaded", () => {
    fetch(archivoDatos)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`No se pudo cargar ${archivoDatos}`);
            }
            return response.json();
        })
        .then((data) => {
            cargarDatos(data);
            aplicarTema(data.tema || "infantil");
            iniciarCuentaRegresiva(data.fechaEvento);
        })
        .catch((error) => {
            console.error("Error al cargar los datos:", error);
            const fallback = "data.json";
            return fetch(fallback)
                .then((res) => res.json())
                .then((data) => {
                    cargarDatos(data);
                    aplicarTema(data.tema || "infantil");
                    iniciarCuentaRegresiva(data.fechaEvento);
                });
        });
});

function aplicarTema(tema) {
    const temaValido = ["elegante", "infantil", "minimal"].includes(tema) ? tema : "infantil";
    document.body.setAttribute("data-theme", temaValido);

    const btnMusic = document.getElementById("btnMusic");
    if (btnMusic) {
        btnMusic.className = `fixed top-4 right-4 rounded-full font-bold text-sm z-50 transition-all ${temaValido === "elegante"
            ? "bg-[#f6eddf] text-[#3d2d1a] border border-[#d8b16a] shadow-md"
            : temaValido === "minimal"
                ? "bg-[#edf3fb] text-[#1d3557] border border-[#9ab6d9] shadow-md"
                : "bg-white/80 text-pink-600 shadow-md border border-pink-100"
            }`;
    }

    const btnCalendar = document.getElementById("btnCalendar");
    if (btnCalendar) {
        btnCalendar.className = `${temaValido === "elegante"
            ? "mt-4 inline-flex items-center justify-center bg-[#a77c2d] hover:bg-[#8b6828] text-[#fffaf5] font-bold py-2 px-6 rounded-full text-sm shadow transition"
            : temaValido === "minimal"
                ? "mt-4 inline-flex items-center justify-center bg-[#1d3557] hover:bg-[#112847] text-white font-bold py-2 px-6 rounded-full text-sm shadow transition"
                : "mt-4 bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-6 rounded-full text-sm shadow transition"
            }`;
    }

    const btnMaps = document.getElementById("btnMaps");
    if (btnMaps) {
        btnMaps.className = `${temaValido === "elegante"
            ? "inline-block bg-[#a77c2d] hover:bg-[#8b6828] text-[#fffaf5] font-bold py-2.5 px-6 rounded-full text-sm shadow transition"
            : temaValido === "minimal"
                ? "inline-block bg-[#1d3557] hover:bg-[#112847] text-white font-bold py-2.5 px-6 rounded-full text-sm shadow transition"
                : "inline-block bg-pink-500 hover:bg-pink-600 text-white font-bold py-2.5 px-6 rounded-full text-sm shadow transition"
            }`;
    }

    const rsvpButtons = document.querySelectorAll("#rsvpContainer a");
    rsvpButtons.forEach((button) => {
        button.className = `${temaValido === "elegante"
            ? "rsvp-button elegante"
            : temaValido === "minimal"
                ? "rsvp-button minimal"
                : "rsvp-button infantil"
            }`;
    });
}

function cargarDatos(data) {
    // Inyectar textos simples
    document.getElementById("nombre").innerText = data.nombre;
    document.getElementById("subtitulo").innerText = data.subtitulo;
    document.getElementById("fechaTexto").innerText = `🎉 ${data.fechaTexto}`;
    document.getElementById("horarioTexto").innerText = `⏰ ${data.horarioTexto}`;
    document.getElementById("lugarNombre").innerText = `📍 ${data.lugarNombre}`;
    document.getElementById("lugarDireccion").innerText = data.lugarDireccion;
    document.getElementById("confirmacionLimite").innerText = `Confirmar asistencia antes del ${data.confirmacionLimite}`;

    // Inyectar enlaces
    document.getElementById("btnMaps").href = data.googleMapsUrl;
    document.getElementById("btnCalendar").href = data.googleCalendarUrl;

    // Generar botones de WhatsApp dinámicamente con estilos e ícono
    const rsvpContainer = document.getElementById("rsvpContainer");
    rsvpContainer.innerHTML = "";

    data.contactosRSVP.forEach((contacto) => {
        const mensaje = encodeURIComponent(`¡Hola ${contacto.nombre}! Confirmo mi asistencia para el cumpleaños de ${data.nombre}.`);
        const numeroLimpio = normalizeWhatsAppPhone(contacto.telefono);
        if (!numeroLimpio) return;
        const link = `https://api.whatsapp.com/send?phone=${numeroLimpio}&text=${mensaje}`;

        const a = document.createElement("a");
        a.href = link;
        a.target = "_blank";
        a.className = "rsvp-button infantil flex items-center justify-center gap-2 font-bold py-3 px-6 rounded-full text-xs shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 my-1";
        a.innerHTML = `
      <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
      </svg>
      CONFIRMAR CON ${contacto.nombre}
    `;
        rsvpContainer.appendChild(a);
    });

    aplicarTema(data.tema || "infantil");
}

function normalizeWhatsAppPhone(value) {
    let phone = String(value || "").replace(/\D/g, "");
    if (!phone) return "";

    if (phone.startsWith("0")) phone = phone.slice(1);
    if (!phone.startsWith("549")) phone = `549${phone}`;

    return phone;
}

// Contador regresivo
function iniciarCuentaRegresiva(fechaDestino) {
    const objetivo = new Date(fechaDestino).getTime();

    const intervalo = setInterval(() => {
        const ahora = new Date().getTime();
        const diferencia = objetivo - ahora;

        if (diferencia < 0) {
            clearInterval(intervalo);
            document.getElementById("timer").innerHTML = "<h3>¡ES HOY! 🎉</h3>";
            return;
        }

        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);

        document.getElementById("dias").innerText = String(dias).padStart(2, '0');
        document.getElementById("horas").innerText = String(horas).padStart(2, '0');
        document.getElementById("minutos").innerText = String(minutos).padStart(2, '0');
        document.getElementById("segundos").innerText = String(segundos).padStart(2, '0');
    }, 1000);
}

// Control de Música
function toggleMusic() {
    const audio = document.getElementById("bg-music");
    const btn = document.getElementById("btnMusic");
    if (audio.paused) {
        audio.play();
        btn.innerText = "🔊 Pausar";
    } else {
        audio.pause();
        btn.innerText = "🎵 Música";
    }
}