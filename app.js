// ===== Firebase config =====
const firebaseConfig = {
  apiKey: "AIzaSyA2q3pgL0w4pzzbSG36VV9p-uE_WDnlBEI",
  authDomain: "findery-app.firebaseapp.com",
  projectId: "findery-app",
  storageBucket: "findery-app.firebasestorage.app",
  messagingSenderId: "131613744643",
  appId: "1:131613744643:web:186db4c75ced7199e33836"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const DEFAULT_CATEGORIES = ["Clothing", "Hunting", "RVing"];

// ===== Element refs =====
const splash = document.getElementById('splash');
const authScreen = document.getElementById('auth-screen');
const appShell = document.getElementById('app-shell');

const authForm = document.getElementById('auth-form');
const authSub = document.getElementById('auth-sub');
const authError = document.getElementById('auth-error');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const categoryRail = document.getElementById('category-rail');
const logoutBtn = document.getElementById('logout-btn');
const shareListsBtn = document.getElementById('share-lists-btn');

const sharedListsModal = document.getElementById('shared-lists-modal');
const sharePanelList = document.getElementById('share-panel-list');
const sharePanelCreate = document.getElementById('share-panel-create');
const sharePanelResult = document.getElementById('share-panel-result');
const sharedListsUl = document.getElementById('shared-lists-ul');
const sharedListsEmpty = document.getElementById('shared-lists-empty');
const sharePanelListClose = document.getElementById('share-panel-list-close');
const shareNewBtn = document.getElementById('share-new-btn');
const shareListNameInput = document.getElementById('share-list-name');
const shareItemChecklist = document.getElementById('share-item-checklist');
const shareCreateCancel = document.getElementById('share-create-cancel');
const shareCreateConfirm = document.getElementById('share-create-confirm');
const shareResultLink = document.getElementById('share-result-link');
const shareCopyLinkBtn = document.getElementById('share-copy-link-btn');
const shareResultDone = document.getElementById('share-result-done');

const emptyState = document.getElementById('empty-state');
const emptyHeading = document.getElementById('empty-heading');
const emptySub = document.getElementById('empty-sub');
const emptyAddBtn = document.getElementById('empty-add-btn');
const itemGrid = document.getElementById('item-grid');
const fabAdd = document.getElementById('fab-add');

const sortSelect = document.getElementById('sort-select');
const storeSelect = document.getElementById('store-select');

const priceHistorySection = document.getElementById('price-history-section');
const priceHistoryChart = document.getElementById('price-history-chart');
const priceHistoryList = document.getElementById('price-history-list');

const categoryModal = document.getElementById('category-modal');
const newCategoryInput = document.getElementById('new-category-input');
const categoryCancel = document.getElementById('category-cancel');
const categorySave = document.getElementById('category-save');

const itemModal = document.getElementById('item-modal');
const itemModalHeading = document.getElementById('item-modal-heading');
const priceCheckStatus = document.getElementById('price-check-status');
const checkPriceNowBtn = document.getElementById('check-price-now-btn');
const itemForm = document.getElementById('item-form');
const itemNameInput = document.getElementById('item-name');
const itemPriceInput = document.getElementById('item-price');
const itemStoreInput = document.getElementById('item-store');
const itemUrlInput = document.getElementById('item-url');
const itemImageInput = document.getElementById('item-image');
const itemCategorySelect = document.getElementById('item-category');
const itemNotesInput = document.getElementById('item-notes');
const itemCancelBtn = document.getElementById('item-cancel');
const itemDeleteBtn = document.getElementById('item-delete-btn');
const itemSaveBtn = document.getElementById('item-save-btn');

const photoUploadBtn = document.getElementById('photo-upload-btn');
const photoFileInput = document.getElementById('photo-file-input');
const imagePreviewWrap = document.getElementById('image-preview-wrap');
const imagePreview = document.getElementById('image-preview');
const imageRemoveBtn = document.getElementById('image-remove-btn');

const parseUrlInput = document.getElementById('parse-url-input');
const parseUrlBtn = document.getElementById('parse-url-btn');
const parseStatus = document.getElementById('parse-status');

let isSignupMode = false;
let currentUser = null;
let userCategories = [];
let activeCategory = 'All';
let sortOrder = 'newest';
let storeFilter = 'All';
let allItems = [];
let editingItemId = null;
let itemsUnsubscribe = null;

// ===== Splash =====
// Splash auto-hides via CSS animation; also force-hide after timeout as a safety net.
setTimeout(() => splash.classList.add('hidden'), 2600);

// ===== Auth mode toggle =====
authToggle.addEventListener('click', () => {
  isSignupMode = !isSignupMode;
  authError.classList.add('hidden');
  if (isSignupMode) {
    authSub.textContent = "Start your collection";
    authSubmit.textContent = "Create account";
    authToggle.innerHTML = 'Already have an account? <span>Sign in</span>';
  } else {
    authSub.textContent = "Sign in to your collection";
    authSubmit.textContent = "Sign in";
    authToggle.innerHTML = "Don't have an account? <span>Create one</span>";
  }
});

// ===== Auth submit =====
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  authSubmit.disabled = true;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    if (isSignupMode) {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(cred.user.uid).set({
        email,
        categories: DEFAULT_CATEGORIES,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
  } catch (err) {
    authError.textContent = friendlyAuthError(err.code);
    authError.classList.remove('hidden');
  } finally {
    authSubmit.disabled = false;
  }
});

function friendlyAuthError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return "That email's already registered. Try signing in instead.";
    case 'auth/invalid-email': return "That email address doesn't look right.";
    case 'auth/weak-password': return "Password should be at least 6 characters.";
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential': return "Incorrect email or password.";
    default: return "Something went wrong. Please try again.";
  }
}

