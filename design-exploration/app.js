import {projects, directions} from './data.js';

const direction = directions.find(item => item.id === new URLSearchParams(location.search).get('direction')) || directions.find(item => item.id === 'town');
document.body.dataset.direction = direction.id;
document.body.dataset.family = direction.family || direction.id;
document.title = `${direction.name} | Bangkok #3 design preview`;
document.querySelector('#direction-name').textContent = direction.name;
const stage = document.querySelector('#stage');
const voteDialog = document.querySelector('#vote-dialog');
const promptDialog = document.querySelector('#prompt-dialog');
const voteForm = document.querySelector('#vote-form');
const emailInput = document.querySelector('#voter-email');
const confirmButton = document.querySelector('#confirm-vote');
const votes = new Map();
let selected = projects[0].id;
let state = 'ready';
let votingFor;
let pendingReplacement = null;
let requestId = 0;
let toastTimer;
const esc = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const projectTitle = project => document.querySelector('#long-title').checked && project.id === 'focus' ? 'Little Focus: a thoughtful timer for every wonderfully ambitious one-shot build' : project.title;
const title = project => esc(projectTitle(project));
const demoLink = project => `demos.html?project=${project.id}`;
const image = (project, extra='') => `<img class="project-image ${extra}" src="${project.image}" width="800" height="500" alt="${esc(project.title)}: screenshot of the working sample project" loading="eager">`;
const facts = () => '<div class="event-facts"><span><b>45</b> minutes</span><span><b>1</b> prompt</span><span><b>1</b> vote</span></div>';
const intro = () => `<div class="intro-copy"><h1>Build once.<br>Ship it.</h1><p>Explore the one-shot builds from your community.<br class="desktop-break"> Find a favorite. Cast your vote.</p>${facts()}<a class="button primary" href="#main">Explore projects</a></div>`;
const actions = project => `<div class="project-actions"><button class="button secondary" data-prompt="${project.id}" type="button">Prompt</button><button class="button primary" data-vote="${project.id}" type="button" ${state === 'closed' ? 'disabled' : ''}>${state === 'closed' ? 'Voting closed' : 'Vote'}</button><a class="project-open" href="${demoLink(project)}" target="_blank" rel="noopener">Open project<span class="external-mark" aria-hidden="true"></span><span class="sr-only"> (new tab)</span></a></div>`;
const heading = () => `<div class="gallery-heading"><div><h2>Projects</h2><p>Six sample builds. One shared challenge.</p></div><span class="sample-label">Sample gallery <span id="vote-total">${votes.size} demo vote${votes.size === 1 ? '' : 's'}</span></span></div>`;

function projectCard(project, i, options = {}) {
  return `<article class="project-card ${selected === project.id ? 'is-selected' : ''}"><button class="project-select" data-select="${project.id}" type="button" aria-pressed="${selected === project.id}" aria-label="Select ${title(project)}"><span class="cartridge-ridges" aria-hidden="true"></span>${image(project)}<span class="project-title">${title(project)}</span><span class="project-by">By ${esc(project.author)}</span>${options.numbers ? `<span class="entry-id">${String(i+1).padStart(2,'0')}</span>` : ''}</button><div class="project-card-body"><p>${esc(project.description)}</p>${actions(project)}</div></article>`;
}

function detail(project) {
  return `<section class="project-detail" aria-label="Selected project"><div class="display-top"><span>${esc(project.category)}</span><span>Sample build</span></div><a href="${demoLink(project)}" target="_blank" rel="noopener" aria-label="Open ${title(project)} sample project (new tab)">${image(project)}</a><div class="detail-body"><span class="selected-caption">Selected project</span><h3>${title(project)}</h3><p class="project-by">By ${esc(project.author)}</p><p>${esc(project.description)}</p>${actions(project)}</div></section>`;
}

function list() {
  return `<div class="project-directory" aria-label="Project selector">${projects.map((project,i)=>`<button data-select="${project.id}" type="button" class="directory-entry ${selected === project.id ? 'is-selected' : ''}" aria-pressed="${selected === project.id}"><span class="entry-id">${String(i+1).padStart(2,'0')}</span><span><strong>${title(project)}</strong><small>${esc(project.category)}</small></span><span class="selection-arrow" aria-hidden="true"></span></button>`).join('')}</div>`;
}

