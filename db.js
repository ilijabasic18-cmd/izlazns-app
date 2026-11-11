const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const VENUES_SEED = path.join(__dirname, 'data', 'venues-seed.json');
const EVENTS_SEED = path.join(__dirname, 'data', 'events-seed.json');
const FORUM_SEED = path.join(__dirname, 'data', 'forum-seed.json');
const CHAT_SEED = path.join(__dirname, 'data', 'chat-seed.json');

function nextId(items) {
  return items.reduce((max, it) => Math.max(max, it.id), 0) + 1;
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    seed();
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function seed() {
  const venuesSeed = JSON.parse(fs.readFileSync(VENUES_SEED, 'utf8'));
  const eventsSeed = JSON.parse(fs.readFileSync(EVENTS_SEED, 'utf8'));

  const venues = venuesSeed.map((v, i) => ({ id: i + 1, ...v }));
  const slugToId = Object.fromEntries(venues.map(v => [v.slug, v.id]));

  const events = eventsSeed.map((e, i) => ({
    id: i + 1,
    venueId: slugToId[e.venueSlug],
    type: e.type,
    title: e.title,
    datetime: e.datetime,
    description: e.description
  }));

  const forumSeed = JSON.parse(fs.readFileSync(FORUM_SEED, 'utf8'));
  const chatSeed = JSON.parse(fs.readFileSync(CHAT_SEED, 'utf8'));
  const forumPosts = forumSeed.map((p, i) => ({ id: i + 1, ...p }));
  const chatMessages = chatSeed.map((m, i) => ({ id: i + 1, ...m }));

  const db = { users: [], venues, events, signups: [], messages: [], forumPosts, chatMessages };
  save(db);
}

// --- Users ---
function getUserByEmail(email) {
  const db = load();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function getUserById(id) {
  const db = load();
  return db.users.find(u => u.id === id);
}

function createUser({ name, email, passwordHash }) {
  const db = load();
  const user = {
    id: nextId(db.users),
    name,
    email,
    passwordHash,
    subscribed: false,
    subscribedUntil: null
  };
  db.users.push(user);
  save(db);
  return user;
}

function setSubscribed(userId, subscribed) {
  const db = load();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  user.subscribed = subscribed;
  if (subscribed) {
    const until = new Date();
    until.setDate(until.getDate() + 30);
    user.subscribedUntil = until.toISOString();
  } else {
    user.subscribedUntil = null;
  }
  save(db);
  return user;
}

// --- Venues & events ---
function getEventTypes() {
  const db = load();
  return [...new Set(db.events.map(e => e.type))].sort();
}

function getVenuesWithEvents(typeFilter) {
  const db = load();
  const now = Date.now();

  return db.venues.map(venue => {
    let venueEvents = db.events
      .filter(e => e.venueId === venue.id)
      .filter(e => new Date(e.datetime).getTime() >= now - 1000 * 60 * 60 * 6)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    if (typeFilter) {
      venueEvents = venueEvents.filter(e => e.type === typeFilter);
    }

    return { ...venue, events: venueEvents };
  }).filter(v => !typeFilter || v.events.length > 0);
}

function getEventById(eventId) {
  const db = load();
  const event = db.events.find(e => e.id === eventId);
  if (!event) return null;
  const venue = db.venues.find(v => v.id === event.venueId);
  return { ...event, venue };
}

// --- Signups ---
function signupForEvent(userId, eventId) {
  const db = load();
  const exists = db.signups.find(s => s.userId === userId && s.eventId === eventId);
  if (exists) return { alreadySignedUp: true, signup: exists };

  const signup = {
    id: nextId(db.signups),
    userId,
    eventId,
    createdAt: new Date().toISOString()
  };
  db.signups.push(signup);
  save(db);
  return { alreadySignedUp: false, signup };
}

function cancelSignup(userId, eventId) {
  const db = load();
  const before = db.signups.length;
  db.signups = db.signups.filter(s => !(s.userId === userId && s.eventId === eventId));
  save(db);
  return db.signups.length !== before;
}

function getUserSignups(userId) {
  const db = load();
  const signups = db.signups.filter(s => s.userId === userId);
  return signups.map(s => {
    const event = db.events.find(e => e.id === s.eventId);
    const venue = db.venues.find(v => v.id === event.venueId);
    return { ...event, venue, signedUpAt: s.createdAt };
  }).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
}

function getSignupCountForEvent(eventId) {
  const db = load();
  return db.signups.filter(s => s.eventId === eventId).length;
}

// --- Forum (oglasi) ---
function getForumPosts() {
  const db = load();
  const posts = db.forumPosts || [];
  return [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function addForumPost({ authorName, text }) {
  const db = load();
  if (!db.forumPosts) db.forumPosts = [];
  const post = {
    id: nextId(db.forumPosts),
    authorName,
    text,
    replies: [],
    createdAt: new Date().toISOString()
  };
  db.forumPosts.push(post);
  save(db);
  return post;
}

function addForumReply(postId, { authorName, text }) {
  const db = load();
  const post = (db.forumPosts || []).find(p => p.id === postId);
  if (!post) return null;
  if (!post.replies) post.replies = [];
  const reply = {
    id: nextId(post.replies),
    authorName,
    text,
    createdAt: new Date().toISOString()
  };
  post.replies.push(reply);
  save(db);
  return reply;
}

// --- Event chat ---
function getChatMessages(eventId) {
  const db = load();
  const messages = db.chatMessages || [];
  return messages
    .filter(m => m.eventId === eventId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function addChatMessage({ eventId, authorName, text }) {
  const db = load();
  if (!db.chatMessages) db.chatMessages = [];
  const msg = {
    id: nextId(db.chatMessages),
    eventId,
    authorName,
    text,
    createdAt: new Date().toISOString()
  };
  db.chatMessages.push(msg);
  save(db);
  return msg;
}

// --- Contact messages ---
function addContactMessage({ name, email, message }) {
  const db = load();
  if (!db.messages) db.messages = [];
  const entry = {
    id: nextId(db.messages),
    name,
    email,
    message,
    createdAt: new Date().toISOString()
  };
  db.messages.push(entry);
  save(db);
  return entry;
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  setSubscribed,
  getEventTypes,
  getVenuesWithEvents,
  getEventById,
  signupForEvent,
  cancelSignup,
  getUserSignups,
  getSignupCountForEvent,
  addContactMessage,
  getForumPosts,
  addForumPost,
  addForumReply,
  getChatMessages,
  addChatMessage
};
