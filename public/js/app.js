const state = {
  user: null,
  venues: [],
  signedUpEventIds: [],
  eventTypes: [],
  activeFilter: null,
  authMode: 'login', // 'login' | 'register'
  view: 'app', // 'app' | 'map' | 'contact'
  mapVenues: [],
  selectedMapSlug: null,
  locale: localStorage.getItem('izlazns-locale') === 'en' ? 'en' : 'sr'
};

document.documentElement.lang = state.locale;

const appEl = document.getElementById('app');
const topbarActions = document.getElementById('topbar-actions');
const mainNavEl = document.getElementById('main-nav');
const modalRoot = document.getElementById('modal-root');

document.addEventListener('click', (e) => {
  const menu = document.getElementById('user-menu');
  const panel = document.getElementById('user-menu-panel');
  if (menu && panel && !menu.contains(e.target)) panel.hidden = true;
});

// ---------- Confetti burst on click / tap ----------
const CONFETTI_COLORS = ['#f0ba3f', '#9478dd', '#6fa895', '#f1ecfb', '#c99626'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let confettiLayer = null;

function getConfettiLayer() {
  if (!confettiLayer) {
    confettiLayer = document.createElement('div');
    confettiLayer.className = 'confetti-layer';
    document.body.appendChild(confettiLayer);
  }
  return confettiLayer;
}

function burstConfetti(x, y) {
  if (reduceMotion) return;
  const layer = getConfettiLayer();
  const count = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    const size = 5 + Math.random() * 5;
    piece.style.width = size + 'px';
    piece.style.height = (size * (0.5 + Math.random() * 0.8)) + 'px';
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.left = x + 'px';
    piece.style.top = y + 'px';
    layer.appendChild(piece);

    const angle = Math.random() * Math.PI * 2;
    const distance = 36 + Math.random() * 64;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 18;
    const rot = Math.random() * 540 - 270;

    const anim = piece.animate([
      { transform: 'translate(-50%, -50%) translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 }
    ], { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    anim.onfinish = () => piece.remove();
  }
}

document.addEventListener('pointerdown', (e) => {
  burstConfetti(e.clientX, e.clientY);
});

function t(key) {
  return (UI[state.locale] && UI[state.locale][key]) || UI.sr[key] || key;
}

function venueTypeLabel(key) {
  return (VENUE_TYPE_LABELS[key] && VENUE_TYPE_LABELS[key][state.locale]) || key;
}

function eventTypeLabel(key) {
  return (EVENT_TYPE_LABELS[key] && EVENT_TYPE_LABELS[key][state.locale]) || key;
}

function localized(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[state.locale] || obj.sr || '';
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  const dayName = DAY_NAMES[state.locale][d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dayName}, ${dd}.${mm}.${yyyy}. ${t('day_at')} ${hh}:${min}`;
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'jfif'];

function handleImgError(img) {
  const slug = img.dataset.slug;
  const i = Number(img.dataset.extI) + 1;
  if (i < IMAGE_EXTS.length) {
    img.dataset.extI = i;
    img.src = `/assets/venues/${slug}.${IMAGE_EXTS[i]}`;
  } else {
    img.onerror = null;
    img.src = `/assets/venues/${slug}.svg`;
  }
}

function venueImageTag(venue) {
  const slug = venue.slug;
  return `<img src="/assets/venues/${slug}.${IMAGE_EXTS[0]}" data-slug="${slug}" data-ext-i="0"
    alt="${venue.name}" onerror="handleImgError(this)" />`;
}

function personIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="8" r="4.2"/>
    <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7v1H4v-1z"/>
  </svg>`;
}

function caretIcon() {
  return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6"/>
  </svg>`;
}

function chatIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/>
  </svg>`;
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return '0 min';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

// ---------- Loading screen ----------

function initLoader() {
  const label = document.querySelector('.loader-label');
  if (label) label.textContent = t('loading_label');

  const path = document.getElementById('squiggle');
  if (path && path.getTotalLength) {
    const len = path.getTotalLength();
    path.style.setProperty('--len', len);
    path.style.strokeDasharray = len;
  }
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;
  const squiggle = document.getElementById('squiggle');
  if (squiggle) squiggle.classList.add('squiggle-done');
  loader.classList.add('loader-exit');
  setTimeout(() => {
    loader.classList.add('loader-hidden');
  }, 260);
}

// ---------- Nav & language ----------

function renderNav() {
  mainNavEl.innerHTML = `
    <button type="button" data-nav="app" class="${state.view === 'app' ? 'active' : ''}">${t('nav_home')}</button>
    <button type="button" data-nav="map" class="${state.view === 'map' ? 'active' : ''}">${t('nav_map')}</button>
    <button type="button" data-nav="forum" class="${state.view === 'forum' ? 'active' : ''}">${t('nav_forum')}</button>
    <button type="button" data-nav="contact" class="${state.view === 'contact' ? 'active' : ''}">${t('nav_contact')}</button>
  `;
  mainNavEl.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => {
      state.view = btn.dataset.nav;
      renderAll(false);
    };
  });
}

function langSwitchHtml() {
  return `
    <span class="lang-switch">
      <button type="button" data-lang="sr" class="${state.locale === 'sr' ? 'active' : ''}">SR</button>
      <button type="button" data-lang="en" class="${state.locale === 'en' ? 'active' : ''}">EN</button>
    </span>`;
}

function wireLangSwitch(root) {
  root.querySelectorAll('[data-lang]').forEach(btn => {
    btn.onclick = () => setLocale(btn.dataset.lang);
  });
}

function setLocale(locale) {
  if (state.locale === locale) return;
  state.locale = locale;
  localStorage.setItem('izlazns-locale', locale);
  document.documentElement.lang = locale;
  renderAll(false);
}

function renderAll(animateCards) {
  renderNav();
  renderTopbar();
  if (state.view === 'contact') {
    renderContact();
  } else if (state.view === 'map') {
    renderMapPage();
  } else if (state.view === 'forum') {
    renderForum();
  } else if (state.user) {
    renderMain(animateCards);
  } else {
    renderAuth();
  }
}

// ---------- Rendering ----------

function renderTopbar() {
  if (!state.user) {
    topbarActions.innerHTML = langSwitchHtml();
    wireLangSwitch(topbarActions);
    return;
  }
  const subscribed = state.user.subscribed;
  topbarActions.innerHTML = `
    ${langSwitchHtml()}
    <div class="user-menu" id="user-menu">
      <button type="button" class="user-menu-btn" id="user-menu-btn" aria-label="${state.user.name}">
        ${personIcon()} <span class="um-name">${state.user.name}</span> ${caretIcon()}
      </button>
      <div class="user-menu-panel" id="user-menu-panel" hidden>
        <div class="user-menu-status ${subscribed ? 'active' : ''}">
          ${subscribed ? t('pill_subscribed') : t('pill_not_subscribed')}
        </div>
        ${!subscribed ? `<button class="btn btn-primary btn-block" id="btn-sub-top">${t('btn_subscribe_top')}</button>` : ''}
        <button class="btn btn-ghost btn-block" id="btn-logout">${t('btn_logout')}</button>
      </div>
    </div>
  `;
  wireLangSwitch(topbarActions);

  const menuBtn = document.getElementById('user-menu-btn');
  const panel = document.getElementById('user-menu-panel');

  menuBtn.onclick = (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
  };

  document.getElementById('btn-logout').onclick = logout;
  const subBtn = document.getElementById('btn-sub-top');
  if (subBtn) subBtn.onclick = () => { panel.hidden = true; openSubscribeModal(); };
}

function renderAuth() {
  const isLogin = state.authMode === 'login';
  appEl.innerHTML = `
    <div class="auth-wrap">
      <h2>${isLogin ? t('auth_login_title') : t('auth_register_title')}</h2>
      <p class="sub">${isLogin ? t('auth_login_sub') : t('auth_register_sub')}</p>
      <div id="auth-error"></div>
      <form id="auth-form">
        ${!isLogin ? `
        <div class="field">
          <label>${t('field_name')}</label>
          <input type="text" id="f-name" required />
        </div>` : ''}
        <div class="field">
          <label>${t('field_email')}</label>
          <input type="email" id="f-email" required />
        </div>
        <div class="field">
          <label>${t('field_password')}</label>
          <input type="password" id="f-password" required minlength="6" />
        </div>
        <button class="btn btn-primary btn-block" type="submit">${isLogin ? t('btn_login') : t('btn_register')}</button>
      </form>
      <div class="auth-switch">
        ${isLogin ? t('auth_switch_q_login') : t('auth_switch_q_register')}
        <span id="auth-switch-btn">${isLogin ? t('btn_register') : t('btn_login')}</span>
      </div>
    </div>
  `;

  document.getElementById('auth-switch-btn').onclick = () => {
    state.authMode = isLogin ? 'register' : 'login';
    renderAuth();
  };

  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('f-email').value.trim();
    const password = document.getElementById('f-password').value;
    const name = isLogin ? null : document.getElementById('f-name').value.trim();
    try {
      const data = isLogin
        ? await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) })
        : await api('/api/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      state.user = data.user;
      renderTopbar();
      await loadVenues();
      renderMain(true);
    } catch (err) {
      document.getElementById('auth-error').innerHTML =
        `<div class="error-msg">${err.error || t('toast_generic_error')}</div>`;
    }
  };
}