// ===== Logout =====
logoutBtn.addEventListener('click', () => auth.signOut());

// ===== Auth state observer =====
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    authScreen.classList.add('hidden');
    appShell.classList.remove('hidden');
    await loadUserCategories();
    startItemsListener();
  } else {
    appShell.classList.add('hidden');
    authScreen.classList.remove('hidden');
    if (itemsUnsubscribe) { itemsUnsubscribe(); itemsUnsubscribe = null; }
    allItems = [];
  }
});

// ===== Categories =====
async function loadUserCategories() {
  const docRef = db.collection('users').doc(currentUser.uid);
  const doc = await docRef.get();

  if (doc.exists && doc.data().categories) {
    userCategories = doc.data().categories;
  } else {
    // Backfill for any user doc missing categories
    userCategories = DEFAULT_CATEGORIES;
    await docRef.set({ categories: userCategories }, { merge: true });
  }

  activeCategory = 'All';
  renderCategoryRail();
  renderMain();
}

function renderCategoryRail() {
  categoryRail.innerHTML = '';

  const allChip = makeChip('All', activeCategory === 'All', false);
  categoryRail.appendChild(allChip);

  userCategories.forEach(cat => {
    categoryRail.appendChild(makeChip(cat, activeCategory === cat, true));
  });

  const addChip = document.createElement('button');
  addChip.className = 'category-chip add-chip';
  addChip.textContent = '+ Category';
  addChip.addEventListener('click', () => openCategoryModal());
  categoryRail.appendChild(addChip);

  populateCategorySelect();
}

function populateCategorySelect() {
  itemCategorySelect.innerHTML = '';
  userCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    itemCategorySelect.appendChild(opt);
  });
}

function makeChip(label, isActive, deletable) {
  const wrap = document.createElement('div');
  wrap.className = 'category-chip-wrap';

  const chip = document.createElement('button');
  chip.className = 'category-chip' + (isActive ? ' active' : '') + (deletable ? ' has-delete' : '');
  chip.textContent = label;
  chip.addEventListener('click', () => {
    activeCategory = label;
    renderCategoryRail();
    renderMain();
  });
  wrap.appendChild(chip);

  if (deletable) {
    const del = document.createElement('button');
    del.className = 'category-chip-delete';
    del.innerHTML = '×';
    del.setAttribute('aria-label', `Delete ${label} category`);
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCategory(label);
    });
    wrap.appendChild(del);
  }

  return wrap;
}

