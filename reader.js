/* Shared reader rules; no network or browser state. */
const Reader = {
  region(story) { return story.region || (story.source === 'NPR' ? 'us' : story.category === 'politics' ? 'uk' : 'world'); },
  isNew(story, previousVisit, now = Date.now()) {
    const date = Date.parse(story.published);
    return Number.isFinite(previousVisit) && Number.isFinite(date) && date > previousVisit && date <= now;
  },
  related(a, b) {
    if (a.source === b.source || a.category !== b.category || a.url === b.url) return false;
    const dates = [Date.parse(a.published), Date.parse(b.published)];
    if (dates.some(d => !Number.isFinite(d)) || Math.abs(dates[0] - dates[1]) > 172800000) return false;
    const stop = new Set('about after again against amid before being could first from have into more news over says that their them there these they this through under what when where which will with would'.split(' '));
    const tokens = title => new Set((title.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 3 && !stop.has(w)));
    const left = tokens(a.title), right = tokens(b.title);
    const common = [...left].filter(w => right.has(w)).length;
    return common >= 3 && common / (left.size + right.size - common) >= 0.45;
  },
  brief(stories, importance, read) {
    const rank = {critical: 0, 'worth-knowing': 1, interesting: 2};
    const ranked = [...stories].sort((a, b) => Number(read.has(a.url)) - Number(read.has(b.url)) || rank[importance(a)] - rank[importance(b)] || (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));
    const selected = [];
    for (const s of ranked) {
      if (!selected.some(other => Reader.related(s, other))) selected.push(s);
      if (selected.length === 5) break;
    }
    return selected;
  }
};
