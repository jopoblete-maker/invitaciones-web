(function (root, factory) {
    const editor = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = editor;
    }

    root.AdminEventEditor = editor;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const FIELD_DEFINITIONS = Object.freeze({
        heroTitle: Object.freeze({ label: "Titulo principal", maxLength: 120, required: true }),
        heroSubtitle: Object.freeze({ label: "Subtitulo", maxLength: 180 }),
        address: Object.freeze({ label: "Direccion", maxLength: 240 }),
        city: Object.freeze({ label: "Ciudad", maxLength: 120 }),
        closingTitle: Object.freeze({ label: "Titulo de cierre", maxLength: 160 }),
        closingMessage: Object.freeze({ label: "Mensaje de cierre", maxLength: 600 }),
        closingNames: Object.freeze({ label: "Nombres de cierre", maxLength: 180 })
    });

    class AdminEventEditorError extends Error {
        constructor(code, message) {
            super(message);
            this.name = "AdminEventEditorError";
            this.code = code;
        }
    }

    function isPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    function cleanString(value) {
        return typeof value === "string" ? value.trim() : null;
    }

    function field(value = "", options = {}) {
        return {
            value,
            blocked: Boolean(options.blocked),
            reason: options.reason || "",
            bindings: options.bindings || []
        };
    }

    function blockedField(reason) {
        return field("", { blocked: true, reason });
    }

    function sectionsOfType(content, type) {
        return content.sections.filter((section) => isPlainObject(section) && section.type === type);
    }

    function uniqueVisibleSection(content, type) {
        const matches = sectionsOfType(content, type);
        if (matches.length !== 1) {
            return { error: matches.length > 1 ? `Hay secciones ${type} duplicadas.` : `Falta la seccion ${type}.` };
        }
        const section = matches[0];
        if (typeof section.id !== "string" || !section.id.trim() || section.enabled === false || !isPlainObject(section.data)) {
            return { error: `La seccion ${type} no tiene una estructura editable.` };
        }
        return { section, id: section.id };
    }

    function resolveSynchronizedValue(values, fieldLabel) {
        if (values.some((value) => value !== undefined && cleanString(value) === null)) {
            return { error: `${fieldLabel} contiene un valor que no es texto.` };
        }
        const populated = values
            .map((value) => cleanString(value))
            .filter((value) => value);
        if (new Set(populated).size > 1) {
            return { error: `${fieldLabel} tiene copias no sincronizadas.` };
        }
        return { value: populated[0] || "" };
    }

    function sectionBinding(section, key) {
        return { kind: "section", sectionId: section.id, sectionType: section.type, key };
    }

    function buildHeroField(content, hero, key, canonicalKey, label) {
        if (hero.error) return blockedField(hero.error);
        if (!isPlainObject(content.identity)) return blockedField("identity no tiene una estructura editable.");
        const resolved = resolveSynchronizedValue(
            [hero.section.data[key], content.identity[canonicalKey]],
            label
        );
        if (resolved.error) return blockedField(resolved.error);
        return field(resolved.value, {
            bindings: [
                sectionBinding(hero.section, key),
                { kind: "root", object: "identity", key: canonicalKey }
            ]
        });
    }

    function buildLocationField(content, key, label) {
        const eventInfo = sectionsOfType(content, "event-info");
        const locationSections = sectionsOfType(content, "location");
        if (eventInfo.length > 1 || locationSections.length > 1) {
            return blockedField(`Hay secciones duplicadas para ${label}.`);
        }
        const sections = [...eventInfo, ...locationSections];
        if (sections.length === 0) return blockedField(`No hay una seccion visible para ${label}.`);
        if (sections.some((section) => typeof section.id !== "string" || !section.id.trim()
            || section.enabled === false || !isPlainObject(section.data))) {
            return blockedField(`La estructura de ${label} no es editable.`);
        }
        if (content.location !== undefined && !isPlainObject(content.location)) {
            return blockedField("location no tiene una estructura editable.");
        }
        const location = content.location || {};
        const resolved = resolveSynchronizedValue(
            [location[key], ...sections.map((section) => section.data[key])],
            label
        );
        if (resolved.error) return blockedField(resolved.error);
        return field(resolved.value, {
            bindings: [
                { kind: "root", object: "location", key },
                ...sections.map((section) => sectionBinding(section, key))
            ]
        });
    }

    function buildClosingField(closing, key, label) {
        if (closing.error) return blockedField(closing.error);
        const resolved = resolveSynchronizedValue([closing.section.data[key]], label);
        if (resolved.error) return blockedField(resolved.error);
        return field(resolved.value, { bindings: [sectionBinding(closing.section, key)] });
    }

    function createEditorModel({ editorialState, version } = {}) {
        const eligible = Boolean(editorialState && version
            && typeof editorialState.currentWorkingVersionId === "string"
            && version.eventId === editorialState.eventId
            && version.versionId === editorialState.currentWorkingVersionId
            && version.workflowStatus === "draft"
            && isPlainObject(version.content)
            && version.content.schema_version === 2);
        if (!eligible) {
            return { eligible: false, reason: "La version no es un draft V2 de trabajo vigente.", fields: {} };
        }

        const content = version.content;
        if (!Array.isArray(content.sections)) {
            return { eligible: false, reason: "El snapshot V2 no contiene secciones editables.", fields: {} };
        }
        const hero = uniqueVisibleSection(content, "hero");
        const closing = uniqueVisibleSection(content, "closing");
        return {
            eligible: true,
            eventId: version.eventId,
            versionId: version.versionId,
            versionNumber: version.versionNumber,
            content,
            fields: {
                heroTitle: buildHeroField(content, hero, "title", "title", "Titulo principal"),
                heroSubtitle: buildHeroField(content, hero, "subtitle", "subtitle", "Subtitulo"),
                address: buildLocationField(content, "address", "Direccion"),
                city: buildLocationField(content, "city", "Ciudad"),
                closingTitle: buildClosingField(closing, "title", "Titulo de cierre"),
                closingMessage: buildClosingField(closing, "message", "Mensaje de cierre"),
                closingNames: buildClosingField(closing, "names", "Nombres de cierre")
            }
        };
    }

    function deepCloneSnapshot(content) {
        if (typeof structuredClone === "function") return structuredClone(content);
        return JSON.parse(JSON.stringify(content));
    }

    function findBoundSection(content, binding) {
        const matches = content.sections.filter((section) => isPlainObject(section)
            && section.id === binding.sectionId && section.type === binding.sectionType);
        if (matches.length !== 1 || !isPlainObject(matches[0].data)) {
            throw new AdminEventEditorError("AMBIGUOUS_STRUCTURE", "La estructura de secciones cambio.");
        }
        return matches[0];
    }

    function setBinding(content, binding, value) {
        if (binding.kind === "section") {
            findBoundSection(content, binding).data[binding.key] = value;
            return;
        }
        if (binding.kind === "root") {
            if (content[binding.object] === undefined && binding.object === "location") content.location = {};
            if (!isPlainObject(content[binding.object])) {
                throw new AdminEventEditorError("AMBIGUOUS_STRUCTURE", `${binding.object} no es editable.`);
            }
            content[binding.object][binding.key] = value;
        }
    }

    function applyEdits(model, values) {
        if (!model?.eligible || !isPlainObject(values)) {
            throw new AdminEventEditorError("EDITOR_UNAVAILABLE", "El editor no esta disponible para esta version.");
        }
        const content = deepCloneSnapshot(model.content);
        const changedFields = [];

        Object.entries(FIELD_DEFINITIONS).forEach(([name, definition]) => {
            const current = model.fields[name];
            if (!current || current.blocked) {
                if (Object.prototype.hasOwnProperty.call(values, name)) {
                    throw new AdminEventEditorError("FIELD_BLOCKED", `${definition.label} esta bloqueado.`);
                }
                return;
            }
            if (typeof values[name] !== "string") {
                throw new AdminEventEditorError("INVALID_FIELD", `${definition.label} debe ser texto.`);
            }
            const value = values[name].trim();
            if (definition.required && !value) {
                throw new AdminEventEditorError("INVALID_FIELD", `${definition.label} es obligatorio.`);
            }
            if (value.length > definition.maxLength) {
                throw new AdminEventEditorError("INVALID_FIELD", `${definition.label} supera ${definition.maxLength} caracteres.`);
            }
            if (value === current.value) return;
            current.bindings.forEach((binding) => setBinding(content, binding, value));
            changedFields.push(name);
        });

        if (changedFields.length === 0) {
            throw new AdminEventEditorError("NO_CHANGES", "No hay cambios efectivos para guardar.");
        }
        return { content, changedFields };
    }

    function currentDraftMetadata(state, versionId) {
        return state?.versions?.find((version) => version.versionId === versionId) || null;
    }

    function sameDraftState(observed, current, versionId) {
        const observedVersion = currentDraftMetadata(observed, versionId);
        const currentVersion = currentDraftMetadata(current, versionId);
        return Boolean(observed && current
            && observed.eventId === current.eventId
            && observed.eventStatus === current.eventStatus
            && observed.currentWorkingVersionId === versionId
            && current.currentWorkingVersionId === versionId
            && observed.publishedVersionId === current.publishedVersionId
            && observedVersion?.workflowStatus === "draft"
            && currentVersion?.workflowStatus === "draft");
    }

    function createDraftSaveRunner({ client, confirmSave } = {}) {
        if (!client || typeof client.getEditorialState !== "function" || typeof client.createVersion !== "function") {
            throw new TypeError("client must implement the draft-save contract.");
        }
        if (typeof confirmSave !== "function") throw new TypeError("confirmSave must be a function.");
        let pending = false;
        const recoveryEventIds = new Set();

        async function refreshAfterConflict(error, eventId, password) {
            try {
                const state = await client.getEditorialState({ eventId, password });
                return { outcome: "conflict", state, error };
            } catch (refreshError) {
                return { outcome: "conflict-refresh-failed", error, refreshError };
            }
        }

        async function run({ observedState, sourceVersion, content, password, isCurrent = () => true } = {}) {
            if (pending) return { outcome: "busy" };
            const eventId = observedState?.eventId;
            const sourceVersionId = sourceVersion?.versionId;
            if (!eventId || !sourceVersionId || !isPlainObject(content)
                || sourceVersion?.eventId !== eventId
                || sourceVersionId !== observedState.currentWorkingVersionId
                || sourceVersion?.workflowStatus !== "draft"
                || sourceVersion?.content?.schema_version !== 2
                || content.schema_version !== 2) return { outcome: "unavailable" };
            if (recoveryEventIds.has(eventId)) return { outcome: "refresh-required" };
            pending = true;
            try {
                const stateBeforeConfirmation = await client.getEditorialState({ eventId, password });
                if (!isCurrent()) return { outcome: "stale-view" };
                if (!sameDraftState(observedState, stateBeforeConfirmation, sourceVersionId)) {
                    return { outcome: "stale", state: stateBeforeConfirmation };
                }
                const confirmed = await confirmSave({
                    eventId,
                    sourceVersionId,
                    sourceVersionNumber: sourceVersion.versionNumber
                });
                if (!confirmed) return { outcome: "cancelled", state: stateBeforeConfirmation };
                if (!isCurrent()) return { outcome: "stale-view" };

                const stateBeforePost = await client.getEditorialState({ eventId, password });
                if (!isCurrent()) return { outcome: "stale-view" };
                if (!sameDraftState(observedState, stateBeforePost, sourceVersionId)) {
                    return { outcome: "stale", state: stateBeforePost };
                }

                let created;
                try {
                    created = await client.createVersion({
                        eventId,
                        content,
                        sourceVersionId,
                        expectedWorkingVersionId: sourceVersionId,
                        password
                    });
                } catch (error) {
                    if (error?.status === 409) return await refreshAfterConflict(error, eventId, password);
                    if (error?.status === undefined
                        && (error?.code === "NETWORK_ERROR" || error?.code === "INVALID_RESPONSE")) {
                        recoveryEventIds.add(eventId);
                        return { outcome: "mutation-unknown", error, sourceVersionId };
                    }
                    throw error;
                }

                try {
                    const state = await client.getEditorialState({ eventId, password });
                    return { outcome: "success", state, created, sourceVersionId };
                } catch (refreshError) {
                    recoveryEventIds.add(eventId);
                    return { outcome: "accepted-refresh-failed", created, sourceVersionId, refreshError };
                }
            } finally {
                pending = false;
            }
        }

        async function refresh({ eventId, password, isCurrent = () => true } = {}) {
            const state = await client.getEditorialState({ eventId, password });
            if (isCurrent()) recoveryEventIds.delete(eventId);
            return state;
        }

        return {
            run,
            refresh,
            isPending: () => pending,
            requiresRefresh: (eventId) => recoveryEventIds.has(eventId)
        };
    }

    return {
        AdminEventEditorError,
        FIELD_DEFINITIONS,
        applyEdits,
        createDraftSaveRunner,
        createEditorModel
    };
});