function galleryContent(content) {
  if(state === 'empty') return '<div class="state-panel"><h3>No projects yet</h3><p>Accepted projects will appear here.</p><button class="button primary" data-ready type="button">Show sample projects</button></div>';
  if(state === 'loading') return '<div class="loading-gallery" role="status" aria-label="Loading projects"><span>Loading projects…</span><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
  if(state === 'error') return '<div class="state-panel" role="alert"><h3>Projects couldn’t load.</h3><p>Please try again to see the gallery.</p><button class="button primary" data-ready type="button">Try again</button></div>';
  return content;
}

function render() {
  const project = projects.find(item => item.id === selected);
  document.querySelector('#event-status').textContent = state === 'closed' ? 'Voting closed' : 'Voting open';
  document.body.dataset.state = state;
  const cards = projects.map((project,i)=>projectCard(project,i)).join('');
  if(direction.id === 'town') {
    stage.innerHTML = `<section class="town-intro" id="introduction" aria-label="One-Shot Build Challenge">${intro()}<div class="town-world"><img src="assets/pocket-town.webp" alt="A pixel-art town square with trees, visitors, and a community garden." width="1536" height="1024"><span class="world-sign">Welcome, builders.</span></div></section><main id="main" class="gallery town-gallery" tabindex="-1">${heading()}${galleryContent(`<div class="gallery-grid">${cards}</div>`)}</main>`;
  } else if(direction.id === 'town-map') {
    stage.innerHTML = `<section class="variant-intro" id="introduction"><div><h1>A town full<br>of little ideas.</h1><p>Explore the one-shot builds from your community. Find a favorite. Cast your vote.</p></div>${facts()}</section><main id="main" class="map-gallery" tabindex="-1">${heading()}${galleryContent(`<div class="map-layout"><div class="town-map"><img src="assets/pocket-town.webp" width="1536" height="1024" alt="Original pixel town: choose a numbered project stop to explore a sample build"><div class="map-stops" aria-label="Project selector">${projects.map((item,i)=>`<button type="button" data-select="${item.id}" class="map-stop ${selected === item.id ? 'is-selected' : ''}" aria-pressed="${selected === item.id}" aria-label="Select ${title(item)}"><span>${String(i+1).padStart(2,'0')}</span><strong>${title(item)}</strong></button>`).join('')}</div><p class="map-caption">Pick a project stop. Discover what’s inside.</p></div><div class="map-dialogue">${detail(project)}</div></div>`)}</main>`;
  } else if(direction.id === 'town-journal') {
    stage.innerHTML = `<section class="journal-intro" id="introduction"><img src="assets/pocket-town.webp" width="1536" height="1024" alt="Original pixel-art town square and community garden"><div><h1>Small builds.<br>Shared stories.</h1><p>Explore the one-shot builds from your community.<br>Find a favorite. Cast your vote.</p>${facts()}</div></section><main id="main" class="journal-gallery" tabindex="-1">${heading()}${galleryContent(`<div class="journal-entries">${projects.map((item,i)=>`<article class="journal-entry ${selected === item.id ? 'is-selected' : ''}"><span class="journal-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><button class="journal-preview" type="button" data-select="${item.id}" aria-pressed="${selected === item.id}" aria-label="Select ${title(item)}">${image(item)}</button><div class="journal-copy"><span class="journal-category">${esc(item.category)}</span><h3>${title(item)}</h3><p class="project-by">By ${esc(item.author)}</p><p>${esc(item.description)}</p>${actions(item)}</div></article>`).join('')}</div>`)}</main>`;
  } else if(direction.id === 'index-console') {
    stage.innerHTML = `<section class="variant-intro" id="introduction"><div><h1>Your next<br>favorite build.</h1><p>One-Shot Build Challenge</p></div>${facts()}</section><main id="main" class="console-gallery" tabindex="-1">${heading()}${galleryContent(`<div class="field-console"><div class="field-top"><span class="lens" aria-hidden="true"></span><strong>PROJECT INDEX</strong><span>6 sample entries</span></div><div class="field-screen">${detail(project)}</div><div class="field-selector">${list()}</div><p class="field-instruction">Select a build. Read its prompt. Make your pick.</p></div>`)}</main>`;
  } else if(direction.id === 'index-catalog') {
    stage.innerHTML = `<section class="catalog-intro" id="introduction"><div><span class="lens" aria-hidden="true"></span><h1>Your next<br>favorite build.</h1></div><div><p>One-Shot Build Challenge</p>${facts()}</div></section><main id="main" class="catalog-gallery" tabindex="-1">${heading()}${galleryContent(`<div class="catalog-grid">${projects.map((item,i)=>projectCard(item,i,{numbers:true})).join('')}</div>`)}</main>`;
  } else if(direction.id === 'lcd') {
    stage.innerHTML = `<section class="lcd-intro" id="introduction"><h1>Build once. Ship it.</h1><p>One-Shot Build Challenge</p>${facts()}</section><div class="lcd-console"><div class="console-label"><span>CODEX / COMMUNITY EDITION</span><span>BANGKOK #3</span></div><main id="main" class="lcd-screen" tabindex="-1">${heading()}${galleryContent(`<div class="lcd-layout">${list()}${detail(project)}</div>`)}</main><div class="console-controls" aria-hidden="true"><span class="d-pad"></span><span class="console-caption">ONE PROMPT. SIX POSSIBILITIES.</span><span class="round-control">B</span><span class="round-control">A</span></div></div>`;
  } else if(direction.id === 'yellow') {
    stage.innerHTML = `<section class="yellow-intro" id="introduction">${intro()}<div class="box-art"><span class="box-spine">ONE-SHOT BUILD CHALLENGE</span><div class="box-face"><span class="edition-text">COMMUNITY<br>EDITION</span><span class="big-pixel">PLAY<br>YOUR<br>PART.</span><span class="box-caption">BANGKOK #3</span></div><span class="box-bottom">A SMALL BUILD CAN BE A BIG IDEA.</span></div></section><main id="main" class="gallery yellow-gallery" tabindex="-1">${heading()}${galleryContent(`<div class="gallery-grid cartridge-grid">${cards}</div>`)}</main>`;
  } else if(direction.id === 'shell') {
    stage.innerHTML = `<section class="shell-intro" id="introduction"><div><h1>Build once.<br>Ship it.</h1><p>Six little builds.<br>A community of possibilities.</p></div>${facts()}<div class="shell-wordmark" aria-hidden="true">C / 03</div></section><main id="main" class="gallery shell-gallery" tabindex="-1">${heading()}${galleryContent(`<div class="clear-device"><span class="screw screw-a" aria-hidden="true"></span><span class="screw screw-b" aria-hidden="true"></span><span class="screw screw-c" aria-hidden="true"></span><span class="screw screw-d" aria-hidden="true"></span><div class="device-detail">${detail(project)}</div><div class="device-sidebar"><p class="device-brand">CODEX<br>COMMUNITY</p>${list()}<div class="circuit" aria-hidden="true"><span>INPUT</span><i></i><span>OUTPUT</span></div></div></div>`)}</main>`;
  } else {
    stage.innerHTML = `<section class="index-intro" id="introduction"><h1>Your next<br>favorite build.</h1><div><p>One-Shot Build Challenge</p>${facts()}</div></section><main id="main" class="gallery index-gallery" tabindex="-1">${heading()}${galleryContent(`<div class="index-device"><div class="index-left"><div class="index-top"><span class="lens" aria-hidden="true"></span><strong>PROJECT INDEX</strong></div><div class="index-list">${list()}</div><div class="index-bottom"><span>6 sample entries</span><span class="d-pad" aria-hidden="true"></span></div></div><div class="index-hinge" aria-hidden="true"></div><div class="index-right">${detail(project)}<div class="index-instruction">Select a build. Read its prompt. Make your pick.</div></div></div>`)}</main>`;
  }
}