async function deleteCategory(name) {
  const affected = allItems.filter(item => item.category === name);

  const confirmMsg = affected.length
    ? `"${name}" has ${affected.length} find${affected.length === 1 ? '' : 's'} in it. Delete the category and move ${affected.length === 1 ? 'it' : 'them'} to "Uncategorized"?`
    : `Delete the "${name}" category?`;

  if (!confirm(confirmMsg)) return;

  const newCategories = userCategories.filter(c => c !== name);
  if (affected.length && !newCategories.includes('Uncategorized')) {
    newCategories.push('Uncategorized');
  }

  try {
    await db.collection('users').doc(currentUser.uid).set(
      { categories: newCategories },
      { merge: true }
    );

    if (affected.length) {
      const batch = db.batch();
      const itemsRef = db.collection('users').doc(currentUser.uid).collection('items');
      affected.forEach(item => {
        batch.update(itemsRef.doc(item.id), { category: 'Uncategorized' });
      });
      await batch.commit();
    }

    userCategories = newCategories;
    if (activeCategory === name) activeCategory = 'All';

    renderCategoryRail();
    renderMain();
  } catch (err) {
    console.error('Error deleting category:', err);
    alert("Couldn't delete that category. Please try again.");
  }
}

// ===== Items: live Firestore listener =====
function startItemsListener() {
  if (itemsUnsubscribe) itemsUnsubscribe();

  itemsUnsubscribe = db.collection('users').doc(currentUser.uid)
    .collection('items')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderMain();
    }, (err) => {
      console.error('Items listener error:', err);
    });
}

// ===== Main content: items grid or empty state =====
function getMillis(ts) {
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
}

