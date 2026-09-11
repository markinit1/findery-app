const params = new URLSearchParams(window.location.search);
const shareId = params.get('id');

const shareListTitle = document.getElementById('share-list-title');
const shareLoading = document.getElementById('share-loading');
const shareError = document.getElementById('share-error');
const shareGrid = document.getElementById('share-grid');

let claimState = {};

async function init() {
  if (!shareId) {
    showError();
    return;
  }

  try {
    const [listRes, claimsRes] = await Promise.all([
      fetch(`/.netlify/functions/get-shared-list?id=${encodeURIComponent(shareId)}`),
      fetch(`/.netlify/functions/get-shared-list-claims?id=${encodeURIComponent(shareId)}`)
    ]);

    const listData = await listRes.json();
    const claimsData = await claimsRes.json();

    if (!listData.success) {
      showError();
      return;
    }

    claimState = claimsData.success ? claimsData.claims : {};
    render(listData.listName, listData.items);
  } catch (err) {
    console.error('Error loading shared list:', err);
    showError();
  }
}

function showError() {
  shareLoading.classList.add('hidden');
  shareError.classList.remove('hidden');
  shareListTitle.textContent = 'List not found';
}

function render(listName, items) {
  shareListTitle.textContent = listName;
  shareLoading.classList.add('hidden');

  if (!items.length) {
    shareError.textContent = 'This list is empty.';
    shareError.classList.remove('hidden');
    return;
  }

  shareGrid.innerHTML = '';
  items.forEach(item => shareGrid.appendChild(buildShareCard(item)));
  shareGrid.classList.remove('hidden');
}

function buildShareCard(item) {
  const card = document.createElement('div');
  card.className = 'share-card';

  const img = document.createElement('img');
  img.className = 'share-card-image';
  img.src = item.imageUrl || 'icons/icon-96.png';
  img.alt = item.name;
  img.onerror = () => { img.src = 'icons/icon-96.png'; };
  card.appendChild(img);

  const body = document.createElement('div');
  body.className = 'share-card-body';

  const name = document.createElement('p');
  name.className = 'share-card-name';
  name.textContent = item.name;
  body.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'share-card-meta';
  if (typeof item.price === 'number') {
    const price = document.createElement('span');
    price.className = 'share-card-price';
    price.textContent = `$${item.price.toFixed(2)}`;
    meta.appendChild(price);
  }
  if (item.store) {
    const store = document.createElement('span');
    store.className = 'share-card-store';
    store.textContent = item.store;
    meta.appendChild(store);
  }
  body.appendChild(meta);

  if (item.url) {
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'share-card-link';
    link.textContent = 'View item →';
    body.appendChild(link);
  }

  const claimBtn = document.createElement('button');
  claimBtn.className = 'claim-btn';
  const isClaimed = !!claimState[item.id];
  updateClaimBtn(claimBtn, isClaimed);
  claimBtn.addEventListener('click', () => toggleClaim(item.id, claimBtn));
  body.appendChild(claimBtn);

  card.appendChild(body);
  return card;
}

function updateClaimBtn(btn, claimed) {
  btn.textContent = claimed ? '✓ Claimed' : 'Mark as claimed';
  btn.classList.toggle('claimed', claimed);
}

async function toggleClaim(itemId, btn) {
  const newState = !btn.classList.contains('claimed');
  btn.disabled = true;

  try {
    const response = await fetch('/.netlify/functions/toggle-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId, itemId, claimed: newState })
    });
    const data = await response.json();
    if (data.success) {
      claimState[itemId] = newState;
      updateClaimBtn(btn, newState);
    }
  } catch (err) {
    console.error('Error toggling claim:', err);
  } finally {
    btn.disabled = false;
  }
}

init();
