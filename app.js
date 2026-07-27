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

let isSignupMode = false;
let currentUser = null;
let userCategories = [];
let activeCategory = 'All';

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
  } else {
    appShell.classList.add('hidden');
    authScreen.classList.remove('hidden');
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

// ===== Main content (empty state for now; item rendering comes in Session 2) =====
function renderMain() {
  // No items exist yet in Session 1 — always show the empty state,
  // tailored to whichever category is selected.
  itemGrid.classList.add('hidden');
  emptyState.classList.remove('hidden');

  if (activeCategory === 'All') {
    emptyHeading.textContent = 'Nothing here yet';
    emptySub.textContent = "Things you spot out in the world will show up here.";
  } else {
    emptyHeading.textContent = `No ${activeCategory.toLowerCase()} finds yet`;
    emptySub.textContent = `Save something you've spotted into ${activeCategory}.`;
  }
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

// ===== Add item entry points (wired up fully in Session 2) =====
fabAdd.addEventListener('click', () => {
  alert("Adding finds is coming in the next session — this button will open the add-item form.");
});
emptyAddBtn.addEventListener('click', () => fabAdd.click());

// ===== Service worker registration =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