function populateStoreSelect() {
  const stores = Array.from(new Set(
    allItems.map(item => (item.store || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  const previousValue = storeSelect.value || 'All';
  storeSelect.innerHTML = '<option value="All">All stores</option>';
  stores.forEach(store => {
    const opt = document.createElement('option');
    opt.value = store;
    opt.textContent = store;
    storeSelect.appendChild(opt);
  });
  // Keep the previous selection if it's still a valid option; otherwise reset to All.
  storeSelect.value = stores.includes(previousValue) || previousValue === 'All' ? previousValue : 'All';
  storeFilter = storeSelect.value;
}

function renderMain() {
  populateStoreSelect();

  let filtered = activeCategory === 'All'
    ? allItems
    : allItems.filter(item => item.category === activeCategory);

  if (storeFilter !== 'All') {
    filtered = filtered.filter(item => (item.store || '').trim() === storeFilter);
  }

  // Keep active (unpurchased) finds up top; purchased ones settle to the bottom.
  // Within each group, apply whichever sort the person picked.
  const sorted = [...filtered].sort((a, b) => {
    if (!!a.purchased !== !!b.purchased) return a.purchased ? 1 : -1;

    switch (sortOrder) {
      case 'oldest':
        return getMillis(a.createdAt) - getMillis(b.createdAt);
      case 'price-asc': {
        const ap = typeof a.price === 'number' ? a.price : Infinity;
        const bp = typeof b.price === 'number' ? b.price : Infinity;
        return ap - bp;
      }
      case 'price-desc': {
        const ap = typeof a.price === 'number' ? a.price : -Infinity;
        const bp = typeof b.price === 'number' ? b.price : -Infinity;
        return bp - ap;
      }
      case 'newest':
      default:
        return getMillis(b.createdAt) - getMillis(a.createdAt);
    }
  });

  if (sorted.length === 0) {
    itemGrid.classList.add('hidden');
    emptyState.classList.remove('hidden');

    if (activeCategory === 'All' && storeFilter === 'All') {
      emptyHeading.textContent = 'Nothing here yet';
      emptySub.textContent = "Things you spot out in the world will show up here.";
    } else {
      emptyHeading.textContent = 'No finds match this view';
      emptySub.textContent = 'Try a different category or store filter.';
    }
    return;
  }

  emptyState.classList.add('hidden');
  itemGrid.classList.remove('hidden');
  itemGrid.innerHTML = '';

  sorted.forEach(item => itemGrid.appendChild(buildItemCard(item)));
}

sortSelect.addEventListener('change', () => {
  sortOrder = sortSelect.value;
  renderMain();
});

storeSelect.addEventListener('change', () => {
  storeFilter = storeSelect.value;
  renderMain();
});

function buildItemCard(item) {
  const card = document.createElement('div');
  card.className = 'item-card' + (item.purchased ? ' purchased' : '');
  card.addEventListener('click', () => openItemModal(item));

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'item-card-media';

  if (item.imageUrl) {
    const img = document.createElement('img');
    img.className = 'item-card-image';
    img.src = item.imageUrl;
    img.alt = item.name;
    img.onerror = () => { img.replaceWith(buildImagePlaceholder()); };
    mediaWrap.appendChild(img);
  } else {
    mediaWrap.appendChild(buildImagePlaceholder());
  }

  // Purchased checkbox badge (top-left)
  const checkBadge = document.createElement('button');
  checkBadge.className = 'item-check-badge' + (item.purchased ? ' checked' : '');
  checkBadge.setAttribute('aria-label', item.purchased ? 'Mark as not purchased' : 'Mark as purchased');
  checkBadge.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  checkBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePurchased(item);
  });
  mediaWrap.appendChild(checkBadge);

  // Open-link badge (top-right), only if a product link was saved
  if (item.url) {
    const linkBadge = document.createElement('a');
    linkBadge.className = 'item-link-badge';
    linkBadge.href = item.url;
    linkBadge.target = '_blank';
    linkBadge.rel = 'noopener noreferrer';
    linkBadge.setAttribute('aria-label', 'Open product link');
    linkBadge.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    linkBadge.addEventListener('click', (e) => e.stopPropagation());
    mediaWrap.appendChild(linkBadge);
  }

  card.appendChild(mediaWrap);

  const body = document.createElement('div');
  body.className = 'item-card-body';

  const name = document.createElement('p');
  name.className = 'item-card-name';
  name.textContent = item.name;
  body.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'item-card-meta';

  const priceRow = document.createElement('div');
  priceRow.className = 'item-card-price-row';

  const price = document.createElement('span');
  price.className = 'item-card-price';
  price.textContent = (item.price !== null && item.price !== undefined && item.price !== '')
    ? `$${Number(item.price).toFixed(2)}`
    : '';
  priceRow.appendChild(price);

  if (typeof item.previousPrice === 'number' && typeof item.price === 'number' && item.previousPrice > item.price) {
    const dropBadge = document.createElement('span');
    dropBadge.className = 'price-drop-badge';
    dropBadge.textContent = `↓ was $${item.previousPrice.toFixed(2)}`;
    priceRow.appendChild(dropBadge);
  }

  meta.appendChild(priceRow);

  if (item.store) {
    const store = document.createElement('span');
    store.className = 'item-card-store';
    store.textContent = item.store;
    meta.appendChild(store);
  }

  body.appendChild(meta);
  card.appendChild(body);
  return card;
}

async function loadPriceHistory(itemId) {
  priceHistorySection.classList.add('hidden');
  priceHistoryChart.innerHTML = '';
  priceHistoryList.innerHTML = '';

  try {
    const snapshot = await db.collection('users').doc(currentUser.uid)
      .collection('items').doc(itemId)
      .collection('priceHistory')
      .orderBy('checkedAt', 'asc')
      .get();

    if (snapshot.empty) return;

    const entries = snapshot.docs.map(doc => doc.data());

    renderPriceSparkline(entries);
    renderPriceHistoryList(entries);
    priceHistorySection.classList.remove('hidden');
  } catch (err) {
    console.error('Error loading price history:', err);
  }
}

checkPriceNowBtn.addEventListener('click', async () => {
  if (!editingItemId) return;
  const url = itemUrlInput.value.trim();
  if (!url) return;

  checkPriceNowBtn.disabled = true;
  checkPriceNowBtn.textContent = 'Checking…';

  try {
    const response = await fetch('/.netlify/functions/parse-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await response.json();

    const itemRef = db.collection('users').doc(currentUser.uid).collection('items').doc(editingItemId);
    const currentItem = allItems.find(i => i.id === editingItemId) || {};
    const now = firebase.firestore.FieldValue.serverTimestamp();

    if (data.success && typeof data.price === 'number') {
      const newPrice = data.price;
      const currentPrice = currentItem.price;
      const changed = typeof currentPrice !== 'number' || newPrice !== currentPrice;

      if (changed) {
        await itemRef.collection('priceHistory').add({
          price: newPrice,
          previousPrice: typeof currentPrice === 'number' ? currentPrice : null,
          checkedAt: now
        });
        await itemRef.update({
          price: newPrice,
          previousPrice: typeof currentPrice === 'number' ? currentPrice : null,
          priceCheckedAt: now
        });
        itemPriceInput.value = newPrice;
        checkPriceNowBtn.textContent = changed && currentPrice != null && newPrice < currentPrice
          ? 'Price dropped — updated!'
          : 'Updated';
      } else {
        await itemRef.update({ priceCheckedAt: now });
        checkPriceNowBtn.textContent = 'No change';
      }

      // Reflect the fresh data immediately, without waiting on the live listener.
      updatePriceCheckStatus({ ...currentItem, price: newPrice, previousPrice: currentItem.price, priceCheckedAt: { toDate: () => new Date() } });
      loadPriceHistory(editingItemId);
    } else {
      await itemRef.update({ priceCheckedAt: now });
      checkPriceNowBtn.textContent = "Couldn't find a price";
    }
  } catch (err) {
    console.error('Manual price check error:', err);
    checkPriceNowBtn.textContent = 'Check failed — try again';
  } finally {
    setTimeout(() => {
      checkPriceNowBtn.disabled = false;
      checkPriceNowBtn.textContent = 'Check price now';
    }, 2200);
  }
});

function renderPriceSparkline(entries) {
  const prices = entries.map(e => e.price).filter(p => typeof p === 'number');
  if (prices.length < 2) {
    priceHistoryChart.innerHTML = '';
    return;
  }

  const width = 280;
  const height = 50;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  priceHistoryChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="#B8860B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function renderPriceHistoryList(entries) {
  priceHistoryList.innerHTML = '';

  // Newest first for the readable list, even though the chart reads left-to-right chronologically.
  [...entries].reverse().forEach(entry => {
    const li = document.createElement('li');

    const dateSpan = document.createElement('span');
    dateSpan.className = 'ph-date';
    const date = entry.checkedAt && entry.checkedAt.toDate ? entry.checkedAt.toDate() : null;
    dateSpan.textContent = date ? formatRelativeDate(date) : '';

    const priceSpan = document.createElement('span');
    const price = typeof entry.price === 'number' ? entry.price : null;
    const prev = typeof entry.previousPrice === 'number' ? entry.previousPrice : null;

    if (price !== null && prev !== null && price !== prev) {
      priceSpan.className = price < prev ? 'ph-down' : 'ph-up';
      priceSpan.textContent = `$${price.toFixed(2)} (${price < prev ? '↓' : '↑'} from $${prev.toFixed(2)})`;
    } else if (price !== null) {
      priceSpan.textContent = `$${price.toFixed(2)}`;
    }

    li.appendChild(dateSpan);
    li.appendChild(priceSpan);
    priceHistoryList.appendChild(li);
  });
}

async function togglePurchased(item) {
  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('items').doc(item.id)
      .update({ purchased: !item.purchased });
  } catch (err) {
    console.error('Error toggling purchased:', err);
  }
}

function buildImagePlaceholder() {
  const wrap = document.createElement('div');
  wrap.className = 'item-card-image-placeholder';
  const img = document.createElement('img');
  img.src = 'icons/icon-96.png';
  img.alt = '';
  wrap.appendChild(img);
  return wrap;
}

// ===== Add category modal =====
function openCategoryModal() {
  newCategoryInput.value = '';
  categoryModal.classList.remove('hidden');
  setTimeout(() => newCategoryInput.focus(), 50);
}

function closeCategoryModal() {
  categoryModal.classList.add('hidden');
}

categoryCancel.addEventListener('click', closeCategoryModal);
categoryModal.addEventListener('click', (e) => {
  if (e.target === categoryModal) closeCategoryModal();
});

categorySave.addEventListener('click', async () => {
  const name = newCategoryInput.value.trim();
  if (!name) return;
  if (userCategories.some(c => c.toLowerCase() === name.toLowerCase())) {
    closeCategoryModal();
    return;
  }

  userCategories.push(name);
  await db.collection('users').doc(currentUser.uid).set(
    { categories: userCategories },
    { merge: true }
  );

  activeCategory = name;
  renderCategoryRail();
  renderMain();
  closeCategoryModal();
});

newCategoryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') categorySave.click();
});

