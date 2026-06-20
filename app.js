import {
  auth, db, googleProvider,
  signInWithGoogle, signUpWithEmail, logInWithEmail, signOutUser,
  onAuthStateChanged, sendEmailVerification,
  updatePassword, updateEmail,
  createProfile, getProfile, claimUsername, checkUsernameAvailable,
  updateUsername, changeEmail, changePassword,
  addReport,
  collection, doc, getDoc, setDoc, deleteDoc,
} from './firebase.js';
import { transliterate, hasTranslit } from './translit.js';

const LANGUAGES = [
  { code: 'th', label: 'ไทย (Thai)', script: 'Thai', countries: ['Thailand'] },
  { code: 'km', label: 'ភាសាខ្មែរ (Khmer)', script: 'Khmer', countries: ['Cambodia'] },
  { code: 'lo', label: 'ລາວ (Lao)', script: 'Lao', countries: ['Laos'] },
  { code: 'ko', label: '한국어 (Korean)', script: 'Hangul', countries: ['South_Korea', 'North_Korea'] },
  { code: 'ja', label: '日本語 (Japanese)', script: 'Kanji & Kana', countries: ['Japan'] },
  { code: 'zh', label: '中文 (Chinese)', script: 'Chinese (Hanzi)', countries: ['Taiwan'] },
  { code: 'hi', label: 'हिन्दी (Hindi)', script: 'Devanagari', countries: ['India'] },
  { code: 'mr', label: 'मराठी (Marathi)', script: 'Devanagari', countries: ['India'] },
  { code: 'ne', label: 'नेपाली (Nepali)', script: 'Devanagari', countries: ['Nepal', 'India'] },
  { code: 'bh', label: 'भोजपुरी (Bhojpuri)', script: 'Devanagari', countries: ['India'] },
  { code: 'bn', label: 'বাংলা (Bengali)', script: 'Bengali-Assamese', countries: ['Bangladesh', 'India'] },
  { code: 'as', label: 'অসমীয়া (Assamese)', script: 'Bengali-Assamese', countries: ['India'] },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)', script: 'Gurmukhi', countries: ['India'] },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)', script: 'Gujarati', countries: ['India'] },
  { code: 'ta', label: 'தமிழ் (Tamil)', script: 'Tamil', countries: ['India', 'Sri_Lanka', 'Singapore'] },
  { code: 'te', label: 'తెలుగు (Telugu)', script: 'Telugu', countries: ['India'] },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', script: 'Kannada', countries: ['India'] },
  { code: 'ml', label: 'മലയാളം (Malayalam)', script: 'Malayalam', countries: ['India'] },
  { code: 'si', label: 'සිංහල (Sinhala)', script: 'Sinhala', countries: ['Sri_Lanka'] },
  { code: 'ar', label: 'العربية (Arabic)', script: 'Arabic', countries: ['Tunisia', 'Jordan', 'Qatar', 'United_Arab_Emirates', 'Oman'] },
  { code: 'he', label: 'עברית (Hebrew)', script: 'Hebrew', countries: ['Israel'] },
  { code: 'ka', label: 'ქართული (Georgian)', script: 'Georgian (Mkhedruli)', countries: ['Georgia'] },
  { code: 'el', label: 'Ελληνικά (Greek)', script: 'Greek', countries: ['Greece', 'Cyprus'] },
  { code: 'ru', label: 'Русский (Russian)', script: 'Cyrillic', countries: ['Russia'] },
  { code: 'uk', label: 'Українська (Ukrainian)', script: 'Cyrillic', countries: ['Ukraine'] },
  { code: 'bg', label: 'Български (Bulgarian)', script: 'Cyrillic', countries: ['Bulgaria'] },
  { code: 'sr', label: 'Српски (Serbian)', script: 'Cyrillic', countries: ['Serbia'] },
  { code: 'mk', label: 'Македонски (Macedonian)', script: 'Cyrillic', countries: ['North_Macedonia'] },
  { code: 'kk', label: 'Қазақша (Kazakh)', script: 'Cyrillic', countries: ['Kazakhstan'] },
  { code: 'ky', label: 'Кыргызча (Kyrgyz)', script: 'Cyrillic', countries: ['Kyrgyzstan'] },
  { code: 'mn', label: 'Монгол (Mongolian)', script: 'Cyrillic', countries: ['Mongolia'] },
];

