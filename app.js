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
};

const el = {
  select: () => document.getElementById('language-select'),
  status: () => document.getElementById('status'),
  display: () => document.getElementById('script-display'),
  hint: () => document.getElementById('hint'),
  form: () => document.getElementById('answer-form'),
  input: () => document.getElementById('answer-input'),
  giveup: () => document.getElementById('giveup-btn'),
  feedback: () => document.getElementById('feedback'),
  themeToggle: () => document.getElementById('theme-toggle'),
};

function populateSelector() {
  const select = el.select();
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

function normalize(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['ʼʻ`´'’′‎]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAnswer(input, expected) {
  if (!expected) return false;
  const a = normalize(input);
  const b = normalize(expected);
  if (a === b) return true;
  const variants = expected.split(/[,;()]+/).map((s) => s.trim());
  for (const v of variants) {
    if (normalize(v) === a) return true;
  }
  return false;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function showNext() {
  if (state.places.length === 0) {
    el.display().textContent = '\u2014';
    el.hint().textContent = 'No places loaded';
    state.answered = true;
    el.giveup().textContent = 'Retry';
    el.giveup().style.display = '';
    return;
  }
  if (state.index >= state.places.length) {
    state.index = 0;
    shuffle(state.places);
  }
  const p = state.places[state.index];
  el.display().textContent = p.native;
  el.hint().textContent = p.hint || '';
  el.input().value = '';
  el.input().disabled = false;
  el.input().focus();
  el.feedback().textContent = '';
  el.feedback().className = '';
  el.giveup().textContent = 'Give up';
  el.giveup().style.display = '';
  el.giveup().disabled = false;
  state.answered = false;
}

function showCorrect() {
  el.feedback().textContent = '\u2713 Correct!';
  el.feedback().className = 'correct';
  el.input().disabled = true;
  el.giveup().style.display = 'none';
  state.answered = true;
  setTimeout(() => {
    if (!state.answered) return;
    state.index++;
    showNext();
  }, 700);
}

function showIncorrect(expected) {
  el.input().disabled = true;
  state.answered = true;
  el.feedback().innerHTML = '\u2717 Not quite. The answer was: <span class="expected-answer">' + escapeHtml(expected) + '</span>';
  el.feedback().className = 'incorrect';
  el.giveup().textContent = 'Next';
  el.giveup().style.display = '';
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
  el.input().disabled = true;
  state.answered = true;
  el.feedback().innerHTML = 'The answer was: <span class="expected-answer">' + escapeHtml(place.latin) + '</span>';
  el.feedback().className = 'incorrect';
  el.giveup().textContent = 'Next';
}

function handleInput() {
  if (state.answered) return;
  const place = state.places[state.index];
  if (!place) return;
  const input = el.input().value.trim();
  if (!input) return;
  if (matchAnswer(input, place.latin)) {
    showCorrect();
  }
}

async function onLanguageChange(langCode) {
  state.lang = langCode;
  state.places = [];
  state.index = 0;
  state.answered = false;
  el.giveup().textContent = 'Give up';
  el.giveup().style.display = '';
  el.input().disabled = false;
  localStorage.setItem('practice-scripts-lang', langCode);
  el.status().textContent = 'Loading place names\u2026';
  el.display().textContent = '\u2014';
  el.hint().textContent = '';
  el.feedback().textContent = '';
  el.feedback().className = '';
  try {
    const res = await fetch('data/' + langCode + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const lang = LANGUAGES.find((l) => l.code === langCode);
    state.places = data.map((p) => ({
      native: p.native,
      latin: p.latin,
      country: p.country,
      hint: 'a city in ' + (p.country || lang?.countries?.[0] || '').replace(/_/g, ' '),
    }));
    if (state.places.length === 0) {
      el.status().textContent = 'No places found for this language. Try another.';
      el.display().textContent = '\u2014';
      el.hint().textContent = '';
      state.answered = true;
      el.giveup().textContent = 'Retry';
      return;
    }
    el.status().textContent = '';
    shuffle(state.places);
    showNext();
  } catch (err) {
    el.status().textContent = 'Error loading data. Check connection.';
    el.display().textContent = '\u2014';
    el.input().disabled = true;
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('practice-scripts-theme', isDark ? 'light' : 'dark');
  el.themeToggle().classList.toggle('dark', !isDark);
  el.themeToggle().classList.toggle('light', isDark);
}

function initTheme() {
  const saved = localStorage.getItem('practice-scripts-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved === 'dark' || (!saved && prefersDark);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  el.themeToggle().classList.add(isDark ? 'dark' : 'light');
}

function setupCustomSelect() {
  const select = el.select();

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

function init() {
  populateSelector();
  setupCustomSelect();
  initTheme();
  el.select().addEventListener('change', () => onLanguageChange(el.select().value));
  el.input().addEventListener('input', handleInput);
  el.giveup().addEventListener('click', giveUp);
  el.themeToggle().addEventListener('click', toggleTheme);
  if (el.select().value) onLanguageChange(el.select().value);
}

document.addEventListener('DOMContentLoaded', init);