// ===== Add / edit item modal =====
function updatePriceCheckStatus(item) {
  if (!item || !item.priceCheckedAt) {
    priceCheckStatus.classList.add('hidden');
    priceCheckStatus.textContent = '';
    return;
  }

  const checkedDate = item.priceCheckedAt.toDate ? item.priceCheckedAt.toDate() : new Date(item.priceCheckedAt);
  const relative = formatRelativeDate(checkedDate);

  if (typeof item.previousPrice === 'number' && typeof item.price === 'number' && item.previousPrice !== item.price) {
    const direction = item.previousPrice > item.price ? 'dropped' : 'went up';
    priceCheckStatus.textContent = `Price ${direction} from $${item.previousPrice.toFixed(2)} — last checked ${relative}.`;
  } else {
    priceCheckStatus.textContent = `Last checked ${relative}.`;
  }
  priceCheckStatus.classList.remove('hidden');
}

function formatRelativeDate(date) {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return '1 week ago';
  return `${weeks} weeks ago`;
}

function openItemModal(item) {
  editingItemId = item ? item.id : null;

  if (item) {
    itemModalHeading.textContent = 'Edit find';
    itemSaveBtn.textContent = 'Save changes';
    itemDeleteBtn.style.display = '';
    itemDeleteBtn.classList.add('item-delete-btn-visible');

    itemNameInput.value = item.name || '';
    itemPriceInput.value = (item.price !== null && item.price !== undefined) ? item.price : '';
    itemStoreInput.value = item.store || '';
    itemUrlInput.value = item.url || '';
    itemImageInput.value = item.imageUrl || '';
    itemNotesInput.value = item.notes || '';
    itemCategorySelect.value = userCategories.includes(item.category) ? item.category : userCategories[0];
    showImagePreview(item.imageUrl || null);
    updatePriceCheckStatus(item);
    loadPriceHistory(item.id);
    checkPriceNowBtn.classList.toggle('hidden', !item.url);
    checkPriceNowBtn.disabled = false;
    checkPriceNowBtn.textContent = 'Check price now';
  } else {
    itemModalHeading.textContent = 'Add a find';
    itemSaveBtn.textContent = 'Save find';
    itemDeleteBtn.style.display = 'none';

    itemForm.reset();
    showImagePreview(null);
    updatePriceCheckStatus(null);
    priceHistorySection.classList.add('hidden');
    checkPriceNowBtn.classList.add('hidden');
    // Default the category picker to whatever's currently selected in the rail, if it's a real category.
    if (userCategories.includes(activeCategory)) {
      itemCategorySelect.value = activeCategory;
    } else if (userCategories.length) {
      itemCategorySelect.value = userCategories[0];
    }
  }

  itemModal.classList.remove('hidden');
  parseUrlInput.value = '';
  setParseStatus(null);
  setTimeout(() => itemNameInput.focus(), 50);
}

