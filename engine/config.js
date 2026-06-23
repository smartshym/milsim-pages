// ============================================================================
//  CONFIG — единственная точка правды. Меняешь тут → меняется геймплей.
//  Движок (state.js / map.js / point.html) НЕ знает про конкретную игру —
//  только про объекты с правилами reveal/onOpen. Игра живёт здесь.
// ============================================================================
window.GAME = {
  // --- инфраструктура ---
  firebase: {
    apiKey:"AIzaSyCPrxWyVeUpNxtul8nOUNKRjf9Uo6wH-PA", authDomain:"milsim-pages.firebaseapp.com",
    databaseURL:"https://milsim-pages-default-rtdb.europe-west1.firebasedatabase.app",
    projectId:"milsim-pages", storageBucket:"milsim-pages.firebasestorage.app",
    messagingSenderId:"931830776663", appId:"1:931830776663:web:78976b5c11ce30dfc73412"
  },
  run: 'sandtorch',                 // версия прогона → namespace game/<run>/ (архив/сброс бесплатно)

  // --- карта (георефференс) ---
  geo: { image:'../sandtorch/Boloto_v1.05.jpg',
         north:43.81687355441687, south:43.78795236649337, east:77.07101927537143, west:77.04279873867411 },

  // --- механика (тюнинг) ---
  mechanics: { captureSec:60, posIntervalSec:60, staleSec:300 },   // captureSec=60 НА ТЕСТ (боевое ~900)

  // --- стороны ---
  sides: {
    coalition:  { label:'Коалиция',  color:'#4d9bff' },
    insurgents: { label:'Повстанцы', color:'#ff4d4d' }
  },
  shared: { color:'#57c98a' },

  // --- объекты игры ---
  //  reveal: 'always' | 'captured' | {flag, scope:'side'|'any'}
  //  onOpen: {event:'capture'} | {event:'flag', flag, contest?}
  //  kind:   recon | terminal | parking | storage | evac  (определяет вид/иконку)
  objectives: [
    // Коалиция — разведточки
    { id:'c1', side:'coalition', kind:'recon', n:1, at:[43.804082,77.053668], reveal:'captured', onOpen:{event:'capture'} },
    { id:'c2', side:'coalition', kind:'recon', n:2, at:[43.806936,77.055886], reveal:'captured', onOpen:{event:'capture'} },
    { id:'c3', side:'coalition', kind:'recon', n:3, at:[43.809940,77.054615], reveal:'captured', onOpen:{event:'capture'} },
    { id:'c4', side:'coalition', kind:'recon', n:4, at:[43.813578,77.057381], reveal:'captured', onOpen:{event:'capture'} },
    { id:'c5', side:'coalition', kind:'recon', n:5, at:[43.813807,77.051281], reveal:'captured', onOpen:{event:'capture'} },
    { id:'c6', side:'coalition', kind:'recon', n:6, at:[43.809303,77.049874], reveal:'captured', onOpen:{event:'capture'} },
    { id:'c7', side:'coalition', kind:'terminal', n:7, at:[43.805200,77.050870], reveal:'captured',
      onOpen:{event:'capture'}, code:['SH1HB','K4RUN','J3B3L','S4F4R'], onSuccess:{event:'flag', flag:'storage'} },

    // Повстанцы — разведточки
    { id:'p1', side:'insurgents', kind:'recon', n:1, at:[43.803964,77.056651], reveal:'captured', onOpen:{event:'capture'} },
    { id:'p2', side:'insurgents', kind:'recon', n:2, at:[43.806824,77.056102], reveal:'captured', onOpen:{event:'capture'} },
    { id:'p3', side:'insurgents', kind:'recon', n:3, at:[43.809647,77.058284], reveal:'captured', onOpen:{event:'capture'} },
    { id:'p4', side:'insurgents', kind:'recon', n:4, at:[43.813552,77.057619], reveal:'captured', onOpen:{event:'capture'} },
    { id:'p5', side:'insurgents', kind:'recon', n:5, at:[43.813710,77.051218], reveal:'captured', onOpen:{event:'capture'} },
    { id:'p6', side:'insurgents', kind:'recon', n:6, at:[43.809332,77.050331], reveal:'captured', onOpen:{event:'capture'} },
    { id:'p7', side:'insurgents', kind:'terminal', n:7, at:[43.804906,77.050699], reveal:'captured',
      onOpen:{event:'capture'}, code:['ANS4R','DR4G0','N1GHT','HMM3R'], onSuccess:{event:'flag', flag:'storage'} },

    // Общие точки
    { id:'parking', side:'shared', kind:'parking', label:'Парковка', at:[43.799435,77.048836], reveal:'always' },
    { id:'storage', side:'shared', kind:'storage', label:'Пункт хранения', at:[43.802538,77.050063],
      reveal:{flag:'storage', scope:'side'} },
    { id:'evac', side:'shared', kind:'evac', label:'Эвакуация', at:[43.795844,77.050030],
      reveal:{flag:'evac', scope:'side'}, onOpen:{event:'flag', flag:'evac', contest:true} }
  ]
};