stage.addEventListener('click', event => {
  const button = event.target.closest('button');
  if(!button) return;
  if(button.dataset.select) {
    selected = button.dataset.select;
    render();
    stage.querySelector(`[data-select="${selected}"]`).focus({preventScroll:true});
  } else if(button.dataset.vote) openVote(button.dataset.vote);
  else if(button.dataset.prompt) openPrompt(button.dataset.prompt);
  else if(button.hasAttribute('data-ready')) {
    state = 'ready'; document.querySelector('#preview-state').value = state; render(); document.querySelector('#main').focus();
  }
});

function openVote(id) {
  if(state === 'closed') return;
  votingFor = projects.find(project=>project.id === id);
  pendingReplacement = null;
  voteForm.reset();
  voteForm.hidden = false;
  document.querySelector('#vote-success').hidden = true;
  document.querySelector('#replace-message').hidden = true;
  document.querySelector('#vote-error').textContent = '';
  document.querySelector('#vote-description').textContent = `Vote for ${projectTitle(votingFor)} by ${votingFor.author}.`;
  confirmButton.disabled = false;
  confirmButton.textContent = 'Confirm vote';
  emailInput.readOnly = false;
  voteDialog.showModal();
  emailInput.focus();
}

function showVoteError(message) {
  const error = document.querySelector('#vote-error');
  error.textContent = message; error.focus();
}

