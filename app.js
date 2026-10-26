const $ = selector => document.querySelector(selector);
let stories = [], filter = 'all', priority = 'all', savedOnly = false, loading = false;
let saved;
try { saved = JSON.parse(localStorage.getItem('brief-saved') || '[]'); if (!Array.isArray(saved)) saved = []; } catch { saved = []; }
saved = saved.filter(s => s && typeof s.title === 'string' && typeof s.url === 'string' && /^https?:\/\//.test(s.url));
function stored(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; }
}
function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const previousVisit = stored('brief-last-visit', null);
const previousTime = typeof previousVisit === 'number' ? previousVisit : NaN;
let readItems = stored('brief-read', []);
const read = new Set(Array.isArray(readItems) ? readItems.filter(url => typeof url === 'string') : []);
let region = stored('brief-region', 'all');
if (!['all', 'us', 'uk', 'world'].includes(region)) region = 'all';
let readingView = 'all';
let automatic = stored('brief-automatic', true) !== false;
let nextUpdate = Date.now() + 300000;
$('#region').value = region;
$('#auto-update').checked = automatic;
function recordVisit() { if (stories.length) persist('brief-last-visit', Date.now()); }
function markRead(story, value = true) {
  if (value) read.add(story.url); else read.delete(story.url);
  persist('brief-read', [...read].slice(-2000));
}
$('#edition-date').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
$('#year').textContent = new Date().getFullYear();
function relative(date) {
  if (!date || !Number.isFinite(Date.parse(date))) return 'Latest';
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 60000));
  if (minutes < 60) return minutes < 1 ? 'Just now' : `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
function element(tag, className, text) {
  const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;
}
function sourceLink(story, text) {
  const a = element('a', '', text); a.href = story.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.addEventListener('click', () => { markRead(story); render(); }); return a;
}
const priorities = {
  critical: {label: 'Critical', description: 'Potentially urgent: major disruptions, emergencies, or immediate security threats.'},
  'worth-knowing': {label: 'Worth knowing', description: 'Developments in policy, elections, technology, and public affairs.'},
  interesting: {label: 'Interesting', description: 'Explainers, reviews, discoveries, and lighter reads for when you have time.'}
};
function importance(story) {
  // Headline-only rules avoid treating background context as a current emergency.
  const title = story.title.toLowerCase();
  const explainer = /\b(explained|explainer|review|opinion|how to|what is|why does|a guide|tips|podcast|interview)\b/.test(title);
  const urgent = /\b(state of emergency|emergency declared|declares? (?:a |an )?emergency|evacuation orders?|ordered to evacuate|martial law|military coup|ceasefire collapses|nationwide outage|widespread outage|actively exploited|zero-day under attack)\b/.test(title);
  if (urgent && !explainer) return 'critical';
  if (explainer || /\b(gadgets?|hands-on|first look|fun facts|photography|gaming|video games?|space telescope|new trailer)\b/.test(title)) return 'interesting';
  return 'worth-knowing';
}
function render() {
  $('#saved-count').textContent = saved.length;
  $('#all-count').textContent = stories.length;
  $('#saved-button').classList.toggle('active', savedOnly);
  $('#saved-button').setAttribute('aria-pressed', savedOnly);
  $('#section-title').replaceChildren(document.createTextNode(savedOnly ? 'Your saved stories' : filter === 'technology' ? 'In technology' : filter === 'politics' ? 'In politics' : 'The latest'), element('span', '', '.'));
  const query = $('#search').value.trim().toLowerCase();
  let visible = (savedOnly ? saved : stories).filter(s => (filter === 'all' || s.category === filter) && (s.category !== 'politics' || region === 'all' || Reader.region(s) === region) && (readingView !== 'new' || Reader.isNew(s, previousTime)) && (readingView !== 'unread' || !read.has(s.url)) && (priority === 'all' || importance(s) === priority) && `${s.title} ${s.summary} ${s.source}`.toLowerCase().includes(query));
  if (readingView === 'brief') visible = Reader.brief(visible, importance, read);
  const newCount = stories.filter(s => Reader.isNew(s, previousTime) && (s.category !== 'politics' || region === 'all' || Reader.region(s) === region)).length;
  $('#reading-summary').textContent = readingView === 'brief' ? `${visible.length} stories · a short selection to get you up to speed` : `${visible.length} stories · ${Number.isFinite(previousTime) ? `${newCount} new since your last visit` : 'Your first visit — welcome to your brief'}`;
  $('#stories').replaceChildren();
  for (const story of visible) {
    const card = element('article', `story${read.has(story.url) ? ' is-read' : ''}`);
    const top = element('div', 'story-top');
    const bookmark = element('button', 'bookmark');
    const isSaved = saved.some(s => s.url === story.url);
    bookmark.innerHTML = `<svg width="15" height="19" viewBox="0 0 16 20" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M3 2h10v16l-5-4-5 4z"/></svg>`;
    bookmark.setAttribute('aria-label', `${isSaved ? 'Unsave' : 'Save'} ${story.title}`);
    bookmark.setAttribute('aria-pressed', isSaved);
    bookmark.onclick = () => {
      saved = isSaved ? saved.filter(s => s.url !== story.url) : [...saved, story];
      try { localStorage.setItem('brief-saved', JSON.stringify(saved)); } catch { $('#notice').hidden = false; $('#notice').textContent = 'Browser storage is unavailable. Saved stories will last for this session.'; }
      render();
    };
    const labels = element('div', 'story-labels');
    const level = importance(story);
    const badge = element('span', `priority-badge ${level}`, priorities[level].label);
    badge.title = priorities[level].description + ' Automatically classified from the headline.';
    labels.append(element('span', `category ${story.category}`, story.category.toUpperCase()), badge);
    if (Reader.isNew(story, previousTime)) labels.append(element('span', 'new-badge', 'NEW'));
    top.append(labels, bookmark);
    const title = element('h3'); title.append(sourceLink(story, story.title));
    const footer = element('div', 'story-footer');
    const open = sourceLink(story, '↗'); open.setAttribute('aria-label', `Read full story at ${story.source}`);
    footer.append(element('span', 'source', story.source), element('span', '', '·'), element('time', '', relative(story.published)), open);
    card.append(top, title, element('p', '', story.summary || 'Read the full report at the original source.'), footer);
    const actions = element('div', 'story-actions');
    const readButton = element('button', 'read-button', read.has(story.url) ? '✓ Read · mark unread' : 'Mark as read');
    readButton.setAttribute('aria-pressed', String(read.has(story.url)));
    readButton.onclick = () => { markRead(story, !read.has(story.url)); render(); };
    actions.append(readButton);
    card.append(actions);
    const related = stories.filter(other => Reader.related(story, other) && (other.category !== 'politics' || region === 'all' || Reader.region(other) === region));
    if (related.length) {
      const details = element('details', 'related-coverage');
      details.append(element('summary', '', `Related coverage · ${new Set(related.map(s => s.source)).size} other source(s)`));
      details.append(element('p', '', 'Matched by headline similarity; reports may cover different details.'));
      for (const other of related.slice(0, 4)) details.append(sourceLink(other, `${other.source}: ${other.title}`));
      card.append(details);
    }
    $('#stories').append(card);
  }
  $('#empty').hidden = visible.length > 0 || loading;
  if (!visible.length && !loading) {
    const hasNews = (savedOnly ? saved : stories).length > 0;
    $('#empty-title').textContent = hasNews ? 'No matching stories.' : query ? 'No stories found.' : savedOnly ? 'Keep a little perspective.' : 'Your next update is on its way.';
    $('#empty-message').textContent = hasNews ? 'Try another region, reading view, topic, importance level, or search term.' : query ? 'Try a different keyword or explore another topic.' : savedOnly ? 'Use the bookmark on any story to save it here for later.' : 'We couldn’t reach the news feeds. Check your internet connection, then try again. Your brief refreshes automatically every five minutes.';
    $('#retry').hidden = hasNews || savedOnly || !!query;
  }
}
async function refresh() {
  if (loading) return;
  loading = true; $('#refresh').disabled = true; $('#status').textContent = 'Checking the headlines…'; $('#empty').hidden = true;
  if (!stories.length && !savedOnly) {
    $('#stories').replaceChildren(...Array.from({length: 6}, () => { const s = element('div', 'skeleton'); s.setAttribute('aria-hidden', 'true'); for (let i = 0; i < 6; i++) s.append(element('i')); return s; }));
  }
  try {
    if (location.protocol === 'file:') throw new Error('server');
    const response = await fetch('/api/news', {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('feed');
    const data = await response.json();
    if (!Array.isArray(data.stories)) throw new Error('feed');
    stories = data.stories;
    recordVisit();
    $('#status').textContent = stories.length ? data.stale ? 'Showing last available update' : `Updated ${new Date(data.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}` : 'Feeds currently unavailable';
    $('#notice').hidden = !data.unavailable?.length || !stories.length;
    $('#notice').textContent = data.stale ? 'Live feeds are temporarily unavailable. These are stories from the last successful update.' : 'Some sources are temporarily unavailable. Showing stories from the sources we could reach.';
  } catch (error) {
    $('#status').textContent = stories.length ? 'Update unavailable · previous stories shown' : 'Unable to connect';
    if (error.message === 'server') { $('#notice').hidden = false; $('#notice').textContent = 'Start the local server with “python3 server.py”, then visit http://localhost:8000 to receive live news.'; }
  } finally { loading = false; nextUpdate = Date.now() + 300000; $('#refresh').disabled = false; render(); updateCountdown(); }
}
document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
  render();
});
document.querySelectorAll('[data-priority]').forEach(button => button.onclick = () => {
  priority = button.dataset.priority;
  document.querySelectorAll('[data-priority]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
  render();
});
$('#search').addEventListener('input', render);
$('#saved-button').onclick = () => { savedOnly = !savedOnly; render(); };
$('#refresh').onclick = refresh;
$('#retry').onclick = refresh;
$('#region').onchange = event => { region = event.target.value; persist('brief-region', region); render(); };
$('#reading-view').onchange = event => { readingView = event.target.value; render(); };
$('#auto-update').onchange = event => {
  automatic = event.target.checked;
  persist('brief-automatic', automatic);
  if (automatic) refresh();
  updateCountdown();
};
function updateCountdown() {
  const seconds = Math.max(0, Math.ceil((nextUpdate - Date.now()) / 1000));
  $('#next-update').textContent = !automatic ? 'Automatic updates paused' : !navigator.onLine ? 'Offline · reconnecting automatically' : loading ? 'Checking sources…' : `Next check in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
render(); refresh();
setInterval(() => {
  if (automatic && !document.hidden && navigator.onLine && Date.now() >= nextUpdate) refresh();
  updateCountdown();
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) recordVisit();
  else if (automatic) refresh();
});
window.addEventListener('online', () => { if (automatic) refresh(); updateCountdown(); });
window.addEventListener('offline', updateCountdown);
window.addEventListener('pagehide', recordVisit);
