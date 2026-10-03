// Run using the documented browser API: await runTownMotion(tab).
export async function runTownMotion(tab, base='http://127.0.0.1:4611') {
  const results=[];
  const check=(condition,message)=>{if(!condition)throw new Error(message);results.push(message);};
  const observe=()=>tab.playwright.domSnapshot();
  const scene=()=>tab.playwright.locator('.town-world');
  const control=()=>tab.playwright.locator('[data-town-motion]');
  await tab.goto(`${base}/app.html?direction=town`);await observe();
  check(await tab.playwright.locator('.town-actor').count()===4,'Four reference characters appear only in the town scene');
  const reduced=await tab.playwright.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(reduced) {
    check(!await control().isEnabled(),'Reduced motion uses a static scene and a labeled disabled control');
  } else {
    await tab.playwright.locator('.town-world[data-motion="playing"]').waitFor({state:'attached'});
    check(await scene().getAttribute('data-motion')==='playing','Visible scene plays automatically');
    check(await tab.playwright.evaluate(()=>{const style=getComputedStyle(document.querySelector('.resident-pikachu'));return style.animationName==='town-stroll'&&style.animationPlayState==='running';}),'Walking animation is running');
    await control().press('Space');await observe();
    check(await control().innerText()==='Play town'&&await control().getAttribute('aria-pressed')==='true','Keyboard pause updates its label and pressed state');
    const paused=await tab.playwright.evaluate(()=>getComputedStyle(document.querySelector('.resident-pikachu')).transform);
    await observe();
    check(paused===await tab.playwright.evaluate(()=>getComputedStyle(document.querySelector('.resident-pikachu')).transform),'Paused character holds its exact position');
    check(await tab.playwright.evaluate(()=>[...document.querySelectorAll('.town-actor,.town-sprite')].every(el=>getComputedStyle(el).animationPlayState==='paused')),'Pause stops every character and footstep');
    await tab.playwright.locator('[data-select="focus"]').click();await observe();
    check(await control().getAttribute('aria-pressed')==='true','User pause survives a gallery rerender');
    await control().click();await observe();
    await tab.playwright.locator('.town-world[data-motion="playing"]').waitFor({state:'attached'});
    check(await control().innerText()==='Pause town','Play resumes the town');
    await tab.playwright.locator('[data-vote="trail"]').click();await observe();
    await tab.playwright.locator('.town-world[data-motion="paused"]').waitFor({state:'attached'});
    check(await scene().getAttribute('data-motion')==='paused','Scene pauses when scrolled offscreen');
    await tab.playwright.getByRole('button',{name:'Close voting dialog',exact:true}).press('Escape');await observe();
    await control().click();await observe();
    await control().click();await observe();
    await tab.playwright.locator('.town-world[data-motion="playing"]').waitFor({state:'attached'});
    check(await scene().getAttribute('data-motion')==='playing','Scene resumes when visible again');
  }
  check(await tab.playwright.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  return results;
}
