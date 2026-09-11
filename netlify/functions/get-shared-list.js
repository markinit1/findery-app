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

    const listDoc = await db.collection('sharedLists').doc(shareId).get();
    if (!listDoc.exists) {
      return respond(404, { success: false, reason: 'not_found' });
    }

    const listData = listDoc.data();
    const ownerId = listData.ownerId;
    const itemIds = Array.isArray(listData.itemIds) ? listData.itemIds : [];

    const itemDocs = await Promise.all(
      itemIds.map(itemId =>
        db.collection('users').doc(ownerId).collection('items').doc(itemId).get()
      )
    );

    const items = itemDocs
      .filter(doc => doc.exists)
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Untitled find',
          price: typeof data.price === 'number' ? data.price : null,
          imageUrl: data.imageUrl || null,
          url: data.url || null,
          store: data.store || null
        };
      });

    return respond(200, {
      success: true,
      listName: listData.name || 'Wishlist',
      items
    });
  } catch (err) {
    console.error('get-shared-list error:', err);
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
