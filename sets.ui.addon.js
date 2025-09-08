// sets.ui.addon.js — tiles with meta + live progress + activeKey/lang watcher
(function(){
  function getSetSizeSafe(){
    var ss = 50;
    try { ss = Number(App && App.state && App.state.setSize); } catch(e){}
    if (!Number.isFinite(ss) || ss < 2) ss = 50;
    return ss;
  }

  // done для диапазона [start, end)
  function isRangeDone(deck, start, end, repeats, starsMap){
    if (!deck || !deck.length) return false;
    if (end <= start) return false;
    for (var j = start; j < end; j++){
      var w = deck[j];
      if (!w) return false;
      var s = (starsMap[w.id] || 0);
      if (s < repeats) return false;
    }
    return true;
  }

  // общая мета по активному словарю
  function calcMetaForActiveKey(){
    var key = (window.App && App.dictRegistry && App.dictRegistry.activeKey) || null;
    var setSize = getSetSizeSafe();

    var total = 0, active = 0, completed = [];

    if (window.App && App.Trainer && typeof App.Trainer.getBatchesMeta === 'function'){
      var m = App.Trainer.getBatchesMeta(key);
      if (m && typeof m.total === 'number'){
        total = m.total|0;
        active = (m.active|0) || 0;
        completed = Array.isArray(m.completed) ? m.completed.slice(0,total) : new Array(total).fill(false);
      } else if (Array.isArray(m)) {
        total = m.length|0;
        active = (typeof App.Trainer.getBatchIndex === 'function') ? (App.Trainer.getBatchIndex(key)|0) : 0;
        completed = m.map(function(x){ return !!(x && (x.done === true || x === true)); });
      }
    }

    if (!total){
      var deck = (App && App.Decks && App.Decks.resolveDeckByKey) ? (App.Decks.resolveDeckByKey(key)||[]) : [];
      total = Math.max(1, Math.ceil(deck.length / setSize));
      active = (typeof App.Trainer === 'object' && typeof App.Trainer.getBatchIndex === 'function')
        ? (App.Trainer.getBatchIndex(key, total)|0) : 0;
      completed = new Array(total).fill(false);
    }

    return { key:key, total:total, active:active, completed:completed, setSize:setSize };
  }

  function renderSetsBar(){
    var host = document.getElementById('setsBar');
    if (!host) return;
    host.innerHTML = '';

    var meta = calcMetaForActiveKey();
    if (!meta || !meta.total) return;

    // данные для вычисления done
    var deck = [];
    try { deck = (App && App.Decks && App.Decks.resolveDeckByKey) ? (App.Decks.resolveDeckByKey(meta.key)||[]) : []; } catch(e){}
    var starsMap = (App && App.state && App.state.stars) || {};
    var repeats = (App && App.Trainer && typeof App.Trainer.starsMax === 'function')
      ? App.Trainer.starsMax()
      : ((App && App.state && App.state.repeats) || 3);

    for (var i=0; i<meta.total; i++){
      var start = i * meta.setSize;
      var end   = Math.min(deck.length, start + meta.setSize);
      var done  = isRangeDone(deck, start, end, repeats, starsMap);

      var btn = document.createElement('button');
      btn.className = 'setTile';
      btn.type = 'button';
      btn.textContent = String(i+1);
      if (i === meta.active){ btn.classList.add('active'); btn.setAttribute('aria-current','true'); }
      if (done){ btn.classList.add('done'); }
      btn.setAttribute('aria-pressed', (i===meta.active)?'true':'false');

      // доступность + клавиатура
      btn.setAttribute('role','tab');
      btn.setAttribute('tabindex','0');
      btn.addEventListener('keydown', function(ev){
        if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); this.click(); }
      });

      (function(idx){
        btn.addEventListener('click', function(){
          try{
            if (window.App && App.Trainer && typeof App.Trainer.setBatchIndex === 'function'){
              App.Trainer.setBatchIndex(idx);
            }
            if (typeof window.renderCard === 'function') renderCard(true);
            renderSetsBar();
          }catch(e){}
        });
      })(i);
      host.appendChild(btn);
    }

    // Прогресс активного набора (локализация): "Слов в наборе: totalInSet / Выучено: learnedInSet"
    var aStart = meta.active * meta.setSize;
    var aEnd   = Math.min(deck.length, aStart + meta.setSize);
    var totalInSet = Math.max(0, aEnd - aStart);
    var learnedInSet = 0;
    for (var j = aStart; j < aEnd; j++){
      var w = deck[j];
      if (!w) continue;
      var s = starsMap[w.id] || 0;
      if (s >= repeats) learnedInSet++;
    }

    var t = (App && typeof App.i18n === 'function') ? App.i18n() : {};
    var L_SET  = t.badgeSetWords || 'Слов в наборе';
    var L_DONE = t.badgeLearned  || 'Выучено';

    var badge = document.createElement('div');
    badge.className = 'setsBadge';
    badge.textContent = L_SET + ': ' + totalInSet + ' / ' + L_DONE + ': ' + learnedInSet;
    badge.setAttribute('aria-hidden','true');
    host.appendChild(badge);
  }

  // Hooks
  if (typeof window.renderCard === 'function'){
    var __origRC = window.renderCard;
    window.renderCard = function(){
      var r = __origRC.apply(this, arguments);
      try { renderSetsBar(); } catch(e){}
      return r;
    };
  }
  if (typeof window.renderDictList === 'function'){
    var __origDL = window.renderDictList;
    window.renderDictList = function(){
      var r = __origDL.apply(this, arguments);
      try { renderSetsBar(); } catch(e){}
      return r;
    };
  }

  // watcher активного словаря/размера набора/языка
  var __lastKey = null, __lastSize = null, __lastLang = null, __timer = null;
  function tickWatch(){
    if (document.hidden) return;
    var k = (window.App && App.dictRegistry && App.dictRegistry.activeKey) || null;
    var s = getSetSizeSafe();
    var l = (App && App.settings && App.settings.lang) || null;
    if (k !== __lastKey || s !== __lastSize || l !== __lastLang){
      __lastKey = k; __lastSize = s; __lastLang = l;
      try { renderSetsBar(); } catch(e){}
    }
  }
  function startWatch(){
    if (__timer) return;
    __lastKey  = (window.App && App.dictRegistry && App.dictRegistry.activeKey) || null;
    __lastSize = getSetSizeSafe();
    __lastLang = (App && App.settings && App.settings.lang) || null;
    __timer = setInterval(tickWatch, 300);
    document.addEventListener('visibilitychange', function(){
      if (!document.hidden) setTimeout(tickWatch, 50);
    });
  }

  // init
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ renderSetsBar(); startWatch(); });
  } else {
    renderSetsBar(); startWatch();
  }

  window.renderSetsBar = renderSetsBar;
})();