function renderFilterBar() {
  return `
    <div class="filterbar">
      <button class="chip ${!state.activeFilter ? 'active' : ''}" data-filter="">${t('filter_all')}</button>
      ${state.eventTypes.map(type => {
        const active = state.activeFilter === type;
        return `<button class="chip ${active ? 'active' : ''}" data-filter="${type}">${eventTypeLabel(type)}</button>`;
      }).join('')}
    </div>
  `;
}

function renderVenueCard(venue, index = 0, animate = true) {
  const eventsHtml = venue.events.length
    ? venue.events.map(ev => {
        const signedUp = state.signedUpEventIds.includes(ev.id);
        return `
        <div class="event-row">
          <div class="event-row-top">
            <span class="event-type">${eventTypeLabel(ev.type)}</span>
          </div>
          <div class="event-title">${localized(ev.title)}</div>
          <div class="event-time">🗓 ${fmtDateTime(ev.datetime)}</div>
          <div class="event-desc">${localized(ev.description)}</div>
          <div class="event-actions">
            <button type="button" class="event-chat-btn" data-chat="${ev.id}" data-chat-title="${localized(ev.title)}" aria-label="${t('chat_btn_label')}">
              ${chatIcon()}
            </button>
            ${signedUp
              ? `<button class="btn btn-sub" data-cancel="${ev.id}">${t('event_cancel_btn')}</button>`
              : `<button class="btn btn-primary" data-signup="${ev.id}">${t('event_signup_btn')}</button>`}
          </div>
        </div>`;
      }).join('')
    : `<div class="no-events">${t('no_events')}</div>`;

  return `
    <div class="card ${animate ? 'card-anim' : ''}" style="--d:${index * 45}ms">
      <div class="card-img-wrap">
        ${venueImageTag(venue)}
        <span class="card-type">${venueTypeLabel(venue.type)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${venue.name}</h3>
        <p class="card-address">📍 ${venue.address}</p>
        ${eventsHtml}
      </div>
    </div>
  `;
}

