/* app.ui.js v1.3.1 */
(function(){
  const App=window.App, D=App.DOM;

  function getActiveDeck(){
  // 1) самый безопасный путь — через шиму из trainer_safe_patch.js
  if (App.Trainer && typeof App.Trainer.safeGetDeckSlice === 'function') {
    return App.Trainer.safeGetDeckSlice(App.dictRegistry.activeKey) || [];
  }
  // 2) если шима нет, пробуем прямой слайс набора
  if (App.Trainer && typeof App.Trainer.getDeckSlice === 'function') {
    var slice = App.Trainer.getDeckSlice(App.dictRegistry.activeKey) || [];
    if (slice && slice.length) return slice;
  }
  // 3) фолбэк — весь словарь (как было)
  return App.Decks.resolveDeckByKey(App.dictRegistry.activeKey) || [];
}
  function current(){
    const deck=getActiveDeck();
    if(!deck.length) return {id:-1,word:'',uk:'',ru:''};
    if (App.state.index<0 || App.state.index>=deck.length) App.state.index=0;
    return deck[App.state.index];
  }
  function decideModeForWord(w){ const succ=App.state.successes[w.id]||0; return (succ>=App.Trainer.unlockThreshold())?(Math.random()<0.5):false; }

  function renderStars(){
    const w=current(); const score=App.clamp(App.state.stars[w.id]||0,0,App.Trainer.starsMax());
    const host=D.starsEl; if(!host) return; host.innerHTML='';
    for(let i=0;i<App.Trainer.starsMax();i++){ const s=document.createElement('span'); s.className='starIcon'+(i<score?' filled':''); s.textContent='★'; host.appendChild(s); }
  }
  // Показываем статистику по ВЕСЬМУ активному словарю:
// "Всего слов: N / Выучено: M"
function updateStats(){
  const t = App.i18n ? App.i18n() : { totalWords:'Всего слов', learned:'Выучено' };

  const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
  const fullDeck = (App.Decks && App.Decks.resolveDeckByKey)
    ? (App.Decks.resolveDeckByKey(key) || [])
    : [];

  const repeats = (App.Trainer && typeof App.Trainer.starsMax === 'function')
    ? App.Trainer.starsMax()
    : ((App.state && App.state.repeats) || 3);

  const starsMap = (App.state && App.state.stars) || {};
  let learned = 0;
  for (let i = 0; i < fullDeck.length; i++){
    const w = fullDeck[i];
    if (!w) continue;
    if ((starsMap[w.id] || 0) >= repeats) learned++;
  }

  if (App.DOM && App.DOM.statsBar){
    App.DOM.statsBar.textContent = `${t.totalWords}: ${fullDeck.length} / ${t.learned}: ${learned}`;
  } 
}

  function drawOptions(correct,pool){
    const distractors=App.shuffle(pool).slice(0,3);
    const variants=App.shuffle([correct,...distractors]);
    variants.forEach(v=>{ const b=document.createElement('button'); b.className='optionBtn'; b.textContent=v; if(v===correct) b.dataset.correct='1'; b.addEventListener('click',()=>onChoice(b,v===correct)); D.optionsRow.appendChild(b); });
  }
  function addIDontKnowButton(){
    const t=App.i18n(); const wrap=document.createElement('div'); wrap.className='idkWrapper';
    const b=document.createElement('button'); b.className='ghost'; b.textContent=t.iDontKnow; b.addEventListener('click',onIDontKnow);
    wrap.appendChild(b); D.optionsRow.appendChild(wrap);
  }

  function renderCard(force=false){
    if(document.activeElement&&document.activeElement.blur) try{document.activeElement.blur();}catch(e){}
    const deck=getActiveDeck();
    if(!deck.length){ if(D.wordEl) D.wordEl.textContent='—'; if(D.hintEl) D.hintEl.textContent='—'; if(D.optionsRow) D.optionsRow.innerHTML=''; renderStars(); updateStats(); return; }

    if (force || App.state.index===App.state.lastIndex) App.state.index = App.Trainer.sampleNextIndexWeighted(deck);
    const w=current();
    if (App.state.lastShownWordId!==w.id){ App.state.totals.shown+=1; App.state.lastShownWordId=w.id; App.state.lastSeen[w.id]=Date.now(); App.saveState(); }

    const t=App.i18n(); const isReverse=decideModeForWord(w);
    renderStars(); D.optionsRow.innerHTML='';
    if(!isReverse){
      if(D.wordEl) D.wordEl.textContent=w.word;
      const correct=(App.settings.lang==='ru')?w.ru:w.uk;
      const pool=deck.filter(x=>x.id!==w.id).map(x=>(App.settings.lang==='ru'?x.ru:x.uk));
      drawOptions(correct,pool);
    }else{
      if(D.wordEl) D.wordEl.textContent=(App.settings.lang==='ru')?w.ru:w.uk;
      const correct=w.word; const pool=deck.filter(x=>x.id!==w.id).map(x=>x.word);
      drawOptions(correct,pool);
    }
    if(D.hintEl) D.hintEl.textContent=t.choose;

    if(D.favBtn){
      const isFavDeck=(App.dictRegistry.activeKey==='fav');
      D.favBtn.textContent=App.state.favorites[w.id]?'♥':'♡';
      D.favBtn.disabled=isFavDeck;
    }
    addIDontKnowButton(); updateStats();
  }

  function onChoice(btn,correct){
    const w=current(); const cur=App.clamp(App.state.stars[w.id]||0,0,App.Trainer.starsMax());
    if(correct){
      btn.classList.add('correct'); D.optionsRow.querySelectorAll('button.optionBtn').forEach(b=>b.disabled=true);
      App.state.stars[w.id]=App.clamp(cur+1,0,App.Trainer.starsMax()); App.state.successes[w.id]=(App.state.successes[w.id]||0)+1; App.saveState(); renderStars(); updateStats(); setTimeout(nextWord,500);
    }else{
      btn.classList.add('wrong'); btn.disabled=true; App.state.stars[w.id]=App.clamp(cur-1,0,App.Trainer.starsMax()); App.state.totals.errors+=1; App.saveState(); renderStars(); updateStats();
    }
  }
  function onIDontKnow(){ const w=current(); const c=D.optionsRow.querySelector('button.optionBtn[data-correct="1"]'); if(c) c.classList.add('correct'); D.optionsRow.querySelectorAll('button.optionBtn').forEach(b=>b.disabled=true); const cur=App.clamp(App.state.stars[w.id]||0,0,App.Trainer.starsMax()); App.state.stars[w.id]=App.clamp(cur-1,0,App.Trainer.starsMax()); App.saveState(); renderStars(); updateStats(); setTimeout(nextWord,700); }
  function nextWord(){ App.state.lastIndex=App.state.index; const deck=getActiveDeck(); App.state.index=App.Trainer.sampleNextIndexWeighted(deck); renderCard(true); }
  function toggleFav(){ const w=current(); App.state.favorites[w.id]=!App.state.favorites[w.id]; App.saveState(); if(D.favBtn){ D.favBtn.textContent=App.state.favorites[w.id]?'♥':'♡'; D.favBtn.style.transform='scale(1.2)'; setTimeout(()=>{D.favBtn.style.transform='scale(1)';},140);} renderDictList(); }

  function canShowFav(){ const fav=App.Decks.resolveDeckByKey('fav'); return (fav&&fav.length>=4); }
  function makeDictRow(key){
    const words=App.Decks.resolveDeckByKey(key)||[];
    const row=document.createElement('div'); row.className='dictRow'+(key===App.dictRegistry.activeKey?' active':''); row.dataset.key=key;
    const flag=document.createElement('div'); flag.className='dictFlag'; flag.textContent=App.Decks.flagForKey(key,words);
    const name=document.createElement('div'); name.className='dictName'; name.textContent=App.Decks.resolveNameByKey(key); name.title=name.textContent;
    const actions=document.createElement('div'); actions.className='dictActions';
    const prevBtn=document.createElement('button'); prevBtn.className='iconOnly'; prevBtn.title=App.i18n().ttPreview; prevBtn.textContent='👁️'; prevBtn.addEventListener('click',(e)=>{e.stopPropagation(); App.Decks.openPreview(words,name.textContent);});
    actions.appendChild(prevBtn);

    // Кнопка очистки "Избранного"
    if (key === 'fav' || key === 'favorites') {
      const delBtn = document.createElement('button');
      delBtn.className = 'iconOnly';
      delBtn.title = (App.settings.lang === 'ru') ? 'Очистить «Избранное»' : 'Очистити «Обране»';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msg = (App.settings.lang === 'ru')
          ? 'Очистить «Избранное»? Это действие нельзя отменить.'
          : 'Очистити «Обране»? Дію не можна скасувати.';
        if (!confirm(msg)) return;
        App.state.favorites = {};
        App.saveState();
        const nounKey = Object.keys(App.Decks.builtinKeys ? App.Decks.builtinKeys() : [])
          .find(k => App.Decks.resolveNameByKey(k) === (App.settings.lang === 'ru' ? 'Существительные' : 'Іменники'));
        App.dictRegistry.activeKey = nounKey || App.Decks.pickDefaultKey();
        App.saveDictRegistry();
        renderDictList(); renderCard(true); updateStats();
      });
      actions.appendChild(delBtn);
    }

    row.appendChild(flag); row.appendChild(name); row.appendChild(actions);
    row.addEventListener('click',()=>{ App.dictRegistry.activeKey=key; App.saveDictRegistry(); App.state.index=0; App.state.lastIndex=-1; renderDictList(); renderCard(true); updateStats(); });
    return row;
  }

  function renderDictList(){
    const host=D.dictListHost; if(!host) return; host.innerHTML='';
    if (canShowFav()) host.appendChild(makeDictRow('fav'));
    for (const k of App.Decks.builtinKeys()) host.appendChild(makeDictRow(k));
    for (const k of Object.keys(App.dictRegistry.user||{})) host.appendChild(makeDictRow(k));
  }

  function applyLang(){
    const t=App.i18n();
    if (D.titleEl&&D.titleEl.firstChild) D.titleEl.firstChild.textContent=t.appTitle+' ';
    if (D.appVerEl) D.appVerEl.textContent='v'+App.APP_VER;
    if (D.taglineEl) D.taglineEl.textContent=t.tagline;
    if (D.dictsBtn) D.dictsBtn.title = t.dictsHeader;
    renderDictList(); updateStats();
  }

  function openModal(){ if(D.modal) D.modal.classList.remove('hidden'); }
  function closeModal(){ if(D.modal) D.modal.classList.add('hidden'); }

  function bindHeaderButtons(){
    if (D.langToggleBtn){
      D.langToggleBtn.addEventListener('click',()=>{
        App.settings.lang = (App.settings.lang==='ru') ? 'uk' : 'ru';
        D.langToggleBtn.textContent = (App.settings.lang==='ru') ? '🇷🇺' : '🇺🇦';
        App.saveSettings(App.settings); applyLang(); App.applyTheme();
        renderCard(true);
      });
    }
    if (D.themeToggleBtn){
      const updateIcon=()=>{ const mode=document.documentElement.getAttribute('data-theme'); D.themeToggleBtn.textContent = (mode==='dark')?'🌙':'🌞'; };
      D.themeToggleBtn.addEventListener('click',()=>{
        const cur=document.documentElement.getAttribute('data-theme')||'light';
        const next = (cur==='dark')?'light':'dark';
        App.settings.theme=next; App.saveSettings(App.settings); App.applyTheme(); updateIcon();
      });
      updateIcon();
    }
    if (D.dictsBtn){
      D.dictsBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openModal(); });
    }
    if (D.okBtn){ D.okBtn.addEventListener('click',()=>{ closeModal(); }); }
    if (D.backdrop){ D.backdrop.addEventListener('click',()=>{ closeModal(); }); }
    if (D.favBtn){ D.favBtn.addEventListener('click', toggleFav); }
  }

  const _origBootstrap = App.bootstrap;
  App.bootstrap = function(){
    _origBootstrap();
    if (!App.dictRegistry.activeKey){ App.dictRegistry.activeKey = App.Decks.pickDefaultKey(); App.saveDictRegistry(); }
    applyLang(); App.applyTheme(); App.scheduleThemeTick();
    bindHeaderButtons();
    renderCard(true);
  };

  document.addEventListener('DOMContentLoaded', App.bootstrap);
})();
// конец!