const state = {
  lang: null,
  places: [],
  index: 0,
  answered: false,
  user: null,
  profile: null,
  reportPlace: null,
  usernameEditing: false,
  emailEditing: false,
  authFlowInProgress: false,
};

const el = (id) => document.getElementById(id);
const $ = el;

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ═══════════════════════════════════════════
//  Auth
// ═══════════════════════════════════════════

function showPracticePage() {
  $('auth-page').style.display = 'none';
  $('username-prompt-page').style.display = 'none';
  $('practice-page').style.display = '';
}

function setAuthError(id, msg) {
  $(id).textContent = msg;
}

function clearAuthErrors() {
  setAuthError('login-error', '');
  setAuthError('register-error', '');
}

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

function validatePassword(pw) {
  return PASSWORD_RE.test(pw);
}

async function handleRegister(e) {
  e.preventDefault();
  clearAuthErrors();
  const username = $('register-username').value.trim();
  const email = $('register-email').value.trim();
  const password = $('register-password').value;

  if (!username || username.length < 4) { setAuthError('register-error', 'Username must be at least 4 characters.'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { setAuthError('register-error', 'Username can only contain letters, numbers, and underscores.'); return; }
  if (!validatePassword(password)) { setAuthError('register-error', 'Password must be at least 8 characters with 1 uppercase letter and 1 number.'); return; }

  const available = await checkUsernameAvailable(username);
  if (!available) { setAuthError('register-error', 'Username is already taken.'); return; }

    state.authFlowInProgress = true;
  try {
    const user = await signUpWithEmail(email, password);
    await createProfile(user.uid, { username, email, displayName: username, photoURL: '' });
    await claimUsername(username, user.uid);
    state.profile = { username, email, displayName: username, photoURL: '' };
    state.authFlowInProgress = false;
    completeAuthSetup();
  } catch (err) {
    state.authFlowInProgress = false;
    if (err.code === 'auth/email-already-in-use') setAuthError('register-error', 'An account with this email already exists.');
    else setAuthError('register-error', err.message);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  clearAuthErrors();
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  try {
    await logInWithEmail(email, password);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      setAuthError('login-error', 'Invalid email or password.');
    } else setAuthError('login-error', err.message);
  }
}

async function handleGoogleSignIn() {
  clearAuthErrors();
  state.authFlowInProgress = true;
  try {
    const user = await signInWithGoogle();
    const profile = await getProfile(user.uid);
    if (profile && profile.username) {
      state.authFlowInProgress = false;
      state.profile = profile;
      completeAuthSetup();
      return;
    }
    state.promptUser = user;
    showUsernamePromptPage();
  } catch (err) {
    state.authFlowInProgress = false;
    if (err.code !== 'auth/popup-closed-by-user') console.error(err);
  }
}

async function handleUsernamePromptSubmit() {
  const input = $('username-prompt-input');
  const errEl = $('username-prompt-error');
  let username;
  try {
    username = input.value.trim();
    if (!username || username.length < 4) { errEl.textContent = 'Username must be at least 4 characters.'; return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { errEl.textContent = 'Only letters, numbers, and underscores.'; return; }
  } catch (e) { errEl.textContent = 'Validation error.'; return; }
  try {
    const available = await checkUsernameAvailable(username);
    if (!available) { errEl.textContent = 'Username is already taken.'; return; }
  } catch (e) { errEl.textContent = 'Could not check availability.'; console.error('checkUsernameAvailable error:', e); return; }
  errEl.textContent = '';
  const user = auth.currentUser;
  if (!user) { errEl.textContent = 'Not signed in. Please sign out and try again.'; return; }
  try {
    state.profile = { username, email: user.email, displayName: user.displayName || username, photoURL: user.photoURL || '' };
    await createProfile(user.uid, {
      username,
      email: user.email,
      displayName: user.displayName || username,
      photoURL: user.photoURL || '',
    });
    await claimUsername(username, user.uid);
    state.authFlowInProgress = false;
    completeAuthSetup();
  } catch (err) {
    errEl.textContent = 'Failed to create profile. Try again.';
  }
}

function showUsernamePromptPage() {
  $('auth-page').style.display = 'none';
  $('practice-page').style.display = 'none';
  $('username-prompt-page').style.display = '';
  $('username-prompt-input').value = '';
  $('username-prompt-error').textContent = '';
  $('username-prompt-input').focus();
}

function showAuthPage() {
  $('auth-page').style.display = '';
  $('practice-page').style.display = 'none';
  $('username-prompt-page').style.display = 'none';
  closeSidebar('profile-sidebar');
  closeSidebar('report-sidebar');
  $('overlay').style.display = 'none';
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
  $('login-form').style.display = tab === 'login' ? '' : 'none';
  $('register-form').style.display = tab === 'register' ? '' : 'none';
  clearAuthErrors();
}

function setupAuth() {
  $('login-form').addEventListener('submit', handleLogin);
  $('register-form').addEventListener('submit', handleRegister);
  $('auth-google-btn').addEventListener('click', handleGoogleSignIn);
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.addEventListener('click', () => switchAuthTab(t.dataset.tab));
  });
}

// ═══════════════════════════════════════════
//  Profile
// ═══════════════════════════════════════════

function openSidebar(id) {
  $(id).classList.add('open');
  $('overlay').style.display = '';
}

function closeSidebar(id) {
  $(id).classList.remove('open');
  $('overlay').style.display = 'none';
}

async function openProfile() {
  const profile = await getProfile(state.user.uid);
  state.profile = profile;
  if (!profile) return;

  $('profile-username-input').value = profile.username || '';
  $('profile-email-input').value = profile.email || state.user.email || '';
  $('profile-username-input').disabled = true;
  $('profile-email-input').disabled = true;
  $('profile-username-status').textContent = '';
  state.usernameEditing = false;
  state.emailEditing = false;
  $('profile-username-edit-btn').textContent = 'Edit';
  $('profile-email-edit-btn').textContent = 'Change';

  const avatar = $('profile-avatar');
  if (state.user.photoURL) {
    avatar.innerHTML = `<img src="${escapeHtml(state.user.photoURL)}" alt="" class="profile-avatar-img">`;
  } else {
    const initials = (profile.username || '?')[0].toUpperCase();
    avatar.textContent = initials;
  }

  openSidebar('profile-sidebar');
}

async function handleUsernameEdit() {
  if (state.usernameEditing) {
    const newUsername = $('profile-username-input').value.trim();
    if (!newUsername || newUsername.length < 4) { $('profile-username-status').textContent = 'Must be at least 4 characters.'; return; }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) { $('profile-username-status').textContent = 'Only letters, numbers, underscores.'; return; }

    const profile = state.profile;
    if (profile.lastUsernameChange) {
      const last = profile.lastUsernameChange.toDate ? profile.lastUsernameChange.toDate() : new Date(profile.lastUsernameChange);
      const week = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - last.getTime() < week) {
        const daysLeft = Math.ceil((week - (Date.now() - last.getTime())) / (24 * 60 * 60 * 1000));
        $('profile-username-status').textContent = `Can change again in ${daysLeft} day(s).`;
        return;
      }
    }

    if (newUsername === profile.username) {
      $('profile-username-status').textContent = 'That is your current username.';
      return;
    }

    const available = await checkUsernameAvailable(newUsername);
    if (!available) {
      $('profile-username-status').textContent = 'Username taken.';
      return;
    }

    try {
      await updateUsername(state.user.uid, newUsername);
    } catch (err) {
      $('profile-username-status').textContent = err.message || 'Failed to update username.';
      return;
    }
    state.profile.username = newUsername;
    state.profile.lastUsernameChange = new Date();
    $('profile-username-status').textContent = 'Updated!';
    $('profile-username-input').disabled = true;
    $('profile-username-edit-btn').textContent = 'Edit';
    state.usernameEditing = false;
  } else {
    $('profile-username-input').disabled = false;
    $('profile-username-input').focus();
    $('profile-username-edit-btn').textContent = 'Save';
    $('profile-username-status').textContent = '';
    state.usernameEditing = true;
  }
}

