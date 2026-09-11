const { getDb, admin } = require('./_lib/firebaseAdmin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return respond(405, { success: false, reason: 'method_not_allowed' });
  }

  let shareId, itemId, claimed;
  try {
    const body = JSON.parse(event.body || '{}');
    shareId = body.shareId;
    itemId = body.itemId;
    claimed = !!body.claimed;
  } catch (e) {
    return respond(400, { success: false, reason: 'bad_request' });
  }

  if (!shareId || !itemId) {
    return respond(400, { success: false, reason: 'missing_fields' });
  }

  try {
    const db = getDb();

    // Confirm the shared list actually exists and this item belongs to it,
    // so this endpoint can't be used to write arbitrary claim records.
    const listDoc = await db.collection('sharedLists').doc(shareId).get();
    if (!listDoc.exists) {
      return respond(404, { success: false, reason: 'not_found' });
    }
    const itemIds = listDoc.data().itemIds || [];
    if (!itemIds.includes(itemId)) {
      return respond(400, { success: false, reason: 'item_not_in_list' });
    }

    await db.collection('sharedListClaims').doc(shareId).collection('claims').doc(itemId).set({
      claimed,
      claimedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return respond(200, { success: true });
  } catch (err) {
    console.error('toggle-claim error:', err);
    return respond(500, { success: false, reason: 'server_error' });
  }
};

function respond(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj)
  };
}