function closeItemModal() {
  itemModal.classList.add('hidden');
  editingItemId = null;
}

// ===== Photo: preview, upload + client-side compression, remove =====
function showImagePreview(src) {
  if (!src) {
    imagePreviewWrap.classList.add('hidden');
    imagePreview.src = '';
    return;
  }
  imagePreview.src = src;
  imagePreviewWrap.classList.remove('hidden');
}

photoUploadBtn.addEventListener('click', () => photoFileInput.click());

photoFileInput.addEventListener('change', async () => {
  const file = photoFileInput.files && photoFileInput.files[0];
  if (!file) return;

  try {
    const compressedDataUrl = await compressImageFile(file, 640, 0.72);
    itemImageInput.value = compressedDataUrl;
    showImagePreview(compressedDataUrl);
  } catch (err) {
    console.error('Photo processing error:', err);
    alert("Couldn't process that photo. Please try a different one.");
  } finally {
    photoFileInput.value = '';
  }
});

// Resize/compress an image file client-side, returning a JPEG data URL.
function compressImageFile(file, maxDimension, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image load failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDimension) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Pasting a direct image URL shows a live preview too (best-effort — some
// stores block hotlinking, in which case the card will fall back gracefully).
itemImageInput.addEventListener('input', () => {
  const val = itemImageInput.value.trim();
  showImagePreview(val || null);
});

imageRemoveBtn.addEventListener('click', () => {
  itemImageInput.value = '';
  showImagePreview(null);
});

// ===== Paste-a-link auto-fill =====
function setParseStatus(message, type) {
  if (!message) {
    parseStatus.classList.add('hidden');
    parseStatus.textContent = '';
    parseStatus.className = 'parse-status hidden';
    return;
  }
  parseStatus.textContent = message;
  parseStatus.className = `parse-status status-${type}`;
}

parseUrlBtn.addEventListener('click', async () => {
  const url = parseUrlInput.value.trim();
  if (!url) {
    setParseStatus('Paste a product link above first.', 'error');
    return;
  }

  parseUrlBtn.disabled = true;
  setParseStatus('Fetching details…', 'loading');

  try {
    const response = await fetch('/.netlify/functions/parse-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await response.json();

    if (data.success) {
      if (data.name) itemNameInput.value = data.name;
      if (data.price !== null && data.price !== undefined) itemPriceInput.value = data.price;
      if (data.store) itemStoreInput.value = data.store;
      if (data.imageUrl) {
        itemImageInput.value = data.imageUrl;
        showImagePreview(data.imageUrl);
      }
      itemUrlInput.value = url;

      const filledParts = [
        data.name && 'name',
        (data.price !== null && data.price !== undefined) && 'price',
        data.imageUrl && 'photo'
      ].filter(Boolean);

      setParseStatus(
        filledParts.length
          ? `Filled in ${filledParts.join(', ')}. Double-check before saving.`
          : "Found the page, but couldn't pull details. Fill in the rest manually.",
        'success'
      );
    } else {
      itemUrlInput.value = url;
      setParseStatus("Couldn't read that page automatically — go ahead and fill in the details below.", 'error');
    }
  } catch (err) {
    console.error('URL parse error:', err);
    itemUrlInput.value = url;
    setParseStatus("Something went wrong fetching that link. Fill in the details below.", 'error');
  } finally {
    parseUrlBtn.disabled = false;
  }
});

itemCancelBtn.addEventListener('click', closeItemModal);
itemModal.addEventListener('click', (e) => {
  if (e.target === itemModal) closeItemModal();
});

itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = itemNameInput.value.trim();
  if (!name) return;

  const data = {
    name,
    price: itemPriceInput.value !== '' ? Number(itemPriceInput.value) : null,
    store: itemStoreInput.value.trim(),
    url: itemUrlInput.value.trim(),
    imageUrl: itemImageInput.value.trim(),
    category: itemCategorySelect.value || 'Uncategorized',
    notes: itemNotesInput.value.trim(),
  };

  itemSaveBtn.disabled = true;

  try {
    const itemsRef = db.collection('users').doc(currentUser.uid).collection('items');

    if (editingItemId) {
      await itemsRef.doc(editingItemId).update(data);
    } else {
      data.purchased = false;
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await itemsRef.add(data);
    }
    closeItemModal();
  } catch (err) {
    console.error('Error saving item:', err);
    alert("Couldn't save that find. Please try again.");
  } finally {
    itemSaveBtn.disabled = false;
  }
});

