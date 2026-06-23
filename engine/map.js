// ============================================================================
//  MAP — рендерер. Один файл на все виды: ?view=coalition|insurgents|admin.
//  Ничего про «Шихаб» не знает: рисует objectives по их reveal/onOpen из CONFIG.
// ============================================================================
(function(){
  var GAME = window.GAME;
  var VIEW = (location.search.match(/view=([a-z]+)/) || [])[1];
  var isAdmin = VIEW === 'admin';
  var isSide  = !!(GAME.sides[VIEW]);

  if(!isAdmin && !isSide){          // нет валидного вида — простой выбор
    document.body.innerHTML = '<div style="height:100%;display:flex;flex-direction:column;'
      + 'align-items:center;justify-content:center;gap:12px;font-family:monospace;color:#e3ad45">'
      + '<a style="color:#4d9bff" href="?view=coalition">Коалиция</a>'
      + '<a style="color:#ff4d4d" href="?view=insurgents">Повстанцы</a>'
      + '<a style="color:#ffc24d" href="?view=admin">Админ</a></div>';
    return;
  }

  State.init(GAME);
  var KIND = { parking:'#57c98a', storage:'#ff9a2e', evac:'#ffd24d' };
  function objColor(o){ return o.side !== 'shared' ? GAME.sides[o.side].color : (KIND[o.kind] || '#888'); }
  function set(id,t){ var e=document.getElementById(id); if(e) e.textContent=t; }
  function mmss(s){ s=Math.max(0,Math.floor(s)); var m=Math.floor(s/60),ss=s%60; return (m<10?'0':'')+m+':'+(ss<10?'0':'')+ss; }

  // --- карта ---
  var b=GAME.geo, bounds=[[b.south,b.west],[b.north,b.east]];
  var map=L.map('map',{zoomSnap:0.25,maxZoom:20});
  var gsat=L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{subdomains:['mt0','mt1','mt2','mt3'],maxZoom:21}).addTo(map);
  var drawn=L.imageOverlay(b.image,bounds);
  map.fitBounds(bounds); map.setMaxBounds(L.latLngBounds(bounds).pad(0.3));
  L.control.layers({'Спутник':gsat,'Рисованная карта':drawn},null,{collapsed:true}).addTo(map);

  // --- UI ---
  var top=document.createElement('div'); top.id='top'; document.body.appendChild(top);
  if(isSide){
    var lg=document.createElement('div'); lg.className='legend';
    lg.innerHTML='<span><i class="d" style="background:'+GAME.sides.coalition.color+'"></i>Коалиция</span>'
      +'<span><i class="d" style="background:'+GAME.sides.insurgents.color+'"></i>Повстанцы</span>'
      +'<span>✓ — взято · пульс — ваша цель</span>'
      +'<span><i class="d" style="background:'+KIND.parking+'"></i>парковка</span>';
    top.appendChild(lg);
  }
  var capbar=document.createElement('div'); capbar.id='capbar'; capbar.style.display='none'; top.appendChild(capbar);

  var panel=document.createElement('div'); panel.id='panel'; document.body.appendChild(panel);
  if(isAdmin){
    panel.className='admin';
    panel.innerHTML='<h1>Админ · '+GAME.run+'</h1>'
      +'<div class="cell"><span class="k">Устройств онлайн</span><span class="v" id="dev">0</span></div>'
      +'<div class="cell"><span class="k">До точки</span><span class="v" id="dist">—</span></div>'
      +'<div class="cell"><span class="k">Направление</span><span class="v" id="brg">—</span></div>';
  } else {
    panel.innerHTML='<div><div class="k">Сторона</div><div class="v">'+GAME.sides[VIEW].label+'</div></div>'
      +'<div><div class="k">Точность</div><div class="v" id="acc">—</div></div>'
      +'<div><div class="k">До точки</div><div class="v" id="dist">—</div></div>'
      +'<div><div class="k">Направление</div><div class="v" id="brg">—</div></div>'
      +'<div class="full"><div class="k">Статус</div><div class="v" id="status">ожидание GPS…</div></div>';
  }

  // --- маркеры ---
  function ptIcon(color,inner,cls){ return L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],
    html:'<div class="pt '+(cls||'')+'" style="background:'+color+'">'+inner+'</div>'}); }
  function named(at,color,name,sub){
    var html='<span class="nm-name">'+name+'</span>'+(sub?'<span class="nm-sub">'+sub+'</span>':'');
    return L.marker(at,{icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],html:'<div class="pt" style="background:'+color+'"></div>'})})
      .bindTooltip(html,{permanent:true,direction:'right',offset:[10,0],className:'nm-tip'});
  }

  // --- правила видимости / доступа ---
  function revealed(o,st){
    var r=o.reveal||'always';
    if(r==='always') return true;
    if(r==='captured') return !!st.captures[o.id];
    if(r&&r.flag){
      if(r.scope==='side') return !!(st.flags[VIEW]&&st.flags[VIEW][r.flag]);
      return Object.keys(GAME.sides).some(function(s){ return st.flags[s]&&st.flags[s][r.flag]; });
    }
    return true;
  }
  function accessSub(flag,st){ var p=[];
    Object.keys(GAME.sides).forEach(function(s){ if(st.flags[s]&&st.flags[s][flag]) p.push('<span style="color:'+GAME.sides[s].color+'">'+GAME.sides[s].label+'</span>'); });
    return 'доступ: '+(p.length?p.join(' · '):'—');
  }

  // --- тап по точке: пунктир + дистанция + направление ---
  var last=null, selected=null, link=null;
  function bearing(a,c){ var la1=a.lat*Math.PI/180,la2=c.lat*Math.PI/180,dL=(c.lng-a.lng)*Math.PI/180;
    var y=Math.sin(dL)*Math.cos(la2),x=Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dL);
    return (Math.atan2(y,x)*180/Math.PI+360)%360; }
  function bearingStr(a,c){ var d=bearing(a,c),dirs=['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ']; return dirs[Math.round(d/45)%8]+' '+Math.round(d)+'°'; }
  function select(ll){ selected=ll; updateLine(); }
  function bindSel(m,ll){ m.on('click',function(e){ L.DomEvent.stopPropagation(e); select(ll); }); return m; }
  function updateLine(){
    if(!selected) return;
    if(last){ var d=map.distance(last,selected);
      set('dist', d>=1000?(d/1000).toFixed(2)+' км':Math.round(d)+' м'); set('brg', bearingStr(last,selected));
      if(!link) link=L.polyline([last,selected],{color:'#ffc24d',weight:1.5,dashArray:'5,5'}).addTo(map);
      else link.setLatLngs([last,selected]);
    } else { set('dist','—'); set('brg','нет GPS'); }
  }

  // --- слои ---
  var objLayer=L.layerGroup().addTo(map);
  var liveLayer = isAdmin ? L.layerGroup().addTo(map) : null;
  var trackLayer= isAdmin ? L.layerGroup().addTo(map) : null;
  var contestFlags = GAME.objectives.filter(function(o){return o.onOpen&&o.onOpen.contest;}).map(function(o){return o.onOpen.flag;});

  function renderObjectives(st){
    objLayer.clearLayers();
    GAME.objectives.forEach(function(o){
      var at=L.latLng(o.at[0],o.at[1]), color=objColor(o), captured=!!st.captures[o.id];
      var numbered=(o.kind==='recon'||o.kind==='terminal');
      if(isAdmin){
        if(numbered){ var inner=o.n+(captured?'<span class="chk">✓</span>':'');
          bindSel(L.marker(at,{icon:ptIcon(color,inner,captured?'':'todo')}),at).addTo(objLayer);
        } else { var sub=(o.reveal&&o.reveal.flag)?accessSub(o.reveal.flag,st):null;
          bindSel(named(at,color,o.label,sub),at).addTo(objLayer); }
      } else {
        if(!revealed(o,st)) return;
        if(numbered){ bindSel(L.marker(at,{icon:ptIcon(color,o.n+(captured?'<span class="chk">✓</span>':''),'')}),at).addTo(objLayer); }
        else { bindSel(named(at,color,o.label,null),at).addTo(objLayer); }
      }
    });
    if(isSide){      // своя следующая цель (пульс)
      var mine=GAME.objectives.filter(function(o){return o.side===VIEW&&(o.kind==='recon'||o.kind==='terminal');}).sort(function(a,c){return a.n-c.n;});
      var tgt=null; for(var i=0;i<mine.length;i++){ if(!st.captures[mine[i].id]){ tgt=mine[i]; break; } }
      if(tgt){ var t=L.latLng(tgt.at[0],tgt.at[1]); bindSel(L.marker(t,{icon:ptIcon(GAME.sides[VIEW].color,tgt.n,'cur')}),t).addTo(objLayer); }
    }
    if(last) updateLine();
  }

  function renderLive(st){
    if(!isAdmin) return;
    liveLayer.clearLayers(); var now=State.serverNow(), online=0, stale=GAME.mechanics.staleSec*1000;
    Object.keys(st.live).forEach(function(d){ var p=st.live[d]; if(!p||p.lat==null) return;
      var col=(GAME.sides[p.side]&&GAME.sides[p.side].color)||'#aaa', old=(now-(p.time||0))>stale; if(!old) online++;
      L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',iconSize:[11,11],iconAnchor:[5,5],
        html:'<div class="dot '+(old?'stale':'')+'" style="background:'+col+'"></div>'}),title:p.side+' · '+d}).addTo(liveLayer);
    });
    set('dev',online);
    trackLayer.clearLayers();
    Object.keys(st.tracks).forEach(function(d){ var pts=st.tracks[d],arr=[],col='#888';
      Object.keys(pts).forEach(function(k){ var e=pts[k]; if(e&&e.lat!=null){ arr.push(e); if(e.side&&GAME.sides[e.side]) col=GAME.sides[e.side].color; } });
      arr.sort(function(a,c){return (a.time||0)-(c.time||0);}); var N=arr.length;
      for(var i=0;i<N-1;i++){ var f=(i+1)/(N-1);
        L.polyline([[arr[i].lat,arr[i].lng],[arr[i+1].lat,arr[i+1].lng]],{color:col,weight:1+1.6*f,opacity:0.12+0.78*f}).addTo(trackLayer); }
    });
  }

  function renderCap(st){
    var shown=false, dur=GAME.mechanics.captureSec;
    for(var fi=0;fi<contestFlags.length;fi++){
      var c=st.contests[contestFlags[fi]]; if(!c||!c.time) continue; shown=true;
      var elapsed=(State.serverNow()-c.time)/1000;
      if(isSide){
        if(c.side===VIEW){ capbar.className='green'; capbar.textContent= elapsed>=dur?'Точка захвачена ✓':('Захват точки · '+mmss(elapsed)); }
        else { capbar.className='red'; var left=dur-elapsed; capbar.textContent= left<=0?'Точка потеряна':('Противник захватывает точку · '+mmss(left)); }
      } else { capbar.className='neutral';
        capbar.textContent='Захват ('+((GAME.sides[c.side]||{}).label||c.side)+') · осталось '+mmss(Math.max(0,dur-elapsed)); }
      break;
    }
    capbar.style.display = shown ? 'block' : 'none';
  }

  var STATE = State.subscribe(function(st){ renderObjectives(st); renderLive(st); renderCap(st); });
  setInterval(function(){ renderCap(STATE); }, 1000);

  // --- своя позиция (+ отправка у сторон) ---
  var me=null, acc=null;
  if(navigator.geolocation){
    navigator.geolocation.watchPosition(function(p){ var c=p.coords; last=L.latLng(c.latitude,c.longitude);
      if(!me){ me=L.marker(last,{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
               acc=L.circle(last,{radius:c.accuracy,color:'#ffc24d',weight:1,fillOpacity:.06}).addTo(map); if(isSide) map.setView(last,16); }
      else { me.setLatLng(last); acc.setLatLng(last).setRadius(c.accuracy); }
      set('acc',Math.round(c.accuracy)+' м'); set('status','на связи'); updateLine();
    }, function(e){ set('status','GPS: '+e.message); }, {enableHighAccuracy:true,maximumAge:1000,timeout:15000});
  } else { set('status','геолокация не поддерживается'); }

  if(isSide){
    var iv=GAME.mechanics.posIntervalSec*1000;
    setInterval(function(){ if(last) State.reportPosition(VIEW,last.lat,last.lng); }, iv);
    setTimeout(function(){ if(last) State.reportPosition(VIEW,last.lat,last.lng); }, 5000);
  }
})();