async function handleEmailEdit() {
  if (state.emailEditing) {
    const newEmail = $('profile-email-input').value.trim();
    if (!newEmail || !newEmail.includes('@')) { return; }
    try {
      await changeEmail(state.user.uid, newEmail);
      $('profile-email-input').disabled = true;
      $('profile-email-edit-btn').textContent = 'Change';
      state.emailEditing = false;
      $('profile-username-status').textContent = 'Verification email sent.';
    } catch (err) {
      $('profile-username-status').textContent = err.message;
    }
  } else {
    $('profile-email-input').disabled = false;
    $('profile-email-input').focus();
    $('profile-email-edit-btn').textContent = 'Save';
    state.emailEditing = true;
  }
}

async function handlePasswordChange() {
  const newPw = prompt('Enter new password (8+ chars, 1 uppercase, 1 number):');
  if (!newPw) return;
  if (!validatePassword(newPw)) { alert('Password must be at least 8 characters with 1 uppercase letter and 1 number.'); return; }
  try {
    await changePassword(state.user, newPw);
    alert('Password changed successfully.');
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      alert('Please sign out and sign back in, then try again.');
    } else alert(err.message);
  }
}

// ═══════════════════════════════════════════
//  Report
// ═══════════════════════════════════════════

function openReport() {
  const place = state.reportPlace;
  if (!place) return;
  $('report-native').textContent = place.native;
  $('report-old-latin').textContent = place.latin;
  $('report-suggestion').value = '';
  $('report-error').textContent = '';
  openSidebar('report-sidebar');
}