voteForm.addEventListener('submit', async event => {
  event.preventDefault();
  if(confirmButton.disabled || state === 'closed') return;
  const email = emailInput.value.trim().toLowerCase();
  emailInput.value = email;
  if(!voteForm.reportValidity()) return;
  const previous = votes.get(email);
  if(previous && previous !== votingFor.id && pendingReplacement !== email) {
    pendingReplacement = email;
    document.querySelector('#replace-copy').textContent = `You voted for ${projects.find(item=>item.id === previous).title}. Replace it with ${projectTitle(votingFor)}? Your total stays at one vote.`;
    document.querySelector('#replace-message').hidden = false;
    confirmButton.textContent = 'Change vote';
    confirmButton.focus();
    return;
  }
  const thisRequest = ++requestId;
  const response = document.querySelector('#vote-response').value;
  confirmButton.disabled = true;
  confirmButton.textContent = 'Recording…';
  emailInput.readOnly = true;
  document.querySelector('#vote-error').textContent = '';
  await new Promise(resolve=>setTimeout(resolve,650));
  if(thisRequest !== requestId || !voteDialog.open) return;
  confirmButton.disabled = false;
  confirmButton.textContent = pendingReplacement ? 'Change vote' : 'Confirm vote';
  emailInput.readOnly = false;
  if(response === 'error') return showVoteError('The demo connection failed. Your vote was not changed. Try again after choosing Success in preview controls.');
  if(response === 'whitelist') return showVoteError('This email is not on the event whitelist. Check your email or contact the organizer.');
  votes.set(email,votingFor.id);
  voteForm.hidden = true;
  document.querySelector('#vote-success').hidden = false;
  document.querySelector('#success-copy').textContent = previous === votingFor.id ? `You already support ${projectTitle(votingFor)}. You still have one active vote.` : `You’re supporting ${projectTitle(votingFor)}. You can change your choice later.`;
  const total = document.querySelector('#vote-total');
  if(total) total.textContent = `${votes.size} demo vote${votes.size === 1 ? '' : 's'}`;
  document.querySelector('#vote-success button').focus();
});
emailInput.addEventListener('input',()=>{pendingReplacement=null;document.querySelector('#replace-message').hidden=true;confirmButton.textContent='Confirm vote';});
voteDialog.addEventListener('close',()=>{requestId++;});

function openPrompt(id) {
  const project=projects.find(item=>item.id===id);
  document.querySelector('#prompt-title').textContent=projectTitle(project);
  document.querySelector('#prompt-content').textContent=project.prompt;
  document.querySelector('#copy-status').textContent='';
  promptDialog.showModal();
}
document.querySelector('#copy-prompt').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(document.querySelector('#prompt-content').textContent);document.querySelector('#copy-status').textContent='Prompt copied.';}
  catch {document.querySelector('#copy-status').textContent='Select the prompt text and copy it using your keyboard.';}
});
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.addEventListener('click',event=>{if(event.target.closest('[data-close]')) dialog.close();});
});
document.querySelector('#preview-state').addEventListener('change',event=>{
  state=event.target.value; if(voteDialog.open) voteDialog.close(); render();
});
document.querySelector('#theme').addEventListener('change',event=>{document.documentElement.dataset.theme=event.target.value;});
document.querySelector('#long-title').addEventListener('change',render);
document.querySelector('#reset-preview').addEventListener('click',()=>{
  votes.clear(); if(voteDialog.open)voteDialog.close(); render();
  const toast=document.querySelector('#toast');toast.textContent='Demo votes cleared.';toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2500);
});
render();
