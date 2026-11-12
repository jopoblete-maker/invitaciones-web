'use strict';
const { sendAccessFailure } = require('../http/admin-access');
const ID = 'angel-eli-boda', RPC = 'publish_angel_eli_approved_revision';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
function createApprovedRevisionHttp({ adminAccess, prepareBody, preparePremiumContent, rpc }) {
    return async function approvedRevision(req, res) {
        let dispatched = false;
        try {
            const access = await adminAccess.authorize(req, { mutate: true,
                endpoint: 'POST /api/admin/angel-eli-boda/approved-revision', action: 'PUBLISH_VERSION', originFirst: true });
            if (!access.ok) return sendAccessFailure(res, access);
            await prepareBody(req, res);
            const body = req.body;
            if (!body || Object.keys(body).some(key => !['eventId', 'content', 'expectedPublishedVersionId'].includes(key))
                || body.eventId !== ID || body.content?.id !== ID) {
                return res.status(400).json({ error: { code: 'INVALID_REQUEST' } });
            }
            if (!Object.hasOwn(body, 'expectedPublishedVersionId')) return res.status(428).json({ error: { code: 'PRECONDITION_REQUIRED' } });
            if (!UUID.test(body.expectedPublishedVersionId || '')) return res.status(400).json({ error: { code: 'INVALID_REQUEST' } });
            const canonical = preparePremiumContent(ID, body.content);
            dispatched = true;
            const result = await rpc(RPC, { p_event_id: ID, p_content: canonical,
                p_expected_published_version_id: body.expectedPublishedVersionId,
                p_admin_identity: 'shared-admin-credential', p_ip: null, p_origin: access.origin });
            if (result?.error) {
                const code = result.error.message;
                if (['VERSION_CONFLICT', 'WORKING_VERSION_CONFLICT', 'REVISION_ALREADY_APPLIED', 'EVENT_ARCHIVED'].includes(code)) {
                    return res.status(409).json({ error: { code } });
                }
                return res.status(503).json({ error: { code: 'PUBLICATION_RECONCILIATION_REQUIRED' } });
            }
            const row = Array.isArray(result?.data) && result.data.length === 1 ? result.data[0] : null;
            if (!row || row.event_id !== ID || !UUID.test(row.version_id || '') || row.version_id === body.expectedPublishedVersionId
                || row.previous_version_id !== body.expectedPublishedVersionId || row.published_version_id !== row.version_id
                || row.workflow_status !== 'approved' || !Number.isSafeInteger(row.version_number) || row.version_number < 2
                || row.audit_count !== 4 || row.content_matches !== true) {
                return res.status(503).json({ error: { code: 'PUBLICATION_RECONCILIATION_REQUIRED' } });
            }
            return res.status(201).json({ eventId: ID, versionId: row.version_id, previousVersionId: row.previous_version_id,
                publishedVersionId: row.published_version_id, workflowStatus: 'approved', versionNumber: row.version_number, auditCount: 4 });
        } catch (error) {
            const code = !dispatched && error?.code === 'PREMIUM_AUTHORIZATION_DENIED' ? error.code
                : dispatched ? 'PUBLICATION_RECONCILIATION_REQUIRED' : 'INVALID_REQUEST';
            return res.status(dispatched ? 503 : code === 'PREMIUM_AUTHORIZATION_DENIED' ? 403 : 400).json({ error: { code } });
        }
    };
}
module.exports = { createApprovedRevisionHttp };
