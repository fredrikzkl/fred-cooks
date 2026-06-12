const STATUSES = ['brewing', 'certified'];

const state = {
  recipes: [],
  query: '',
  activeTags: new Set(),
  activeStatuses: new Set(),
};

async function init() {
  const res = await fetch('search-index.json');
  state.recipes = await res.json();
  renderStatusFilters();
  renderTagFilters();
  render();
  document.getElementById('search').addEventListener('input', e => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });
}

function renderStatusFilters() {
  const container = document.getElementById('status-filters');
  container.innerHTML = STATUSES.map(s =>
    `<button class="status-chip status-${s}" data-status="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`
  ).join('');
  container.addEventListener('click', e => {
    const btn = e.target.closest('.status-chip');
    if (!btn) return;
    const s = btn.dataset.status;
    if (state.activeStatuses.has(s)) state.activeStatuses.delete(s);
    else state.activeStatuses.add(s);
    btn.classList.toggle('active');
    render();
  });
}

function renderTagFilters() {
  const allTags = [...new Set(state.recipes.flatMap(r => r.tags))].sort();
  const container = document.getElementById('tag-filters');
  container.innerHTML = allTags
    .map(t => `<button class="tag-chip" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`)
    .join('');
  container.addEventListener('click', e => {
    const btn = e.target.closest('.tag-chip');
    if (!btn) return;
    const tag = btn.dataset.tag;
    if (state.activeTags.has(tag)) state.activeTags.delete(tag);
    else state.activeTags.add(tag);
    btn.classList.toggle('active');
    render();
  });
}

function matches(recipe) {
  if (state.activeStatuses.size > 0 && !state.activeStatuses.has(recipe.status)) return false;
  for (const tag of state.activeTags) {
    if (!recipe.tags.includes(tag)) return false;
  }
  if (!state.query) return true;
  const haystack = [
    recipe.title,
    ...recipe.tags,
    ...recipe.ingredients,
    ...(recipe.sides ?? []),
  ].join(' ').toLowerCase();
  return haystack.includes(state.query);
}

function render() {
  const filtered = state.recipes.filter(matches);
  const results = document.getElementById('results');
  results.innerHTML = filtered.map(r => `
    <li class="recipe-card">
      <a href="${escapeAttr(r.url)}">
        ${r.status ? `<span class="status status-${escapeAttr(r.status)}">${escapeHtml(r.status[0].toUpperCase() + r.status.slice(1))}</span>` : ''}
        <h2>${escapeHtml(r.title)}</h2>
        <p class="meta">
          ${r.total_time ? `${escapeHtml(r.total_time)}` : ''}
          ${r.total_time && r.servings ? ' &middot; ' : ''}
          ${r.servings ? `serves ${escapeHtml(r.servings)}` : ''}
        </p>
        ${r.tags.length ? `<ul class="tags">${r.tags.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
      </a>
    </li>
  `).join('');
  document.getElementById('empty').hidden = filtered.length > 0;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}

init();