itemDeleteBtn.addEventListener('click', async () => {
  if (!editingItemId) return;
  const confirmed = confirm('Remove this find from your list?');
  if (!confirmed) return;

  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('items').doc(editingItemId).delete();
    closeItemModal();
  } catch (err) {
    console.error('Error deleting item:', err);
    alert("Couldn't delete that find. Please try again.");
  }
});

// ===== Add item entry points =====
fabAdd.addEventListener('click', () => openItemModal(null));
emptyAddBtn.addEventListener('click', () => openItemModal(null));

// ===== Shared lists =====
function showSharePanel(name) {
  sharePanelList.classList.toggle('hidden', name !== 'list');
  sharePanelCreate.classList.toggle('hidden', name !== 'create');
  sharePanelResult.classList.toggle('hidden', name !== 'result');
}

async function openSharedListsModal() {
  sharedListsModal.classList.remove('hidden');
  showSharePanel('list');
  await loadSharedLists();
}

function closeSharedListsModal() {
  sharedListsModal.classList.add('hidden');
}

async function loadSharedLists() {
  sharedListsUl.innerHTML = '';
  sharedListsEmpty.classList.add('hidden');

  try {
    const snapshot = await db.collection('sharedLists')
      .where('ownerId', '==', currentUser.uid)
      .get();

    if (snapshot.empty) {
      sharedListsEmpty.classList.remove('hidden');
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const li = document.createElement('li');

      const info = document.createElement('div');
      info.className = 'shared-list-info';
      const name = document.createElement('span');
      name.className = 'shared-list-name';
      name.textContent = data.name || 'Untitled list';
      const count = document.createElement('span');
      count.className = 'shared-list-count';
      const n = (data.itemIds || []).length;
      count.textContent = `${n} item${n === 1 ? '' : 's'}`;
      info.appendChild(name);
      info.appendChild(count);

      const actions = document.createElement('div');
      actions.className = 'shared-list-actions';

      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy Link';
      copyBtn.addEventListener('click', () => copyShareLink(doc.id, copyBtn));

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteSharedList(doc.id));

      actions.appendChild(copyBtn);
      actions.appendChild(delBtn);

      li.appendChild(info);
      li.appendChild(actions);
      sharedListsUl.appendChild(li);
    });
  } catch (err) {
    console.error('Error loading shared lists:', err);
  }
}

