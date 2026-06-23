(function(){
  var firebaseConfig = {
    apiKey:"AIzaSyCPrxWyVeUpNxtul8nOUNKRjf9Uo6wH-PA", authDomain:"milsim-pages.firebaseapp.com",
    databaseURL:"https://milsim-pages-default-rtdb.europe-west1.firebasedatabase.app",
    projectId:"milsim-pages", storageBucket:"milsim-pages.firebasestorage.app",
    messagingSenderId:"931830776663", appId:"1:931830776663:web:78976b5c11ce30dfc73412" };
  firebase.initializeApp(firebaseConfig);
  var db=firebase.database();

  var MY_SIDE=window.SIDE;                 // 'coalition' | 'insurgents' — задаётся в самой странице
  var SIDES={
    coalition:{ label:'Коалиция', color:'#4d9bff', pts:[
      [43.804082,77.053668],[43.806936,77.055886],[43.809940,77.054615],[43.813578,77.057381],
      [43.813807,77.051281],[43.809303,77.049874],[43.805200,77.050870] ]},
    insurgents:{ label:'Повстанцы', color:'#ff4d4d', pts:[
      [43.803964,77.056651],[43.806824,77.056102],[43.809647,77.058284],[43.813552,77.057619],
      [43.813710,77.051218],[43.809332,77.050331],[43.804906,77.050699] ]}
  };
  var PARKING=L.latLng(43.799435,77.048836);
  var STORAGE=L.latLng(43.802538,77.050063), EVAC=L.latLng(43.795844,77.050030), myStorage=false, myEvac=false;
  var evacData={}, CAPTURE_SEC=15*60, serverOffset=0;   // длительность захвата (сек, настраиваемо) + смещение к серверному времени
  db.ref('.info/serverTimeOffset').on('value',function(s){ serverOffset=s.val()||0; });   // серверное время Firebase у всех одинаковое
  var GEO={north:43.81687355441687,south:43.78795236649337,east:77.07101927537143,west:77.04279873867411};
  var bounds=[[GEO.south,GEO.west],[GEO.north,GEO.east]];

  var map=L.map('map',{zoomSnap:0.25,maxZoom:20});
  var gsat=L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{subdomains:['mt0','mt1','mt2','mt3'],maxZoom:21}).addTo(map);
  var drawn=L.imageOverlay('Boloto_v1.05.jpg',bounds);
  map.fitBounds(bounds); map.setMaxBounds(L.latLngBounds(bounds).pad(0.3));
  L.control.layers({'Спутник':gsat,'Рисованная карта':drawn},null,{collapsed:true}).addTo(map);

  // верхняя панель: легенда + баннер захвата эвакуации
  var top=document.createElement('div'); top.id='top'; document.body.appendChild(top);
  var lg=document.createElement('div'); lg.className='legend';
  lg.innerHTML='<span><i class="d" style="background:#4d9bff"></i>Коалиция</span>'
    +'<span><i class="d" style="background:#ff4d4d"></i>Повстанцы</span>'
    +'<span>✓ — взято · пульс — ваша цель</span>'
    +'<span><i class="d" style="background:#57c98a"></i>парковка</span>';
  top.appendChild(lg);
  var capbar=document.createElement('div'); capbar.id='capbar'; capbar.style.display='none'; top.appendChild(capbar);

  function fmtMMSS(s){ s=Math.max(0,Math.floor(s)); var m=Math.floor(s/60), ss=s%60; return (m<10?'0':'')+m+':'+(ss<10?'0':'')+ss; }
  function renderCap(){
    var c=evacData.coalition&&evacData.coalition.time, i=evacData.insurgents&&evacData.insurgents.time;
    if(!c && !i){ capbar.style.display='none'; return; }
    var capturer, start;
    if((c||0)>=(i||0)){ capturer='coalition'; start=c; } else { capturer='insurgents'; start=i; }
    var elapsed=(Date.now()+serverOffset-start)/1000;
    capbar.style.display='block';
    if(capturer===MY_SIDE){
      capbar.className='green';
      capbar.textContent = elapsed>=CAPTURE_SEC ? 'Точка эвакуации захвачена ✓' : ('Захват точки эвакуации · '+fmtMMSS(elapsed));
    } else {
      capbar.className='red';
      var left=CAPTURE_SEC-elapsed;
      capbar.textContent = left<=0 ? 'Точка эвакуации потеряна' : ('Противник захватывает точку · '+fmtMMSS(left));
    }
  }

  function set(id,t){ var e=document.getElementById(id); if(e) e.textContent=t; }
  function deviceId(){ var d=localStorage.getItem('sb_device');
    if(!d){ d=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('d-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)); localStorage.setItem('sb_device',d); }
    return d; }
  function namedMarker(ll,color,name){
    return L.marker(ll,{icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],html:'<div class="pt" style="background:'+color+'"></div>'})})
      .bindTooltip(name,{permanent:true,direction:'right',offset:[10,0],className:'nm-tip'});
  }

  // ----- выбор точки: пунктир + дистанция + направление -----
  var selected=null, link=null;
  function bearing(a,b){
    var la1=a.lat*Math.PI/180, la2=b.lat*Math.PI/180, dLon=(b.lng-a.lng)*Math.PI/180;
    var y=Math.sin(dLon)*Math.cos(la2);
    var x=Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dLon);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
  }
  function bearingStr(a,b){ var d=bearing(a,b), dirs=['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ']; return dirs[Math.round(d/45)%8]+' '+Math.round(d)+'°'; }
  function select(ll){ selected=ll; updateLine(); }
  function bindSel(m,ll){ m.on('click',function(e){ L.DomEvent.stopPropagation(e); select(ll); }); return m; }
  function updateLine(){
    if(!selected) return;
    if(last){
      var d=map.distance(last,selected);
      set('dist', d>=1000?(d/1000).toFixed(2)+' км':Math.round(d)+' м');
      set('brg', bearingStr(last,selected));
      if(!link) link=L.polyline([last,selected],{color:'#ffc24d',weight:1.5,dashArray:'5,5'}).addTo(map);
      else link.setLatLngs([last,selected]);
    } else { set('dist','—'); set('brg','нет GPS'); }
  }

  var ptLayer=L.layerGroup().addTo(map), achieved={coalition:{},insurgents:{}};
  function renderPoints(){
    ptLayer.clearLayers();
    bindSel(namedMarker(PARKING,'#57c98a','Парковка'),PARKING).addTo(ptLayer);
    ['coalition','insurgents'].forEach(function(s){
      var cfg=SIDES[s], a=achieved[s]||{};
      Object.keys(a).forEach(function(k){
        var i=parseInt(k,10)-1; if(i<0||i>=cfg.pts.length) return;
        var pll=L.latLng(cfg.pts[i][0],cfg.pts[i][1]);
        bindSel(L.marker(pll,{icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],html:'<div class="pt" style="background:'+cfg.color+'">'+(i+1)+'<span class="chk">✓</span></div>'})}),pll).addTo(ptLayer);
      });
      set(s==='coalition'?'cC':'cI', Object.keys(a).length+' / 7');
    });
    // следующая цель своей стороны (та, которую надо достичь) — пульсирует
    if(MY_SIDE && SIDES[MY_SIDE]){
      var mc=SIDES[MY_SIDE], ma=achieved[MY_SIDE]||{}, nx=-1;
      for(var j=0;j<mc.pts.length;j++){ if(!ma[(j+1)]){ nx=j; break; } }
      if(nx>=0){
        var tll=L.latLng(mc.pts[nx][0],mc.pts[nx][1]);
        bindSel(L.marker(tll,{icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],
          html:'<div class="pt cur" style="background:'+mc.color+'">'+(nx+1)+'</div>'})}),tll).addTo(ptLayer);
      }
    }
    // пункт хранения — после верного кода терминала; эвакуация — после открытия её страницы. Каждое у своей стороны.
    if(myStorage) bindSel(namedMarker(STORAGE,'#ff9a2e','Пункт хранения'),STORAGE).addTo(ptLayer);
    if(myEvac) bindSel(namedMarker(EVAC,'#ffd24d','Эвакуация'),EVAC).addTo(ptLayer);
  }
  ['coalition','insurgents'].forEach(function(s){
    db.ref('visits/'+s).on('value',function(snap){ achieved[s]=snap.val()||{}; renderPoints(); });
  });
  if(MY_SIDE && SIDES[MY_SIDE]){
    db.ref('unlocked/'+MY_SIDE).on('value',function(snap){ myStorage=!!snap.val(); renderPoints(); });
    db.ref('evac').on('value',function(snap){ evacData=snap.val()||{}; myEvac=!!evacData[MY_SIDE]; renderPoints(); renderCap(); });
    setInterval(renderCap,1000);
  }

  // ----- своя позиция + отправка раз в минуту -----
  var me=null,acc=null,last=null;
  function onPos(p){ var c=p.coords; last=L.latLng(c.latitude,c.longitude);
    if(!me){ me=L.marker(last,{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
             acc=L.circle(last,{radius:c.accuracy,color:'#ffc24d',weight:1,fillOpacity:.06}).addTo(map); map.setView(last,16); }
    else { me.setLatLng(last); acc.setLatLng(last).setRadius(c.accuracy); }
    set('acc',Math.round(c.accuracy)+' м'); set('status','на связи'); updateLine(); }
  function report(){ if(!last||!MY_SIDE) return; var d=deviceId(), t=Date.now();
    db.ref('live/'+d).set({side:MY_SIDE,lat:last.lat,lng:last.lng,time:t});
    db.ref('tracks/'+d).push({side:MY_SIDE,lat:last.lat,lng:last.lng,time:t}); }

  if(MY_SIDE && SIDES[MY_SIDE]){
    set('who',SIDES[MY_SIDE].label);
    if(!navigator.geolocation){ set('status','геолокация не поддерживается'); }
    else { navigator.geolocation.watchPosition(onPos,function(e){ set('status','GPS: '+e.message); },{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
           setInterval(report,60000); setTimeout(report,5000); }
  } else { set('status','сторона не задана'); }
})();
