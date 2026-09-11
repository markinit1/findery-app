const { getDb } = require('./_lib/firebaseAdmin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return respond(405, { success: false, reason: 'method_not_allowed' });
  }

  const shareId = event.queryStringParameters && event.queryStringParameters.id;
  if (!shareId) {
    return respond(400, { success: false, reason: 'missing_id' });
  }

  try {
    const db = getDb();
    const snapshot = await db.collection('sharedListClaims').doc(shareId).collection('claims').get();

    const claims = {};
    snapshot.forEach(doc => {
      claims[doc.id] = !!doc.data().claimed;
    });

    return respond(200, { success: true, claims });
  } catch (err) {
    console.error('get-shared-list-claims error:', err);
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
