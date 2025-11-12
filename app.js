/* app.js — Loads deals.json, supports search, filters, copy code, local quick-add.
   IMPORTANT: set AFFILIATE_TAGS below or replace placeholders in deals.json
*/

const DEALS_JSON = 'deals.json'; // relative path in your repo
const AFFILIATE_PLACEHOLDER = {
  amazon: 'YOUR_AFFIL_TAG',
  flipkart: 'YOUR_FLIP_TAG'
};

// --- helpers
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function text(node, t){ node.textContent = t; }
function el(template) { return document.importNode(template.content, true); }

async function fetchDeals(){
  try {
    const res = await fetch(DEALS_JSON + '?t=' + Date.now());
    if(!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    return data;
  } catch (e) {
    console.warn('Could not fetch deals.json:', e);
    return [];
  }
}

function attachAffiliate(url){
  // if user didn't embed tag in url, we attempt to attach basic params for Amazon/Flipkart
  if(!url) return url;
  try{
    const u = new URL(url);
    const host = u.host.toLowerCase();
    if(host.includes('amazon')){
      if(!u.searchParams.get('tag')) u.searchParams.set('tag', AFFILIATE_PLACEHOLDER.amazon);
    } else if(host.includes('flipkart')){
      if(!u.searchParams.get('affid')) u.searchParams.set('affid', AFFILIATE_PLACEHOLDER.flipkart);
    }
    return u.toString();
  }catch(e){
    return url;
  }
}

function renderDeals(allDeals){
  const grid = $('#dealsGrid');
  grid.innerHTML = '';
  if(!allDeals || allDeals.length===0){
    grid.innerHTML = '<div class="loading">No deals yet. Edit deals.json to add deals.</div>';
    return;
  }
  const template = $('#dealTemplate');
  const fragment = document.createDocumentFragment();

  allDeals.forEach(d => {
    const node = el(template);
    node.querySelector('.card-img').src = d.image || 'placeholder.png';
    node.querySelector('.card-img').alt = d.title || 'deal image';
    node.querySelector('.card-title').textContent = d.title;
    node.querySelector('.card-meta').textContent = `${d.store || ''} • ${d.meta || ''}`;
    const open = node.querySelector('.open-deal');
    open.href = attachAffiliate(d.url);
    open.textContent = 'Open deal';
    const copyBtn = node.querySelector('.copy-code');
    if(d.code && d.code.toUpperCase()!=='NONE'){
      copyBtn.textContent = 'Copy Code';
      copyBtn.dataset.code = d.code;
    } else {
      copyBtn.textContent = 'No Code';
      copyBtn.disabled = true;
    }
    copyBtn.addEventListener('click', async (ev)=>{
      const code = ev.currentTarget.dataset.code;
      try{
        await navigator.clipboard.writeText(code);
        ev.currentTarget.textContent = 'Copied!';
        setTimeout(()=> ev.currentTarget.textContent = 'Copy Code', 1800);
      }catch(e){
        alert('Copy failed — your browser may block clipboard access. Code: ' + code);
      }
    });

    fragment.appendChild(node);
  });

  grid.appendChild(fragment);
}

// filter & search
function applyFilters(deals){
  let filtered = deals.slice();
  const activeBtn = $('.filter.active');
  const cat = activeBtn ? activeBtn.dataset.cat : 'all';
  if(cat && cat !== 'all') filtered = filtered.filter(d => (d.category||'').toLowerCase() === cat.toLowerCase());

  const q = ($('#search').value || '').trim().toLowerCase();
  if(q){
    filtered = filtered.filter(d => (d.title || '').toLowerCase().includes(q) || (d.meta||'').toLowerCase().includes(q) || (d.store||'').toLowerCase().includes(q));
  }
  renderDeals(filtered);
}

// quick local add
function saveLocalDeal(deal){
  const arr = JSON.parse(localStorage.getItem('localDeals_v1') || '[]');
  arr.unshift(deal);
  localStorage.setItem('localDeals_v1', JSON.stringify(arr));
  return arr;
}
function loadLocalDeals(){
  return JSON.parse(localStorage.getItem('localDeals_v1') || '[]');
}
function clearLocalDeals(){
  localStorage.removeItem('localDeals_v1');
}

// bootstrap
(async function init(){
  const loading = $('#loading');
  let deals = await fetchDeals();

  // merge with local saved deals so you can add from phone immediately
  const local = loadLocalDeals();
  if(local.length) deals = local.concat(deals);

  if(!deals || deals.length===0){
    $('#dealsGrid').innerHTML = '<div class="loading">No deals found — edit <code>deals.json</code> in your repository to publish deals.</div>';
  } else {
    renderDeals(deals);
  }
  // wire filters
  $$('.filter').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.filter').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters(deals);
    });
  });
  // search
  $('#search').addEventListener('input', ()=> applyFilters(deals));

  // Quick add form
  const form = document.getElementById('quickAddForm');
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fm = new FormData(form);
    const newDeal = {
      id: 'local-' + Date.now(),
      title: fm.get('title'),
      store: fm.get('store') || 'Other',
      category: fm.get('category') || 'others',
      code: fm.get('code') || 'NONE',
      url: fm.get('url'),
      image: fm.get('image') || '',
      meta: 'Added locally',
      date: new Date().toISOString().slice(0,10)
    };
    const arr = saveLocalDeal(newDeal);
    deals = arr.concat(deals.filter(d => !d.id.startsWith('local-')));
    renderDeals(deals);
    form.reset();
    alert('Added locally. To publish, add this deal into your repo file deals.json.');
  });

  $('#clearLocal').addEventListener('click', ()=>{
    if(confirm('Clear local saved deals?')){ clearLocalDeals(); deals = deals.filter(d => !d.id.startsWith('local-')); renderDeals(deals); }
  });

})();