async function handleReportSubmit() {
  const place = state.reportPlace;
  if (!place) return;
  const suggestion = $('report-suggestion').value.trim();
  try {
    await addReport({
      native: place.native,
      oldLatin: place.latin,
      suggestedLatin: suggestion || '',
      language: state.lang,
      userId: state.user.uid,
    });
    closeSidebar('report-sidebar');
    $('report-btn').style.display = 'none';
  } catch (err) {
    $('report-error').textContent = 'Failed to submit report. Try again.';
  }
}

// ═══════════════════════════════════════════
//  Practice (existing logic + translit)
// ═══════════════════════════════════════════

function populateSelector() {
  const select = $('language-select');
  const groups = {};
  for (const lang of LANGUAGES) {
    if (!groups[lang.script]) groups[lang.script] = document.createDocumentFragment();
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = lang.label;
    groups[lang.script].appendChild(opt);
  }
  for (const [script, frag] of Object.entries(groups)) {
    const g = document.createElement('optgroup');
    g.label = script;
    g.appendChild(frag);
    select.appendChild(g);
  }
  const saved = localStorage.getItem('practice-scripts-lang');
  if (saved && LANGUAGES.find((l) => l.code === saved)) select.value = saved;
}

const TRANSLIT = {
  ka: [[/f/gi, 'p']],
};
for (const c of ['ru','uk','bg','sr','mk','kk','ky','mn']) {
  TRANSLIT[c] = [
    [/kh/gi, 'h'],
    [/zh/gi, 'j'],
  ];
}

function normalize(str, rules) {
  if (!str) return '';
  let s = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['ʼʻ`´'’′‎]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (rules) {
    for (const [re, rep] of rules) {
      s = s.replace(re, rep);
    }
  }
  return s;
}

