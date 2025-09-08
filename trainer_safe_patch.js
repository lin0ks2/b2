// trainer_safe_patch.js — safety shims for sets (non-destructive)
(function(){
  if (!window.App || !App.Trainer) return;

  // Clamp current batch index to available range
  function clampBatchIndex(idx, total){
    if (typeof idx !== 'number') idx = 0;
    if (idx < 0) idx = 0;
    if (total && idx >= total) idx = total - 1;
    return idx;
  }

  // Wrap getBatchIndex / setBatchIndex to keep index in range (if API present)
  if (typeof App.Trainer.getBatchIndex === 'function' &&
      typeof App.Trainer.setBatchIndex === 'function' &&
      typeof App.Trainer.getBatchesMeta === 'function'){
    var __origGet = App.Trainer.getBatchIndex;
    var __origSet = App.Trainer.setBatchIndex;
    App.Trainer.getBatchIndex = function(){
      var meta = App.Trainer.getBatchesMeta();
      var total = (meta && typeof meta.total === 'number') ? meta.total : (Array.isArray(meta) ? meta.length : 0);
      var idx = __origGet.apply(this, arguments);
      return clampBatchIndex(idx, total);
    };
    App.Trainer.setBatchIndex = function(i){
      var meta = App.Trainer.getBatchesMeta();
      var total = (meta && typeof meta.total === 'number') ? meta.total : (Array.isArray(meta) ? meta.length : 0);
      return __origSet.call(this, clampBatchIndex(i, total));
    };
  }

  // Safe deck slice: returns set-slice if non-empty, otherwise fallback to full deck
  if (!App.Trainer.safeGetDeckSlice){
    App.Trainer.safeGetDeckSlice = function(deckKey){
      try{
        var slice = (typeof App.Trainer.getDeckSlice === 'function') ? App.Trainer.getDeckSlice(deckKey) : [];
        if (Array.isArray(slice) && slice.length) return slice;
      }catch(e){}
      try{
        return (App.Decks && App.Decks.resolveDeckByKey)
          ? (App.Decks.resolveDeckByKey(App.dictRegistry && App.dictRegistry.activeKey) || [])
          : [];
      }catch(e){}
      return [];
    };
  }

  // Alias for older UI calls
  if (!App.Trainer.sampleNextIndexWeighted && App.Trainer.pickNextIndexWeighted) {
    App.Trainer.sampleNextIndexWeighted = App.Trainer.pickNextIndexWeighted;
  }
})();
