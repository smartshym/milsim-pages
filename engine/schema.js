// ============================================================================
//  SCHEMA — КАРКАС приложения (не игра). Справочник для админки + пустой шаблон.
//  Здесь только «из чего можно собрать игру»: типы точек, их поля, enum'ы правил,
//  дефолты и BLANK (валидный пустой прогон). Сама игра — в БД (game/<run>/config).
//  Добавить новый тип точки = правка данных здесь, а не логики формы.
// ============================================================================
window.SCHEMA = {
  // типы объектов (kind)
  KINDS: ['checkpoint', 'terminal', 'parking', 'storage', 'evac', 'start'],

  // kind'ы, у которых есть QR-страница (point.html) → в админке даётся QR-ссылка,
  // на карте стороны — кнопка «открыть страницу». Не завязано на onOpen (у start события нет).
  QR: ['checkpoint', 'terminal', 'evac', 'start'],

  // enum'ы правил (общие id/kind/side/lat/lng есть всегда)
  ENUMS: {
    reveal: ['always', 'captured', 'flag-side', 'flag-any'],
    onOpen: ['none', 'capture', 'flag', 'flag-contest']
  },

  // какие поля показывать в форме под конкретный kind
  FIELDS: {
    checkpoint: ['n', 'fragment', 'decoy'],
    terminal:   ['n', 'code', 'reveals', 'onSuccess'],
    parking:    ['label'],
    storage:    ['label'],
    evac:       ['label'],
    start:      ['label']
  },

  // дефолты reveal/onOpen по kind (подставляются в «Расширенное» при выборе типа)
  DEFAULTS: {
    checkpoint: { reveal: 'captured',  onOpen: 'capture' },
    terminal:   { reveal: 'captured',  onOpen: 'capture' },
    parking:    { reveal: 'always',    onOpen: 'none' },
    storage:    { reveal: 'flag-side', rvflag: 'storage', onOpen: 'none' },
    evac:       { reveal: 'flag-side', rvflag: 'evac',    onOpen: 'flag-contest', ooflag: 'evac' },
    start:      { reveal: 'always',    onOpen: 'none' }
  },

  // пустой ВАЛИДНЫЙ прогон — с него стартует чистый сервис, заполняется в админке.
  // геймплей тут отсутствует (objectives:[]); стороны/гео/механика — редактируемые дефолты.
  BLANK: {
    sides: {
      side1: { label: 'Сторона 1', color: '#4d9bff' },
      side2: { label: 'Сторона 2', color: '#ff4d4d' }
    },
    shared: { color: '#57c98a' },
    geo: { image: '../sandtorch/Boloto_v1.05.jpg',        // дефолт поля — поменяй под свой полигон
           north: 43.81687355441687, south: 43.78795236649337,
           east: 77.07101927537143, west: 77.04279873867411 },
    mechanics: { captureSec: 900, posIntervalSec: 60, staleSec: 300, showEnemyCaptures: true },
    objectives: []
  }
};
