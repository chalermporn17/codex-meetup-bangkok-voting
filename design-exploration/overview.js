import {directions, comparisonGroups} from './data.js';
const allOriginals = new URLSearchParams(location.search).has('originals');
const groups = allOriginals ? [{name:'The first five directions',description:'The original exploration, preserved for reference.',ids:['town','lcd','yellow','shell','index']}] : comparisonGroups;
const card = (id,i) => {
  const direction=directions.find(item=>item.id===id);
  const original=!direction.family;
  const name=direction.name.split(' · ').at(-1);
  return `<article class="comparison-card"><a class="comparison-image" href="app.html?direction=${id}" aria-label="Explore ${direction.name}"><img src="screenshots/${id}-desktop.jpg" alt="${direction.name} desktop preview" width="1440" height="1080"><span class="preview-link">Explore version <span aria-hidden="true">↗</span></span></a><div class="comparison-info"><div><h3><a href="app.html?direction=${id}">${name}</a></h3><span class="version-label">${id==='town'?'Selected · original direction':original?'Original · unchanged':`New variation ${i}`}</span><p class="comparison-tagline">${direction.short}</p><p>${direction.description}</p><p class="tradeoff">${direction.tradeoff}</p><div class="screenshot-links"><a class="mobile-shot" href="screenshots/${id}-desktop.jpg" target="_blank" rel="noopener">Desktop screenshot</a><a class="mobile-shot" href="screenshots/${id}-mobile.jpg" target="_blank" rel="noopener">Mobile screenshot</a></div></div></div></article>`;
};
document.querySelector('#comparison-grid').innerHTML=groups.map(group=>`<section class="comparison-family"><div class="family-heading"><h2>${group.name}</h2><p>${group.description}</p></div><div class="family-grid">${group.ids.map(card).join('')}</div></section>`).join('');
if(allOriginals) {
  document.querySelector('.overview-intro h1').innerHTML='The first<br>five worlds.';
  document.querySelector('.overview-intro p').textContent='The original round, kept available alongside the six shortlisted versions.';
  document.querySelector('.overview-note').innerHTML='<a href="./">Return to the six-version shortlist</a>';
  document.title='Original five directions | Bangkok #3';
}