function renderMain(animateCards = true) {
  appEl.innerHTML = `
    <div class="hero">
      <h1>${t('hero_title')}</h1>
      <p>${t('hero_subtitle')}</p>
    </div>
    ${renderFilterBar()}
    <div class="grid" id="venues-grid"></div>
    <div class="footer-note">${t('footer_note')}</div>
  `;

  const grid = document.getElementById('venues-grid');
  grid.innerHTML = state.venues.map((v, i) => renderVenueCard(v, i, animateCards)).join('');
  wireVenueCardEvents(grid);

  document.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      chip.classList.add('chip-pop');
      switchFilter(chip.dataset.filter || null);
    };
  });
}

function wireVenueCardEvents(container) {
  container.querySelectorAll('[data-signup]').forEach(btn => {
    btn.onclick = () => signupForEvent(Number(btn.dataset.signup));
  });
  container.querySelectorAll('[data-cancel]').forEach(btn => {
    btn.onclick = () => cancelSignup(Number(btn.dataset.cancel));
  });
  container.querySelectorAll('[data-chat]').forEach(btn => {
    btn.onclick = () => openChatModal(Number(btn.dataset.chat), btn.dataset.chatTitle);
  });
}

async function switchFilter(value) {
  if (state.activeFilter === value) return;
  state.activeFilter = value;

  const grid = document.getElementById('venues-grid');
  if (grid) {
    grid.classList.add('grid-swapping');
    await new Promise(r => setTimeout(r, 160));
  }

  await loadVenues();
  renderMain(true);
}

// ---------- Map page ----------

let leafletMap = null;

