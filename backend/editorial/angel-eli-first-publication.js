'use strict';
const { sendAccessFailure } = require('../http/admin-access');
const { canonicalContentDigest } = require('../premium/canonical-content-digest');
const ID = 'angel-eli-boda';
const BEIGE = 'Elegante Sport. Se reserva el color beige para la novia.';
const RPC = 'publish_angel_eli_first_version';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
function createFirstPublicationHttp({ adminAccess, prepareBody, preparePremiumContent, rpc }) {
    return async function firstPublication(req, res) {
        let dispatched = false;
        try {
            const access = await adminAccess.authorize(req, { mutate: true,
                endpoint: 'POST /api/admin/angel-eli-boda/first-publication', action: 'PUBLISH_VERSION', originFirst: true });
            if (!access.ok) return sendAccessFailure(res, access);
            await prepareBody(req, res);
            const body = req.body;
            if (!body || Object.keys(body).some(k => !['eventId', 'content'].includes(k))
                || body.eventId !== ID || body.content?.id !== ID
                || body.content?.sections?.find(s => s.id === 'vestimenta')?.data?.description !== BEIGE) {
                return res.status(400).json({ error: { code: 'INVALID_REQUEST' } });
            }
            // Trusted existing service: private provider, complete Premium validation and
            // current revision check. Never accept a manifest or permission in HTTP input.
            const canonical = preparePremiumContent(ID, body.content);
            const digest = canonicalContentDigest(canonical);
            dispatched = true;
            const response = await rpc(RPC, { p_event_id: ID, p_content: canonical,
                p_admin_identity: 'shared-admin-credential', p_ip: null, p_origin: access.origin });
            if (response?.error) {
                const code = response.error.message;
                if (code === 'EVENT_ALREADY_EXISTS') return res.status(409).json({ error: { code } });
                // SQL failure is atomic, but a transport/receipt failure requires reconciliation.
                return res.status(503).json({ error: { code: 'PUBLICATION_RECONCILIATION_REQUIRED' } });
            }
            const row = Array.isArray(response?.data) && response.data.length === 1 ? response.data[0] : null;
            if (!row || row.event_id !== ID || !UUID.test(row.version_id || '')
                || row.published_version_id !== row.version_id || row.workflow_status !== 'approved'
                || row.version_number !== 1 || row.audit_count !== 4 || row.content_matches !== true) {
                return res.status(503).json({ error: { code: 'PUBLICATION_RECONCILIATION_REQUIRED' } });
            }
            // Existing immutable snapshot check; do not reclassify a completed write as
            // definitely rejected when a provider/configuration changes after dispatch.
            if (canonicalContentDigest(canonical) !== digest) throw Error('UNEXPECTED_CONTENT_CHANGE');
            return res.status(201).json({ eventId: ID, versionId: row.version_id,
                publishedVersionId: row.published_version_id, workflowStatus: 'approved',
                versionNumber: 1, auditCount: 4 });
        } catch (error) {
            const status = dispatched ? 503 : error?.code === 'PREMIUM_AUTHORIZATION_DENIED' ? 403
                : error?.code === 'PAYLOAD_TOO_LARGE' ? 413 : error?.code === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 400;
            const code = dispatched ? 'PUBLICATION_RECONCILIATION_REQUIRED'
                : error?.code === 'PREMIUM_AUTHORIZATION_DENIED' ? error.code : 'INVALID_REQUEST';
            return res.status(status).json({ error: { code } });
        }
    };
}
module.exports = { createFirstPublicationHttp };
