const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: 'novisad-events-prototype-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

// --- Simulated chat participant ---
// Note: this is a scripted responder (templated replies), not a live AI model call.
const CHAT_BOT_PERSONAS = ['Nemanja Ilić', 'Milica Radovanović', 'Aleksandar Jovanović', 'Jelena Mitrović'];

function pickBotPersona(eventId) {
  return CHAT_BOT_PERSONAS[eventId % CHAT_BOT_PERSONAS.length];
}

function generateBotReply(userText, event) {
  const lower = userText.toLowerCase();
  const venueName = event.venue ? event.venue.name : '';
  const title = typeof event.title === 'object' ? (event.title.sr || event.title.en) : event.title;

  if (/kada|vreme|sat|počinj/.test(lower)) {
    const d = new Date(event.datetime);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `Koliko znam, počinje u ${hh}:${min}, al' dođite malo ranije za bolja mesta 😊`;
  }
  if (/cena|ulaz|plać|novac|košta/.test(lower)) {
    return 'Mislim da je ulaz slobodan, ali najbolje je proveriti na licu mesta.';
  }
  if (/ekipa|tim|partner|solo|sam\b|sama\b/.test(lower)) {
    return 'Ja bih se priključio/la, samo recite gde i kada da dođem!';
  }
  if (/gde|adresa|lokacij/.test(lower)) {
    return venueName ? `Dešava se u ${venueName}, vidimo se tamo!` : 'Proverite adresu lokala u opisu događaja.';
  }

  const generic = [
    'Ja definitivno dolazim, vidimo se tamo! 🙌',
    `Čuo/la sam da je prošli put na "${title}" bilo odlično, jedva čekam!`,
    'Nisam još sigur(na), ali javiću se čim znam.',
    'Ko ide, nek se javi ovde da se nađemo pre početka!',
    'Super ideja, računajte i na mene.',
    'Hvala na info, vidimo se tamo!'
  ];
  return generic[Math.floor(Math.random() * generic.length)];
}

function scheduleBotReply(eventId, userText) {
  const delay = 1400 + Math.random() * 1600;
  setTimeout(() => {
    const event = db.getEventById(eventId);
    if (!event) return;
    const persona = pickBotPersona(eventId);
    const reply = generateBotReply(userText, event);
    db.addChatMessage({ eventId, authorName: persona, text: reply });
  }, delay);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Niste ulogovani.' });
  next();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    subscribed: user.subscribed,
    subscribedUntil: user.subscribedUntil
  };
}

// --- Auth ---
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Popuni ime, email i lozinku.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Lozinka mora imati bar 6 karaktera.' });
  }
  if (db.getUserByEmail(email)) {
    return res.status(409).json({ error: 'Nalog sa ovim email-om već postoji.' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = db.createUser({ name, email, passwordHash });
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.getUserByEmail(email || '');
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Pogrešan email ili lozinka.' });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.getUserById(req.session.userId);
  res.json({ user: publicUser(user) });
});

// --- Subscription (mock payment) ---
app.post('/api/subscribe', requireAuth, (req, res) => {
  // Prototip: nema stvarne naplate. Ovde bi isla Stripe integracija.
  const user = db.setSubscribed(req.session.userId, true);
  res.json({ user: publicUser(user) });
});

app.post('/api/unsubscribe', requireAuth, (req, res) => {
  const user = db.setSubscribed(req.session.userId, false);
  res.json({ user: publicUser(user) });
});

// --- Venues & events ---
app.get('/api/event-types', (req, res) => {
  res.json({ types: db.getEventTypes() });
});

app.get('/api/venues', (req, res) => {
  const type = req.query.type || null;
  const venues = db.getVenuesWithEvents(type);
  let signedUpEventIds = [];
  if (req.session.userId) {
    signedUpEventIds = db.getUserSignups(req.session.userId).map(e => e.id);
  }
  res.json({ venues, signedUpEventIds });
});

// --- Signups ---
app.post('/api/events/:id/signup', requireAuth, (req, res) => {
  const eventId = Number(req.params.id);
  const event = db.getEventById(eventId);
  if (!event) return res.status(404).json({ error: 'Događaj ne postoji.' });

  const user = db.getUserById(req.session.userId);
  if (!user.subscribed) {
    return res.status(402).json({ error: 'Potrebna je aktivna pretplata za prijavu na događaje.' });
  }

  const result = db.signupForEvent(req.session.userId, eventId);
  res.json({ ok: true, alreadySignedUp: result.alreadySignedUp });
});

app.post('/api/events/:id/cancel', requireAuth, (req, res) => {
  const eventId = Number(req.params.id);
  db.cancelSignup(req.session.userId, eventId);
  res.json({ ok: true });
});

app.get('/api/my-signups', requireAuth, (req, res) => {
  res.json({ signups: db.getUserSignups(req.session.userId) });
});

// --- Forum (oglasi) ---
app.get('/api/forum', (req, res) => {
  res.json({ posts: db.getForumPosts() });
});

app.post('/api/forum', requireAuth, (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Unesi tekst oglasa.' });
  }
  const user = db.getUserById(req.session.userId);
  const post = db.addForumPost({ authorName: user.name, text: text.trim() });
  res.json({ post });
});

app.post('/api/forum/:id/reply', requireAuth, (req, res) => {
  const postId = Number(req.params.id);
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Unesi tekst odgovora.' });
  }
  const user = db.getUserById(req.session.userId);
  const reply = db.addForumReply(postId, { authorName: user.name, text: text.trim() });
  if (!reply) return res.status(404).json({ error: 'Oglas ne postoji.' });
  res.json({ reply });
});

// --- Event chat ---
app.get('/api/events/:id/chat', (req, res) => {
  const eventId = Number(req.params.id);
  res.json({ messages: db.getChatMessages(eventId) });
});

app.post('/api/events/:id/chat', requireAuth, (req, res) => {
  const eventId = Number(req.params.id);
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Unesi poruku.' });
  }
  const user = db.getUserById(req.session.userId);
  const msg = db.addChatMessage({ eventId, authorName: user.name, text: text.trim() });
  scheduleBotReply(eventId, text.trim());
  res.json({ message: msg });
});

// --- Contact ---
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Popuni ime, email i poruku.' });
  }
  db.addContactMessage({ name, email, message });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Novi Sad Events app pokrenuta na http://localhost:${PORT}`);
});
