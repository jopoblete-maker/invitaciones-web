/* Event-specific artwork adapter. Rendering, RSVP, gifts and music remain in the existing engine. */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.AngelEliPresentation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function isAuthorizedContext(source, content, presentation, hostname) {
        return ["127.0.0.1", "localhost", "::1"].includes(hostname)
            && source?.mode === "local-premium" && source.eventId === "angel-eli-boda"
            && source.url === "/__premium-local-preview/angel-eli-boda"
            && content?.id === source.eventId && content.template?.slug === "boda-fiesta-premium"
            && content.template.variant === "angel-eli-local-v1"
            && presentation?.eventProfile === "angel-eli-local-v1";
    }
    const labels = { portada: "Portada", "nuestra-historia": "Nuestra historia", fiesta: "Fiesta y ubicación",
        confirmacion: "Confirmación de asistencia", vestimenta: "Vestimenta", caminata: "Caminata", regalos: "Regalos",
        "carpeta-compartida": "Carpeta compartida", cierre: "Cierre" };
    const layerDesigns = {
        fiesta: { background: "fiesta", copy: [
            ["title", "Fiesta"], ["address", "Hernán Cortés 17"],
            ["city", "Carlos Spegazzini,\nBuenos Aires"], ["time", "20:00 hs. a 4:00 a.m hs"]
        ] },
        confirmacion: { background: "asistencia", copy: [
            ["title", "Asistencia"], ["message", "Por favor avisa\nsi vendrás a la fiesta."]
        ] },
        vestimenta: { background: "vestimenta", copy: [
            ["kicker", "CÓDIGO DE"], ["title", "Vestimenta"],
            ["message", "Queremos que te sientas cómodo\ny disfrutes esta noche tan especial\njunto a nosotros."],
            ["dress", "ELEGANTE SPORT"], ["color", "El color"], ["white", "Blanco"],
            ["reserved", "está reservado\npara la Novia."]
        ] },
        regalos: { background: "regalos", copy: [
            ["title", "Regalos"], ["message", "Tu presencia es nuestro\nmejor regalo. Pero si deseas\nhacernos un obsequio, aquí\npodrás ver los datos del CBU."]
        ] },
        "carpeta-compartida": { background: "carpeta",
            url: "https://drive.google.com/drive/folders/16IxkPzVLFbdmBiKsCoyjmjMZU82ByYul?usp=drive_link", copy: [
            ["title", "Carpeta\nCompartida"], ["message", "Hemos creado una carpeta\npara que puedan subir las fotos y videos\nque tomen de la fiesta.\n¡Porque no queremos perdernos\nningún momento!"]
        ] },
        cierre: { background: "cierre", copy: [
            ["greeting", "¡Te esperamos!"], ["angel", "Ángel"], ["and", "y"], ["eli", "Eli"]
        ] }
    };
    function overlay(element, label, text, iconName, documentRef = element.ownerDocument) {
        element.classList.add("ae-artwork-action");
        element.setAttribute("aria-label", label);
        element.setAttribute("title", label);
        const paths = {
            map: "M12 22s8-9 8-14a8 8 0 1 0-16 0c0 5 8 14 8 14Z M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
            gift: "M3 8h18v5H3z M5 13v9h14v-9 M12 8v14 M12 8C2 8 5 0 9 3l3 5Zm0 0c10 0 7-8 3-5l-3 5Z",
            upload: "M7 18H5a4 4 0 0 1-1-8 8 8 0 0 1 16 0 4 4 0 0 1-1 8h-2 M12 22V11 M8 15l4-4 4 4",
            whatsapp: "M4 19 2 23l5-2a10 10 0 1 0-3-2Z M8 7c0 5 4 9 9 9l1-3-3-1-1 1c-2-1-3-2-4-4l1-1-1-3-2 2Z"
        };
        const icon = documentRef.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("aria-hidden", "true");
        const path = documentRef.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", paths[iconName]); icon.append(path);
        const caption = documentRef.createElement("span"); caption.textContent = text;
        const arrow = documentRef.createElement("span"); arrow.textContent = "›"; arrow.setAttribute("aria-hidden", "true");
        arrow.className = "ae-action-arrow";
        element.replaceChildren(icon, caption, arrow);
        return element;
    }
    function addTextLayer(frame, sectionId, documentRef) {
        const layer = documentRef.createElement("div");
        layer.className = "ae-text-layer";
        layerDesigns[sectionId].copy.forEach(([kind, text]) => {
            const paragraph = documentRef.createElement("p");
            paragraph.className = "ae-copy ae-copy--" + kind;
            text.split(/(\s+)/u).filter(Boolean).forEach(part => {
                if (/^\s+$/u.test(part)) paragraph.append(documentRef.createTextNode(part));
                else {
                    const word = documentRef.createElement("span");
                    word.className = "ae-word";
                    word.textContent = part;
                    paragraph.append(word);
                }
            });
            layer.append(paragraph);
        });
        frame.append(layer);
    }
    function getPresentationSections(sections) {
        // Keep the authorized source intact; omit the duplicate before the shared renderer runs.
        return sections.filter(section => section.id !== "fotografia-pareja");
    }
    function apply(app, event, sections, documentRef) {
        app.classList.add("angel-eli-local");
        const pages = Array.from(app.querySelectorAll(".wedding-section"));
        if (pages.length !== 8 || sections.length !== 8) throw new Error("Local presentation unavailable.");
        pages.forEach((page, index) => {
            const section = sections[index], media = event.media.items[section.id];
            page.id = "ae-" + section.id;
            page.dataset.eventSection = section.id;
            page.dataset.demoSection = section.id;
            const previous = page.querySelector(".wedding-content");
            const frame = documentRef.createElement("div");
            frame.className = "ae-artwork";
            const title = documentRef.createElement(index === 0 ? "h1" : "h2");
            title.className = "ae-sr-only";
            title.id = page.id + "-title";
            title.textContent = index === 0 ? event.nombre : labels[section.id];
            page.setAttribute("aria-labelledby", title.id);
            page.tabIndex = -1;
            if (index === 0) {
                const video = documentRef.createElement("video");
                video.src = media.src;
                video.controls = false;
                video.autoplay = true;
                video.muted = true;
                video.defaultMuted = true;
                video.setAttribute("muted", "");
                video.playsInline = true;
                video.preload = "auto";
                video.width = 854; video.height = 480;
                video.setAttribute("aria-label", "Video de portada de " + event.nombre);
                frame.append(video);
            } else {
                const image = documentRef.createElement("img");
                const design = layerDesigns[section.id];
                image.src = design ? "/assets/events/fondos-sin-texto/" + design.background + "-fondo.png" : media.src;
                image.alt = design ? "" : section.data.alt || section.data.description || (section.id === "confirmacion"
                    ? "Asistencia. Por favor avisa si vendrás a la fiesta."
                    : section.id === "regalos" ? "Tu presencia es nuestro mejor regalo. Podés consultar los datos para un obsequio."
                    : title.textContent);
                image.loading = index < 2 ? "eager" : "lazy"; image.decoding = "async";
                const portrait = ["vestimenta", "cierre"].includes(section.id);
                image.width = portrait ? 1024 : 941; image.height = portrait ? 1536 : 1672;
                frame.append(image);
                if (design) addTextLayer(frame, section.id, documentRef);
            }
            if (section.id === "fiesta") {
                const link = documentRef.createElement("a");
                link.href = event.googleMapsUrl; link.target = "_blank"; link.rel = "noopener noreferrer";
                link.textContent = "Cómo llegar";
                frame.append(overlay(link, "Cómo llegar (abre el mapa en otra pestaña)", "Cómo llegar", "map", documentRef));
            }
            if (section.id === "confirmacion") {
                const link = previous?.querySelector(".rsvp-button");
                if (!link) throw new Error("Local RSVP unavailable.");
                frame.append(overlay(link, "Confirmar asistencia por WhatsApp (abre otra pestaña)", "Confirmar aquí", "whatsapp", documentRef));
            }
            if (section.id === "regalos") {
                // Preserve approved gift fields and the existing dialog/copy handlers.
                if (!previous?.querySelector("dl")) throw new Error("Local gifts unavailable.");
                page.replaceChildren(title, frame, previous);
                return;
            }
            if (section.id === "carpeta-compartida") {
                const url = layerDesigns[section.id].url;
                const button = documentRef.createElement(url ? "a" : "button");
                if (url) {
                    button.href = url; button.target = "_blank"; button.rel = "noopener noreferrer";
                } else {
                    button.type = "button"; button.disabled = true;
                    button.setAttribute("aria-describedby", page.id + "-pending");
                }
                frame.append(overlay(button, url ? "Subir aquí (abre la carpeta compartida en otra pestaña)"
                    : "Carpeta compartida pendiente de enlace", "Subir Aquí", "upload", documentRef));
                if (url) { page.replaceChildren(title, frame); return; }
                const note = documentRef.createElement("p");
                note.id = page.id + "-pending"; note.className = "ae-pending-note";
                note.textContent = "Carpeta compartida pendiente de enlace. Todavía no disponible.";
                page.replaceChildren(title, frame, note); return;
            }
            page.replaceChildren(title, frame);
        });
        // This additional local media section does not change the authorized source snapshot.
        const walkingPage = documentRef.createElement("section");
        walkingPage.className = "wedding-section wedding-section--media-closing";
        walkingPage.id = "ae-caminata";
        walkingPage.dataset.eventSection = "caminata";
        walkingPage.dataset.demoSection = "caminata";
        walkingPage.tabIndex = -1;
        const walkingTitle = documentRef.createElement("h2");
        walkingTitle.className = "ae-sr-only"; walkingTitle.id = "ae-caminata-title";
        walkingTitle.textContent = labels.caminata;
        walkingPage.setAttribute("aria-labelledby", walkingTitle.id);
        const walkingFrame = documentRef.createElement("div");
        walkingFrame.className = "ae-artwork";
        const walkingVideo = documentRef.createElement("video");
        walkingVideo.src = "/assets/events/angel-eli/angel-eli-caminata.mp4";
        walkingVideo.dataset.aeWalkingVideo = "true";
        walkingVideo.muted = true; walkingVideo.defaultMuted = true;
        walkingVideo.setAttribute("muted", "");
        walkingVideo.playsInline = true; walkingVideo.loop = true; walkingVideo.controls = false;
        walkingVideo.preload = "metadata";
        walkingVideo.width = 720; walkingVideo.height = 1080;
        walkingVideo.setAttribute("aria-label", "Video de caminata de " + event.nombre);
        walkingFrame.append(walkingVideo); walkingPage.append(walkingTitle, walkingFrame);
        const folderIndex = pages.findIndex(page => page.dataset.eventSection === "carpeta-compartida");
        if (folderIndex < 0) throw new Error("Local presentation unavailable.");
        pages[folderIndex].after(walkingPage);
        pages.splice(folderIndex + 1, 0, walkingPage);
        const nav = documentRef.createElement("nav");
        nav.className = "ae-section-nav"; nav.setAttribute("aria-label", "Secciones de la invitación");
        pages.forEach((page, index) => {
            const link = documentRef.createElement("a");
            link.href = "#" + page.id; link.textContent = String(index + 1);
            link.setAttribute("aria-label", "Ir a " + page.querySelector("h1,h2").textContent);
            nav.append(link);
        });
        app.prepend(nav);
        const widget = documentRef.getElementById("audioWidget");
        if (widget) { widget.dataset.premiumFloating = "true"; documentRef.body.append(widget); }
        setupTextAnimations(app, documentRef);
        setupWalkingVideo(walkingVideo, documentRef);
    }
    function setupWalkingVideo(video, documentRef, view = documentRef.defaultView) {
        setupWalkingVideo.dispose?.();
        let visible = false, generation = 0, observer;
        const pause = () => {
            generation++;
            video.autoplay = false;
            video.pause();
        };
        const play = () => {
            if (!visible || documentRef.hidden) return;
            const requestGeneration = ++generation;
            video.autoplay = true;
            try {
                video.currentTime = 0;
                const request = video.play();
                request?.catch?.(() => {
                    // A denied or aborted request never blocks navigation or affects music.
                    if (generation === requestGeneration) video.autoplay = false;
                });
            } catch (_) { video.autoplay = false; }
        };
        const setVisible = next => {
            if (next === visible) return;
            visible = next;
            if (visible) play();
            else pause();
        };
        const onVisibility = () => documentRef.hidden ? pause() : play();
        const measure = () => {
            const bounds = video.getBoundingClientRect();
            setVisible(bounds.height > 0 && bounds.bottom > 0 && bounds.top < view.innerHeight);
        };
        pause();
        if (typeof view.IntersectionObserver === "function") {
            observer = new view.IntersectionObserver(entries => entries.forEach(entry => {
                setVisible(entry.isIntersecting && entry.intersectionRect.height > 0);
            }), { threshold: [0, 0.01] });
            observer.observe(video);
        } else {
            view.addEventListener("scroll", measure, { passive: true });
            view.addEventListener("resize", measure);
            measure();
        }
        documentRef.addEventListener("visibilitychange", onVisibility);
        setupWalkingVideo.dispose = () => {
            observer?.disconnect();
            view.removeEventListener("scroll", measure);
            view.removeEventListener("resize", measure);
            documentRef.removeEventListener("visibilitychange", onVisibility);
            visible = false;
            pause();
        };
    }
    function wordSequenceTiming(wordCount) {
        const step = 300, appearance = 300, hold = 2000, fade = 600;
        const revealEnd = Math.max(1, wordCount) * step;
        const fadeStart = revealEnd + hold;
        const duration = fadeStart + fade;
        return { revealEnd, fadeStart, duration, keyframes: Array.from({ length: wordCount }, (_, index) => [
            { opacity: 0, offset: 0 },
            { opacity: 0, offset: index * step / duration, easing: "ease-in-out" },
            { opacity: 1, offset: (index * step + appearance) / duration },
            { opacity: 1, offset: fadeStart / duration, easing: "ease-in-out" },
            { opacity: 0, offset: 1 }
        ]) };
    }
    function setupTextAnimations(app, documentRef, view = documentRef.defaultView) {
        setupTextAnimations.dispose?.();
        const frames = Array.from(app.querySelectorAll(".ae-text-layer")).map(layer => layer.parentElement);
        const preference = view.matchMedia("(prefers-reduced-motion: reduce)");
        const visible = new Set();
        const sequences = new Map(frames.map(frame => {
            const words = Array.from(frame.querySelectorAll(".ae-word"));
            return [frame, { words, timing: wordSequenceTiming(words.length), animations: [] }];
        }));
        let observer;
        const fixed = frame => {
            const sequence = sequences.get(frame);
            sequence.animations.forEach(animation => animation.cancel());
            sequence.animations = [];
            frame.dataset.textAnimation = "fixed";
        };
        const pause = frame => {
            sequences.get(frame).animations.forEach(animation => animation.pause());
            frame.dataset.textAnimation = "paused";
        };
        const play = frame => {
            if (preference.matches || documentRef.hidden || !visible.has(frame)) return;
            const sequence = sequences.get(frame);
            sequence.animations.forEach(animation => animation.cancel());
            // One shared document timeline keeps every word's fade synchronized.
            // The full-text hold starts when the LAST word reaches opacity 1.
            const start = documentRef.timeline.currentTime;
            sequence.animations = sequence.words.map((word, index) => {
                const animation = word.animate(sequence.timing.keyframes[index], {
                    duration: sequence.timing.duration, iterations: Infinity, fill: "both"
                });
                animation.startTime = start;
                return animation;
            });
            frame.dataset.textAnimation = "playing";
        };
        const onVisibility = () => frames.forEach(frame => {
            if (preference.matches) fixed(frame);
            else if (documentRef.hidden) pause(frame);
            else play(frame);
        });
        const onPreference = () => frames.forEach(frame => {
            if (preference.matches) fixed(frame);
            else { pause(frame); play(frame); }
        });
        frames.forEach(fixed);
        if (typeof view.IntersectionObserver === "function" && frames.every(frame => sequences.get(frame).words.every(word => typeof word.animate === "function"))) {
            observer = new view.IntersectionObserver(entries => entries.forEach(entry => {
                const frame = entry.target;
                if (entry.isIntersecting && entry.intersectionRect.height > 0) {
                    if (!visible.has(frame)) { visible.add(frame); play(frame); }
                } else { visible.delete(frame); if (!preference.matches) pause(frame); }
            }), { threshold: [0, 0.01] });
            frames.forEach(frame => observer.observe(frame));
            preference.addEventListener("change", onPreference);
            documentRef.addEventListener("visibilitychange", onVisibility);
        }
        setupTextAnimations.dispose = () => {
            observer?.disconnect();
            preference.removeEventListener("change", onPreference);
            documentRef.removeEventListener("visibilitychange", onVisibility);
            frames.forEach(fixed);
        };
    }
    function startCover(app, documentRef, clock = documentRef.defaultView) {
        const video = app.querySelector("video");
        const pages = Array.from(app.querySelectorAll(".wedding-section"));
        const nav = app.querySelector(".ae-section-nav");
        const blocked = [nav, ...pages.slice(1)].filter(Boolean);
        const previousInert = blocked.map(element => element.inert);
        const body = documentRef.body;
        const root = documentRef.documentElement;
        const fallback = documentRef.createElement("div");
        fallback.className = "ae-cover-fallback";
        fallback.hidden = true;
        const message = documentRef.createElement("p");
        message.setAttribute("role", "status");
        message.textContent = "El video no pudo continuar. Podés seguir con la invitación.";
        const button = documentRef.createElement("button");
        button.type = "button";
        button.textContent = "Continuar con la invitación";
        fallback.append(message, button);
        pages[0].append(fallback);
        let finished = false, lastTime = 0, watchdog;
        const listeners = [];
        const listen = (type, handler) => {
            video.addEventListener(type, handler);
            listeners.push([type, handler]);
        };
        const offerContinuation = () => {
            if (!finished) fallback.hidden = false;
        };
        const armWatchdog = () => {
            clock.clearTimeout(watchdog);
            watchdog = clock.setTimeout(offerContinuation, 12000);
        };
        const finish = (advance = false) => {
            if (finished) return;
            finished = true;
            clock.clearTimeout(watchdog);
            listeners.forEach(([type, handler]) => video.removeEventListener(type, handler));
            const restoreFocus = fallback.contains(documentRef.activeElement);
            fallback.remove();
            blocked.forEach((element, index) => { element.inert = previousInert[index]; });
            body.classList.remove("ae-cover-locked");
            root.classList.remove("ae-cover-locked");
            if (advance) video.pause();
            if (advance || restoreFocus) pages[1]?.focus({ preventScroll: true });
            if (advance) pages[1]?.scrollIntoView({ behavior: "instant", block: "start" });
        };
        button.addEventListener("click", () => finish(true));
        blocked.forEach(element => { element.inert = true; });
        body.classList.add("ae-cover-locked");
        root.classList.add("ae-cover-locked");
        clock.scrollTo(0, 0);
        listen("ended", () => finish());
        ["error", "abort", "pause"].forEach(type => listen(type, offerContinuation));
        listen("timeupdate", () => {
            if (video.currentTime > lastTime) { lastTime = video.currentTime; armWatchdog(); }
        });
        armWatchdog();
        try {
            const request = video.play();
            if (request?.catch) request.catch(offerContinuation);
        } catch (_) { offerContinuation(); }
        if (video.error) offerContinuation();
        if (video.ended) finish();
    }
    function finishGifts(app) {
        const page = app.querySelector('[data-event-section="regalos"]');
        const dialog = app.querySelector(".demo-gift-dialog");
        const button = page?.querySelector(".demo-gift-open");
        if (!dialog || !button) throw new Error("Local gifts unavailable.");
        const holder = page.querySelector(".wedding-content > p");
        if (holder) dialog.querySelector("h3").after(holder);
        page.querySelector(".ae-artwork").append(overlay(button, "Ver CBU aquí (abre los datos para regalos)", "Ver CBU aquí", "gift"));
        page.querySelector(".wedding-content").remove();
    }
    return { isAuthorizedContext, getPresentationSections, apply, finishGifts, startCover, setupTextAnimations, setupWalkingVideo, layerDesigns, wordSequenceTiming };
});
