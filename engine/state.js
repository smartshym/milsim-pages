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
    if(contest){
      // время старта фиксируется ОДИН раз; сбрасывается только при перехвате ДРУГОЙ стороной.
      // тот же захватчик (рефреш/рескан) таймер не сбрасывает.
      root.child('contests/' + flag).transaction(function(cur){
        if(cur && cur.side === side) return;              // abort — оставить как есть
        return { side:side, time:Date.now() };
      }, function(err, committed){
        if(!err && committed) root.child('contests/' + flag + '/time').set(TS());   // серверное время
      });
    }
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

  function wipe(){ return root.remove(); }                 // весь прогон (включая config)
  function resetState(){                                    // только состояние — config сохраняется
    return Promise.all(['captures','flags','contests','live','tracks','events']
      .map(function(k){ return root.child(k).remove(); }));
  }
  function resetCapture(id){ return root.child('captures/' + id).remove(); }   // сброс взятия одной точки (ошибочная активация)

  // --- конфиг игры в БД ---
  // Новая структура: settings + coords (список координат) + points (логика, ссылка coord).
  // Старая: единый config {sides,shared,geo,mechanics,objectives}. Адаптер читает/пишет обе,
  // а движок и админка работают с «рантайм»-формой (как старый config).

  function buildRuntime(settings, coords, points){         // new-структура → рантайм-конфиг
    settings = settings || {}; coords = coords || {}; points = points || {};
    var cfg = { sides:settings.sides, shared:settings.shared, geo:settings.geo, mechanics:settings.mechanics, coords:coords };
    cfg.objectives = Object.keys(points).map(function(id){
      var p = points[id], o = {}; for(var k in p) if(k!=='coord') o[k] = p[k];
      o.id = id;
      if(p.coord && coords[p.coord]){ o.coord = p.coord; o.at = [coords[p.coord].lat, coords[p.coord].lng]; }   // резолвим место для движка
      return o;
    });
    return cfg;
  }

  function toStructure(cfg){                                // рантайм-конфиг → new-структура
    cfg = cfg || {};
    var settings = { sides:cfg.sides, shared:cfg.shared, geo:cfg.geo, mechanics:cfg.mechanics };
    var coords = {}, points = {}, byKey = {}, n = 0;
    if(cfg.coords) for(var cid in cfg.coords){ var c=cfg.coords[cid];          // основа — существующий список координат
      if(c && c.lat!=null){ coords[cid] = { label:c.label||cid, lat:+c.lat, lng:+c.lng }; byKey[(+c.lat).toFixed(6)+','+(+c.lng).toFixed(6)] = cid; } }
    (cfg.objectives || []).forEach(function(o){
      var p = {}; for(var k in o) if(k!=='id' && k!=='at' && k!=='coord') p[k] = o[k];
      if(o.coord && coords[o.coord]) p.coord = o.coord;                        // ссылка на координату
      else if(o.at && o.at[0]!=null){                                          // нет ссылки, но есть место → дедуп/создать
        var key = (+o.at[0]).toFixed(6) + ',' + (+o.at[1]).toFixed(6);
        if(!byKey[key]){ var gid='coord'+(++n); while(coords[gid]) gid='coord'+(++n); byKey[key]=gid; coords[gid]={ label:(o.label||o.id||gid), lat:+o.at[0], lng:+o.at[1] }; }
        p.coord = byKey[key];
      }
      points[o.id] = p;
    });
    return { settings:settings, coords:coords, points:points };
  }

  function loadConfig(cb){
    Promise.all([ root.child('settings').once('value'), root.child('coords').once('value'), root.child('points').once('value') ])
      .then(function(r){
        var settings = r[0].val(), coords = r[1].val(), points = r[2].val();
        if(settings || points) cb(buildRuntime(settings, coords, points));
        else root.child('config').once('value').then(function(s){ cb(s.val()); }, function(){ cb(null); });   // фолбэк: старая структура
      }, function(){ cb(null); });
  }
  function saveConfig(cfg){
    var st = toStructure(cfg);
    return Promise.all([ root.child('settings').set(st.settings), root.child('coords').set(st.coords), root.child('points').set(st.points) ]);
  }
  function watchConfig(cb){ root.child('config').on('value', function(s){ cb(s.val()); }); }   // legacy, не используется

  return { init:init, deviceId:deviceId, serverNow:serverNow,
           emitCapture:emitCapture, emitFlag:emitFlag, reportPosition:reportPosition,
           subscribe:subscribe, wipe:wipe, resetState:resetState, resetCapture:resetCapture,
           loadConfig:loadConfig, saveConfig:saveConfig, watchConfig:watchConfig };
})();
