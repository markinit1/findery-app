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

const emptyState = document.getElementById('empty-state');
const emptyHeading = document.getElementById('empty-heading');
const emptySub = document.getElementById('empty-sub');
const emptyAddBtn = document.getElementById('empty-add-btn');
const itemGrid = document.getElementById('item-grid');
const fabAdd = document.getElementById('fab-add');

const categoryModal = document.getElementById('category-modal');
const newCategoryInput = document.getElementById('new-category-input');
const categoryCancel = document.getElementById('category-cancel');
const categorySave = document.getElementById('category-save');

const itemModal = document.getElementById('item-modal');
const itemModalHeading = document.getElementById('item-modal-heading');
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

  const allChip = makeChip('All', activeCategory === 'All');
  categoryRail.appendChild(allChip);

  userCategories.forEach(cat => {
    categoryRail.appendChild(makeChip(cat, activeCategory === cat));
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

function makeChip(label, isActive) {
  const chip = document.createElement('button');
  chip.className = 'category-chip' + (isActive ? ' active' : '');
  chip.textContent = label;
  chip.addEventListener('click', () => {
    activeCategory = label;
    renderCategoryRail();
    renderMain();
  });
  return chip;
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
function renderMain() {
  const filtered = activeCategory === 'All'
    ? allItems
    : allItems.filter(item => item.category === activeCategory);

  // Keep active (unpurchased) finds up top; purchased ones settle to the bottom,
  // each group preserving the newest-first order from Firestore.
  const sorted = [...filtered].sort((a, b) => {
    if (!!a.purchased === !!b.purchased) return 0;
    return a.purchased ? 1 : -1;
  });

  if (sorted.length === 0) {
    itemGrid.classList.add('hidden');
    emptyState.classList.remove('hidden');

    if (activeCategory === 'All') {
      emptyHeading.textContent = 'Nothing here yet';
      emptySub.textContent = "Things you spot out in the world will show up here.";
    } else {
      emptyHeading.textContent = `No ${activeCategory.toLowerCase()} finds yet`;
      emptySub.textContent = `Save something you've spotted into ${activeCategory}.`;
    }
    return;
  }

  emptyState.classList.add('hidden');
  itemGrid.classList.remove('hidden');
  itemGrid.innerHTML = '';

  sorted.forEach(item => itemGrid.appendChild(buildItemCard(item)));
}

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

  const price = document.createElement('span');
  price.className = 'item-card-price';
  price.textContent = (item.price !== null && item.price !== undefined && item.price !== '')
    ? `$${Number(item.price).toFixed(2)}`
    : '';
  meta.appendChild(price);

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
  } else {
    itemModalHeading.textContent = 'Add a find';
    itemSaveBtn.textContent = 'Save find';
    itemDeleteBtn.style.display = 'none';

    itemForm.reset();
    showImagePreview(null);
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

// ===== Service worker registration =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