function matchAnswer(input, expected, langCode) {
  if (!expected) return false;
  const rules = TRANSLIT[langCode] || null;
  const a = normalize(input, rules);
  const b = normalize(expected, rules);
  if (a === b) return true;
  const variants = expected.split(/[,;()]+/).map((s) => s.trim());
  for (const v of variants) {
    if (normalize(v, rules) === a) return true;
  }
  return false;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function showNext() {
  $('report-btn').style.display = 'none';
  state.reportPlace = null;

  if (state.places.length === 0) {
    $('script-display').textContent = '\u2014';
    $('hint').textContent = 'No places loaded';
    state.answered = true;
    $('giveup-btn').textContent = 'Retry';
    $('giveup-btn').style.display = '';
    return;
  }
  if (state.index >= state.places.length) {
    state.index = 0;
    shuffle(state.places);
  }
  const p = state.places[state.index];
  $('script-display').textContent = p.native;
  $('hint').textContent = p.hint || '';
  $('answer-input').value = '';
  $('answer-input').disabled = false;
  $('answer-input').focus();
  $('feedback').textContent = '';
  $('feedback').className = '';
  $('giveup-btn').textContent = 'Give up';
  $('giveup-btn').style.display = '';
  $('giveup-btn').disabled = false;
  state.answered = false;
}

function showCorrect() {
  $('feedback').textContent = '\u2713 Correct!';
  $('feedback').className = 'correct';
  $('answer-input').disabled = true;
  $('giveup-btn').style.display = 'none';
  state.answered = true;
  setTimeout(() => {
    if (!state.answered) return;
    state.index++;
    showNext();
  }, 700);
}

function showIncorrect(expected) {
  $('answer-input').disabled = true;
  state.answered = true;
  $('feedback').innerHTML = '\u2717 Not quite. The answer was: <span class="expected-answer">' + escapeHtml(expected) + '</span>';
  $('feedback').className = 'incorrect';
  $('giveup-btn').textContent = 'Next';
  $('giveup-btn').style.display = '';
}

function giveUp() {
  if (state.answered) {
    if (state.places.length === 0) {
      onLanguageChange(state.lang);
      return;
    }
    state.index++;
    showNext();
    return;
  }
  const place = state.places[state.index];
  if (!place) return;
  $('answer-input').disabled = true;
  state.answered = true;
  $('feedback').innerHTML = 'The answer was: <span class="expected-answer">' + escapeHtml(place.latin) + '</span>';
  $('feedback').className = 'incorrect';
  $('giveup-btn').textContent = 'Next';
  state.reportPlace = place;
  $('report-btn').style.display = '';
}

function handleInput() {
  if (state.answered) return;
  const place = state.places[state.index];
  if (!place) return;
  const input = $('answer-input').value.trim();
  if (!input) return;
  if (matchAnswer(input, place.latin, state.lang)) {
    showCorrect();
  }
}

async function onLanguageChange(langCode) {
  state.lang = langCode;
  state.places = [];
  state.index = 0;
  state.answered = false;
  $('giveup-btn').textContent = 'Give up';
  $('giveup-btn').style.display = '';
  $('answer-input').disabled = false;
  $('report-btn').style.display = 'none';
  localStorage.setItem('practice-scripts-lang', langCode);
  $('status').textContent = 'Loading place names\u2026';
  $('script-display').textContent = '\u2014';
  $('hint').textContent = '';
  $('feedback').textContent = '';
  $('feedback').className = '';
  try {
    const res = await fetch('data/' + langCode + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const lang = LANGUAGES.find((l) => l.code === langCode);
    const useTranslit = hasTranslit(langCode);
    state.places = data.map((p) => {
      const latin = useTranslit ? (transliterate(p.native, langCode) || p.latin) : p.latin;
      return {
        native: p.native,
        latin: latin,
        country: p.country,
        hint: 'a city in ' + (p.country || lang?.countries?.[0] || '').replace(/_/g, ' '),
      };
    });
    if (state.places.length === 0) {
      $('status').textContent = 'No places found for this language. Try another.';
      $('script-display').textContent = '\u2014';
      $('hint').textContent = '';
      state.answered = true;
      $('giveup-btn').textContent = 'Retry';
      return;
    }
    $('status').textContent = '';
    shuffle(state.places);
    showNext();
  } catch (err) {
    $('status').textContent = 'Error loading data. Check connection.';
    $('script-display').textContent = '\u2014';
    $('answer-input').disabled = true;
  }
}

// ═══════════════════════════════════════════
//  Theme
// ═══════════════════════════════════════════

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('practice-scripts-theme', isDark ? 'light' : 'dark');
  $('theme-toggle').classList.toggle('dark', !isDark);
  $('theme-toggle').classList.toggle('light', isDark);
}

function initTheme() {
  const saved = localStorage.getItem('practice-scripts-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved === 'dark' || (!saved && prefersDark);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  $('theme-toggle').classList.add(isDark ? 'dark' : 'light');
}

// ═══════════════════════════════════════════
//  Custom Select
// ═══════════════════════════════════════════

function setupCustomSelect() {
  const select = $('language-select');

  select.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    if (this.dataset.open === 'true') { closeDropdown(); return; }

    const rect = this.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'select-overlay';
    overlay.addEventListener('click', closeDropdown);
    overlay.addEventListener('contextmenu', (ev) => ev.preventDefault());

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';
    dropdown.style.minWidth = Math.max(rect.width, 220) + 'px';
    dropdown.setAttribute('role', 'listbox');

    let currentGroup = null;
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      const parentLabel = opt.parentElement.tagName === 'OPTGROUP' ? opt.parentElement.label : null;
      if (parentLabel && parentLabel !== currentGroup) {
        currentGroup = parentLabel;
        const labelDiv = document.createElement('div');
        labelDiv.className = 'custom-select-group';
        labelDiv.textContent = parentLabel;
        dropdown.appendChild(labelDiv);
      }
      if (opt.value) {
        const item = document.createElement('div');
        item.className = 'custom-select-item';
        item.textContent = opt.textContent;
        item.dataset.value = opt.value;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', opt.value === select.value ? 'true' : 'false');
        if (opt.value === select.value) item.classList.add('selected');
        item.addEventListener('click', () => {
          select.value = opt.value;
          closeDropdown();
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        dropdown.appendChild(item);
      }
    }

    function closeDropdown() {
      overlay.remove();
      dropdown.remove();
      select.dataset.open = 'false';
    }

    function position() {
      const r = select.getBoundingClientRect();
      const dh = dropdown.scrollHeight || 320;
      if (window.innerHeight - r.bottom >= dh || window.innerHeight - r.bottom >= r.top) {
        dropdown.style.top = (r.bottom + 4) + 'px';
        dropdown.style.left = r.left + 'px';
      } else {
        dropdown.style.bottom = (window.innerHeight - r.top + 4) + 'px';
        dropdown.style.left = r.left + 'px';
      }
    }

    document.body.appendChild(overlay);
    document.body.appendChild(dropdown);
    select.dataset.open = 'true';
    position();
    const ro = new ResizeObserver(position);
    ro.observe(dropdown);
  });
}

// ═══════════════════════════════════════════
//  Auth setup helpers
// ═══════════════════════════════════════════

function completeAuthSetup() {
  if (state.profile && state.profile.username) {
    showPracticePage();
    setupPracticeListeners();
    if ($('language-select').value) onLanguageChange($('language-select').value);
  } else {
    showUsernamePromptPage();
  }
}

function setupPracticeListeners() {
  $('profile-btn').onclick = openProfile;
  $('profile-close-btn').onclick = () => closeSidebar('profile-sidebar');
  $('profile-username-edit-btn').onclick = handleUsernameEdit;
  $('profile-email-edit-btn').onclick = handleEmailEdit;
  $('profile-password-btn').onclick = handlePasswordChange;
  $('report-close-btn').onclick = () => closeSidebar('report-sidebar');
  $('report-submit-btn').onclick = handleReportSubmit;
  $('overlay').onclick = () => {
    closeSidebar('profile-sidebar');
    closeSidebar('report-sidebar');
  };
  $('report-btn').onclick = openReport;
}

// ═══════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════

function init() {
  try {
    populateSelector();
    setupCustomSelect();
    initTheme();
    setupAuth();

    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
      try {
        state.user = user;
        if (user) {
          if (state.authFlowInProgress) return;
          if (!state.profile || !state.profile.username) {
            const profile = await getProfile(user.uid);
            state.profile = profile;
          }
          state.promptUser = user;
          completeAuthSetup();
        } else {
          state.profile = null;
          showAuthPage();
        }
      } catch (e) { console.error('onAuthStateChanged:', e); }
    });

    $('language-select').addEventListener('change', () => onLanguageChange($('language-select').value));
    $('answer-input').addEventListener('input', handleInput);
    $('giveup-btn').addEventListener('click', giveUp);
    $('theme-toggle').addEventListener('click', toggleTheme);
    $('username-prompt-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleUsernamePromptSubmit(); }
    });
    $('username-prompt-submit').addEventListener('click', handleUsernamePromptSubmit);
    $('username-prompt-signout').addEventListener('click', async () => {
      state.authFlowInProgress = false;
      await signOutUser();
    });
  } catch (e) {
    console.error('init():', e);
    document.body.textContent = 'Failed to load. See console.';
  }
}

init();