function buildShareUrl(shareId) {
  return `${window.location.origin}/share.html?id=${shareId}`;
}

async function copyShareLink(shareId, btn) {
  const url = buildShareUrl(shareId);
  try {
    await navigator.clipboard.writeText(url);
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch (err) {
    prompt('Copy this link:', url);
  }
}

async function deleteSharedList(shareId) {
  if (!confirm('Delete this shared list? The link will stop working.')) return;
  try {
    await db.collection('sharedLists').doc(shareId).delete();
    loadSharedLists();
  } catch (err) {
    console.error('Error deleting shared list:', err);
    alert("Couldn't delete that list. Please try again.");
  }
}

function openCreateSharePanel() {
  shareListNameInput.value = '';
  shareItemChecklist.innerHTML = '';

  allItems.forEach(item => {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item.id;

    const img = document.createElement('img');
    img.src = item.imageUrl || 'icons/icon-96.png';
    img.alt = '';

    const label = document.createElement('span');
    label.textContent = item.name;

    li.appendChild(checkbox);
    li.appendChild(img);
    li.appendChild(label);
    shareItemChecklist.appendChild(li);
  });

  showSharePanel('create');
}

async function createSharedList() {
  const name = shareListNameInput.value.trim();
  const checkedIds = Array.from(shareItemChecklist.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  if (!name) {
    alert('Give your list a name first.');
    return;
  }
  if (checkedIds.length === 0) {
    alert('Select at least one item to include.');
    return;
  }

  shareCreateConfirm.disabled = true;
  try {
    const newDocRef = db.collection('sharedLists').doc();
    await newDocRef.set({
      ownerId: currentUser.uid,
      name,
      itemIds: checkedIds,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    shareResultLink.value = buildShareUrl(newDocRef.id);
    showSharePanel('result');
  } catch (err) {
    console.error('Error creating shared list:', err);
    alert("Couldn't create that list. Please try again.");
  } finally {
    shareCreateConfirm.disabled = false;
  }
}

shareListsBtn.addEventListener('click', openSharedListsModal);
sharePanelListClose.addEventListener('click', closeSharedListsModal);
shareNewBtn.addEventListener('click', openCreateSharePanel);
shareCreateCancel.addEventListener('click', () => showSharePanel('list'));
shareCreateConfirm.addEventListener('click', createSharedList);
shareCopyLinkBtn.addEventListener('click', () => {
  shareResultLink.select();
  copyShareLink(shareResultLink.value.split('id=')[1], shareCopyLinkBtn);
});
shareResultDone.addEventListener('click', async () => {
  showSharePanel('list');
  await loadSharedLists();
});
sharedListsModal.addEventListener('click', (e) => {
  if (e.target === sharedListsModal) closeSharedListsModal();
});

// ===== Service worker registration =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