async function renderMapPage() {
  appEl.innerHTML = `
    <div class="hero">
      <h1>${t('map_title')}</h1>
      <p>${t('map_subtitle')}</p>
    </div>
    <div class="map-layout">
      <div id="leaflet-map" class="leaflet-map"></div>
      <div class="map-side" id="map-side">
        <div class="map-side-placeholder">${t('map_placeholder')}</div>
      </div>
    </div>
  `;

  if (!state.mapVenues.length) {
    const data = await api('/api/venues');
    state.mapVenues = data.venues;
    state.signedUpEventIds = data.signedUpEventIds;
  }

  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }

  leafletMap = L.map('leaflet-map', { scrollWheelZoom: false }).setView([45.2552, 19.8451], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(leafletMap);

  const pinIcon = L.divIcon({
    className: 'map-pin',
    html: '<span></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  });

  state.mapVenues.forEach(venue => {
    if (venue.lat == null || venue.lng == null) return;
    const marker = L.marker([venue.lat, venue.lng], { icon: pinIcon, title: venue.name }).addTo(leafletMap);
    marker.on('click', () => selectMapVenue(venue.slug));
  });

  if (state.selectedMapSlug) {
    selectMapVenue(state.selectedMapSlug, true);
  }
}

function selectMapVenue(slug, skipPan) {
  state.selectedMapSlug = slug;
  const venue = state.mapVenues.find(v => v.slug === slug);
  if (!venue) return;

  const side = document.getElementById('map-side');
  if (side) {
    side.innerHTML = renderVenueCard(venue, 0, false);
    wireVenueCardEvents(side);
  }

  if (!skipPan && leafletMap) {
    leafletMap.panTo([venue.lat, venue.lng]);
  }
}

function refreshCurrentView() {
  if (state.view === 'map' && state.selectedMapSlug) {
    selectMapVenue(state.selectedMapSlug, true);
  } else {
    renderMain(false);
  }
}

// ---------- Contact page ----------

function renderContact() {
  appEl.innerHTML = `
    <div class="contact-wrap">
      <h2>${t('contact_title')}</h2>
      <p class="sub">${t('contact_sub')}</p>
      <div id="contact-error"></div>
      <div id="contact-success"></div>
      <form id="contact-form">
        <div class="field">
          <label>${t('field_name')}</label>
          <input type="text" id="c-name" required />
        </div>
        <div class="field">
          <label>${t('field_email')}</label>
          <input type="email" id="c-email" required />
        </div>
        <div class="field">
          <label>${t('field_message')}</label>
          <textarea id="c-message" required></textarea>
        </div>
        <button class="btn btn-primary btn-block" type="submit">${t('btn_send')}</button>
      </form>
      <div class="contact-info">${t('contact_info')} <strong>kontakt@izlazns.rs</strong></div>
    </div>
  `;

  document.getElementById('contact-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('c-name').value.trim();
    const email = document.getElementById('c-email').value.trim();
    const message = document.getElementById('c-message').value.trim();
    try {
      await api('/api/contact', { method: 'POST', body: JSON.stringify({ name, email, message }) });
      showToast(t('toast_contact_sent'));
      renderContact();
    } catch (err) {
      document.getElementById('contact-error').innerHTML =
        `<div class="error-msg">${err.error || t('toast_generic_error')}</div>`;
    }
  };
}

// ---------- Forum ----------

function renderForumPost(post) {
  return `
    <div class="forum-post">
      <div class="forum-post-head">
        <span class="forum-author">${post.authorName}</span>
        <span class="forum-time">${timeAgo(post.createdAt)}</span>
      </div>
      <p class="forum-text">${post.text}</p>
    </div>
  `;
}

async function renderForum() {
  appEl.innerHTML = `
    <div class="hero">
      <h1>${t('forum_title')}</h1>
      <p>${t('forum_subtitle')}</p>
    </div>
    <div class="forum-wrap">
      ${state.user ? `
        <form id="forum-form" class="forum-form">
          <textarea id="forum-text" placeholder="${t('forum_placeholder')}" required></textarea>
          <button class="btn btn-primary" type="submit">${t('btn_post')}</button>
        </form>
      ` : `<div class="forum-login-hint">${t('forum_login_hint')}</div>`}
      <div class="forum-list" id="forum-list"></div>
    </div>
  `;

  if (state.user) {
    document.getElementById('forum-form').onsubmit = async (e) => {
      e.preventDefault();
      const textEl = document.getElementById('forum-text');
      const text = textEl.value.trim();
      if (!text) return;
      try {
        await api('/api/forum', { method: 'POST', body: JSON.stringify({ text }) });
        textEl.value = '';
        showToast(t('toast_post_sent'));
        await loadAndRenderForumList();
      } catch (err) {
        showToast(err.error || t('toast_generic_error'));
      }
    };
  }

  await loadAndRenderForumList();
}

async function loadAndRenderForumList() {
  const list = document.getElementById('forum-list');
  if (!list) return;
  const data = await api('/api/forum');
  list.innerHTML = data.posts.length
    ? data.posts.map(renderForumPost).join('')
    : `<div class="no-events">${t('forum_empty')}</div>`;
}

// ---------- Event chat ----------

function renderChatMsg(msg) {
  return `
    <div class="chat-msg">
      <span class="chat-msg-author">${msg.authorName}</span>
      <p class="chat-msg-text">${msg.text}</p>
      <span class="chat-msg-time">${timeAgo(msg.createdAt)}</span>
    </div>
  `;
}

async function openChatModal(eventId, eventTitle) {
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box modal-box-chat">
        <h3>${t('chat_title')}</h3>
        <p class="sub">${eventTitle}</p>
        <div class="chat-messages" id="chat-messages"></div>
        ${state.user ? `
          <form id="chat-form" class="chat-input-row">
            <input type="text" id="chat-input" placeholder="${t('chat_placeholder')}" required />
            <button class="btn btn-primary" type="submit">${t('chat_send')}</button>
          </form>
        ` : `<div class="forum-login-hint">${t('chat_login_hint')}</div>`}
        <button class="btn btn-ghost btn-block" id="modal-cancel">${t('modal_cancel')}</button>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').onclick = (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  };
  document.getElementById('modal-cancel').onclick = closeModal;

  const messagesEl = document.getElementById('chat-messages');
  const data = await api(`/api/events/${eventId}/chat`);
  messagesEl.innerHTML = data.messages.length
    ? data.messages.map(renderChatMsg).join('')
    : `<div class="no-events">${t('chat_empty')}</div>`;
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const form = document.getElementById('chat-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;
      try {
        await api(`/api/events/${eventId}/chat`, { method: 'POST', body: JSON.stringify({ text }) });
        input.value = '';
        const refreshed = await api(`/api/events/${eventId}/chat`);
        messagesEl.innerHTML = refreshed.messages.map(renderChatMsg).join('');
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } catch (err) {
        showToast(err.error || t('toast_generic_error'));
      }
    };
  }
}

// ---------- Modals ----------

function openSubscribeModal() {
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <h3>${t('modal_title')}</h3>
        <div class="price-tag">5.99€ <span>${t('modal_price_suffix')}</span></div>
        <ul class="modal-features">
          <li>${t('modal_feature1')}</li>
          <li>${t('modal_feature2')}</li>
          <li>${t('modal_feature3')}</li>
        </ul>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-block" id="modal-cancel">${t('modal_cancel')}</button>
          <button class="btn btn-primary btn-block" id="modal-confirm">${t('modal_confirm')}</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').onclick = (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  };
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-confirm').onclick = async () => {
    const data = await api('/api/subscribe', { method: 'POST' });
    state.user = data.user;
    closeModal();
    renderTopbar();
    refreshCurrentView();
    showToast(t('toast_subscribed'));
  };
}

