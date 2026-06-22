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
  var GEO={north:43.81687355441687,south:43.78795236649337,east:77.07101927537143,west:77.04279873867411};
  var bounds=[[GEO.south,GEO.west],[GEO.north,GEO.east]];

  var map=L.map('map',{zoomSnap:0.25,maxZoom:20});
  var gsat=L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{subdomains:['mt0','mt1','mt2','mt3'],maxZoom:21}).addTo(map);
  var drawn=L.imageOverlay('Boloto_v1.05.jpg',bounds);
  map.fitBounds(bounds); map.setMaxBounds(L.latLngBounds(bounds).pad(0.3));
  L.control.layers({'Спутник':gsat,'Рисованная карта':drawn},null,{collapsed:true}).addTo(map);

  // легенда — что значат маркеры
  var lg=document.createElement('div'); lg.className='legend';
  lg.innerHTML='<span><i class="d" style="background:#4d9bff"></i>взято · Коалиция</span>'
    +'<span><i class="d" style="background:#ff4d4d"></i>взято · Повстанцы</span>'
    +'<span><i class="d" style="background:#57c98a"></i>парковка</span>';
  document.body.appendChild(lg);

  function set(id,t){ var e=document.getElementById(id); if(e) e.textContent=t; }
  function deviceId(){ var d=localStorage.getItem('sb_device');
    if(!d){ d=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('d-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)); localStorage.setItem('sb_device',d); }
    return d; }
  function namedMarker(ll,color,name){
    return L.marker(ll,{icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],html:'<div class="pt" style="background:'+color+'"></div>'})})
      .bindTooltip(name,{permanent:true,direction:'right',offset:[10,0],className:'nm-tip'});
  }

  var ptLayer=L.layerGroup().addTo(map), achieved={coalition:{},insurgents:{}};
  function renderPoints(){
    ptLayer.clearLayers();
    namedMarker(PARKING,'#57c98a','Парковка').addTo(ptLayer);
    ['coalition','insurgents'].forEach(function(s){
      var cfg=SIDES[s], a=achieved[s]||{};
      Object.keys(a).forEach(function(k){
        var i=parseInt(k,10)-1; if(i<0||i>=cfg.pts.length) return;
        L.marker(L.latLng(cfg.pts[i][0],cfg.pts[i][1]),{icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],html:'<div class="pt" style="background:'+cfg.color+'">'+(i+1)+'</div>'})}).addTo(ptLayer);
      });
      set(s==='coalition'?'cC':'cI', Object.keys(a).length+' / 7');
    });
  }
  ['coalition','insurgents'].forEach(function(s){
    db.ref('visits/'+s).on('value',function(snap){ achieved[s]=snap.val()||{}; renderPoints(); });
  });

  // ----- своя позиция + отправка раз в минуту -----
  var me=null,acc=null,last=null;
  function onPos(p){ var c=p.coords; last=L.latLng(c.latitude,c.longitude);
    if(!me){ me=L.marker(last,{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
             acc=L.circle(last,{radius:c.accuracy,color:'#ffc24d',weight:1,fillOpacity:.06}).addTo(map); map.setView(last,16); }
    else { me.setLatLng(last); acc.setLatLng(last).setRadius(c.accuracy); }
    set('acc',Math.round(c.accuracy)+' м'); set('status','на связи'); }
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
