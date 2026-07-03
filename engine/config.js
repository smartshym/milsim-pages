// ============================================================================
//  CONFIG — только bootstrap: подключение к Firebase + namespace прогона.
//  Игры здесь НЕТ. Каркас (типы/шаблон) — в schema.js, сама игра — в БД
//  (game/<run>/config, правится через admin.html). Файл можно обнулить —
//  сервис заполняется заново из админки, состояние снимается db.mjs.
// ============================================================================
window.GAME = {
  firebase: {
    apiKey:"AIzaSyCPrxWyVeUpNxtul8nOUNKRjf9Uo6wH-PA", authDomain:"milsim-pages.firebaseapp.com",
    databaseURL:"https://milsim-pages-default-rtdb.europe-west1.firebasedatabase.app",
    projectId:"milsim-pages", storageBucket:"milsim-pages.firebasestorage.app",
    messagingSenderId:"931830776663", appId:"1:931830776663:web:78976b5c11ce30dfc73412"
  },
  run: 'sandtorch'                  // namespace game/<run>/ (архив/сброс бесплатно)
};