function closeModal() {
  modalRoot.innerHTML = '';
}

// ---------- Actions ----------

async function signupForEvent(eventId) {
  if (!state.user) {
    state.view = 'app';
    renderAll(false);
    return;
  }
  if (!state.user.subscribed) {
    openSubscribeModal();
    return;
  }
  try {
    await api(`/api/events/${eventId}/signup`, { method: 'POST' });
    state.signedUpEventIds.push(eventId);
    refreshCurrentView();
    showToast(t('toast_signed_up'));
  } catch (err) {
    if (err.status === 402) {
      openSubscribeModal();
    } else {
      showToast(err.error || t('toast_generic_error'));
    }
  }
}

async function cancelSignup(eventId) {
  await api(`/api/events/${eventId}/cancel`, { method: 'POST' });
  state.signedUpEventIds = state.signedUpEventIds.filter(id => id !== eventId);
  refreshCurrentView();
  showToast(t('toast_cancelled'));
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  state.user = null;
  renderTopbar();
  state.authMode = 'login';
  state.view = 'app';
  renderNav();
  renderAuth();
}

async function loadVenues() {
  const qs = state.activeFilter ? `?type=${encodeURIComponent(state.activeFilter)}` : '';
  const data = await api(`/api/venues${qs}`);
  state.venues = data.venues;
  state.signedUpEventIds = data.signedUpEventIds;
}

async function loadEventTypes() {
  const data = await api('/api/event-types');
  state.eventTypes = data.types;
}

// ---------- Init ----------

(async function init() {
  initLoader();
  const minDelay = new Promise(r => setTimeout(r, 900));

  const me = await api('/api/me');
  state.user = me.user;
  renderNav();
  renderTopbar();

  await loadEventTypes();

  if (state.user) {
    await loadVenues();
    renderMain(true);
  } else {
    renderAuth();
  }

  await minDelay;
  hideLoader();
})();
