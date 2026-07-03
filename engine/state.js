// ============================================================================
//  STATE — тонкий адаптер над Firebase. Единая схема game/<run>/:
//    captures/<objId> = {side, device, time}   // первый захвативший
//    flags/<side>/<flag> = {time, device}       // storage / evac …
//    contests/<flag> = {side, time}             // объект с таймером (последний скан)
//    live/<device>   = {side, lat, lng, time}
//    tracks/<device>/<push> = {side, lat, lng, time}
//    events/<push>   = {type, objId, side, device, time}  // общий лог
//  Движок и страницы работают ТОЛЬКО через этот модуль.
// ============================================================================
window.State = (function(){
  var db, root, offset = 0, dev;
  function TS(){ return firebase.database.ServerValue.TIMESTAMP; }

  function deviceId(){
    var d = localStorage.getItem('sb_device');
    if(!d){ d = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
              : ('d-' + Date.now().toString(36) + Math.random().toString(36).slice(2,8));
            localStorage.setItem('sb_device', d); }
    return d;
  }

  function init(game){
    if(!firebase.apps.length) firebase.initializeApp(game.firebase);
    db = firebase.database();
    root = db.ref('game/' + game.run);
    db.ref('.info/serverTimeOffset').on('value', function(s){ offset = s.val() || 0; });
    dev = deviceId();
  }
  function serverNow(){ return Date.now() + offset; }

  function logEvent(type, objId, side){
    root.child('events').push({ type:type, objId:objId||null, side:side||null, device:dev, time:TS() });
  }

  // точку фиксирует ПЕРВЫЙ открывший (checkpoint/terminal)
  function emitCapture(objId, side){
    root.child('captures/' + objId).transaction(function(cur){
      return cur ? undefined : { side:side, device:dev, time:Date.now() };
    }, function(err, committed){
      if(err || !committed) return;                          // уже захвачено — не логируем повторно
      root.child('captures/' + objId + '/time').set(TS());   // серверное время захвата
      logEvent('capture', objId, side);
    });
  }

  // флаг стороне (storage/evac); contest=true → запускает таймер-контест
  function emitFlag(side, flag, contest){
    root.child('flags/' + side + '/' + flag).set({ time:TS(), device:dev });
    if(contest) root.child('contests/' + flag).set({ side:side, time:TS() });
    logEvent('flag:' + flag, null, side);
  }

  function reportPosition(side, lat, lng){
    root.child('live/' + dev).set({ side:side, lat:lat, lng:lng, time:TS() });
    root.child('tracks/' + dev).push({ side:side, lat:lat, lng:lng, time:TS() });
  }

  // подписка на всё состояние; cb(state) при каждом изменении
  function subscribe(cb){
    var state = { captures:{}, flags:{}, contests:{}, live:{}, tracks:{}, events:{} };
    ['captures','flags','contests','live','tracks','events'].forEach(function(k){
      root.child(k).on('value', function(s){ state[k] = s.val() || {}; cb(state, k); });   // передаём, что изменилось
    });
    return state;
  }

  function wipe(){ return root.remove(); }

  // --- конфиг игры в БД (game/<run>/config): редактируется из admin.html ---
  function loadConfig(cb){ root.child('config').once('value').then(function(s){ cb(s.val()); }, function(){ cb(null); }); }
  function saveConfig(cfg){ return root.child('config').set(cfg); }
  function watchConfig(cb){ root.child('config').on('value', function(s){ cb(s.val()); }); }

  return { init:init, deviceId:deviceId, serverNow:serverNow,
           emitCapture:emitCapture, emitFlag:emitFlag, reportPosition:reportPosition,
           subscribe:subscribe, wipe:wipe,
           loadConfig:loadConfig, saveConfig:saveConfig, watchConfig:watchConfig };
})();
