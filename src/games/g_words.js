/* ===== Слова и знания ===== */
const W5 = 'книга ручка школа класс парта доска мечта весна осень пенал атлас повар рынок город улица дверь стена крыша кухня лампа диван ковер полка чашка ложка вилка сахар масло сырок груша вишня слива арбуз лимон банан салат берег озеро гроза ветер туман вечер месяц зебра белка мышка кошка птица жираф бобер сокол ворон дятел пчела театр песня танец сцена экран фильм актер роман поэма рифма зачет отдых режим отряд норма метод цифра число сумма дробь точка линия право закон налог отчет бланк папка шутка спорт робот канал почта марка билет поезд вагон такси метро сосна пихта ольха трава цветы астра пион роза мороз вьюга тесто пирог блины каша носок шапка шарф кепка майка брюки обувь сапог перец огурец'.split(' ').filter(w => w.length === 5);
game({
  id: 'wordle', name: 'Пять букв', like: 'похоже на Wordle', cat: 'words', icon: '🟩', c1: '#57cc99', c2: '#22577a', demo: [1, 24], minSec: 5,
  rules: ['Угадайте слово из 5 букв за 6 попыток.', 'Зелёная буква стоит на своём месте, жёлтая есть в слове, но в другом месте, серая — нет в слове.', 'Рейтинг — серия угаданных слов подряд. Ошибка обнуляет серию.', 'В прототипе принимается любое слово из 5 букв, в приложении будет проверка по словарю.'],
  run(el, ctx) {
    const ans = pick(W5); let row = 0, cur = '', done = false; const rows = [], st = {};
    const streak = LS.get('wordleStreak', 0); ctx.score(streak);
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: 'repeat(5,1fr)', width: 'min(100%,300px)', gap: '6px' } });
    for (let i = 0; i < 30; i++) { const d = h('div', { style: { border: '2px solid var(--br)', borderRadius: '8px', fontSize: '26px', textTransform: 'uppercase', fontFamily: 'var(--f-num)', transition: 'transform .25s' } }); rows.push(d); bd.append(d); }
    const inf = info(el, 'Серия: <b>' + streak + '</b>'); el.append(bd);
    const kbw = h('div', { style: { width: '100%', display: 'flex', justifyContent: 'center' } }); el.append(kbw);
    const keys = kbRU(kbw, k => key(k), 'Ввод');
    const paint = () => { for (let i = 0; i < 5; i++) { const c = rows[row * 5 + i]; c.textContent = cur[i] || ''; c.style.borderColor = cur[i] ? 'var(--mu)' : 'var(--br)'; } };
    const key = k => {
      if (done) return;
      if (k === 'BS') cur = cur.slice(0, -1); else if (k === 'EN') return submit(); else if (cur.length < 5) cur += k;
      paint();
    };
    const submit = async () => {
      if (cur.length < 5) return ctx.toast('Нужно 5 букв');
      const res = Array(5).fill('x'), pool = [...ans];
      [...cur].forEach((ch, i) => { if (ans[i] === ch) { res[i] = 'g'; pool[i] = null; } });
      [...cur].forEach((ch, i) => { if (res[i] !== 'g') { const j = pool.indexOf(ch); if (j >= 0) { res[i] = 'y'; pool[j] = null; } } });
      const word = cur, r0 = row; done = true;
      for (let i = 0; i < 5; i++) {
        const c = rows[r0 * 5 + i]; c.style.transform = 'rotateX(90deg)'; await sleep(120);
        c.style.background = res[i] === 'g' ? 'var(--ok)' : res[i] === 'y' ? '#d9a400' : 'var(--mu)'; c.style.borderColor = 'transparent'; c.style.color = '#fff'; c.style.transform = '';
        const kb = keys[word[i]], rank = { x: 0, y: 1, g: 2 }; if (kb && (st[word[i]] == null || rank[res[i]] > rank[st[word[i]]])) { st[word[i]] = res[i]; kb.className = res[i]; }
      }
      if (!ctx.alive) return;
      if (word === ans) { const s = streak + 1; LS.set('wordleStreak', s); ctx.score(s); ctx.finish(s, 'Угадано с ' + (r0 + 1) + '-й попытки. Серия: ' + s); return; }
      row++; cur = ''; done = false;
      if (row === 6) { done = true; LS.set('wordleStreak', 0); inf.innerHTML = 'Было слово: <b>' + ans.toUpperCase() + '</b>'; ctx.finish(0, 'Слово было: ' + ans.toUpperCase() + '. Серия обнулилась.'); }
    };
    physKeys(ctx, key);
  }
});

const COUNTRIES = [['BY', 'Беларусь', 'Минск'], ['RU', 'Россия', 'Москва'], ['UA', 'Украина', 'Киев'], ['PL', 'Польша', 'Варшава'], ['LT', 'Литва', 'Вильнюс'], ['LV', 'Латвия', 'Рига'], ['EE', 'Эстония', 'Таллин'], ['DE', 'Германия', 'Берлин'], ['FR', 'Франция', 'Париж'], ['IT', 'Италия', 'Рим'], ['ES', 'Испания', 'Мадрид'], ['PT', 'Португалия', 'Лиссабон'], ['GB', 'Великобритания', 'Лондон'], ['IE', 'Ирландия', 'Дублин'], ['NL', 'Нидерланды', 'Амстердам'], ['BE', 'Бельгия', 'Брюссель'], ['CH', 'Швейцария', 'Берн'], ['AT', 'Австрия', 'Вена'], ['CZ', 'Чехия', 'Прага'], ['SK', 'Словакия', 'Братислава'], ['HU', 'Венгрия', 'Будапешт'], ['RO', 'Румыния', 'Бухарест'], ['BG', 'Болгария', 'София'], ['GR', 'Греция', 'Афины'], ['TR', 'Турция', 'Анкара'], ['SE', 'Швеция', 'Стокгольм'], ['NO', 'Норвегия', 'Осло'], ['FI', 'Финляндия', 'Хельсинки'], ['DK', 'Дания', 'Копенгаген'], ['IS', 'Исландия', 'Рейкьявик'], ['RS', 'Сербия', 'Белград'], ['HR', 'Хорватия', 'Загреб'], ['MD', 'Молдова', 'Кишинёв'], ['GE', 'Грузия', 'Тбилиси'], ['AM', 'Армения', 'Ереван'], ['AZ', 'Азербайджан', 'Баку'], ['KZ', 'Казахстан', 'Астана'], ['UZ', 'Узбекистан', 'Ташкент'], ['CN', 'Китай', 'Пекин'], ['JP', 'Япония', 'Токио'], ['KR', 'Южная Корея', 'Сеул'], ['IN', 'Индия', 'Нью-Дели'], ['VN', 'Вьетнам', 'Ханой'], ['TH', 'Таиланд', 'Бангкок'], ['ID', 'Индонезия', 'Джакарта'], ['EG', 'Египет', 'Каир'], ['ZA', 'ЮАР', 'Претория'], ['NG', 'Нигерия', 'Абуджа'], ['KE', 'Кения', 'Найроби'], ['MA', 'Марокко', 'Рабат'], ['US', 'США', 'Вашингтон'], ['CA', 'Канада', 'Оттава'], ['MX', 'Мексика', 'Мехико'], ['BR', 'Бразилия', 'Бразилиа'], ['AR', 'Аргентина', 'Буэнос-Айрес'], ['CL', 'Чили', 'Сантьяго'], ['PE', 'Перу', 'Лима'], ['CU', 'Куба', 'Гавана'], ['AU', 'Австралия', 'Канберра'], ['NZ', 'Новая Зеландия', 'Веллингтон']];
const flagEmoji = cc => String.fromCodePoint(...[...cc].map(c => 0x1F1A5 + c.charCodeAt(0)));
game({
  id: 'flags', name: 'Флаги и столицы', like: 'викторина', cat: 'words', icon: '🌍', c1: '#48cae4', c2: '#023e8a', demo: [40, 290], rate: 15, minSec: 15,
  rules: ['15 вопросов, на каждый 10 секунд.', 'Режимы: угадать страну по флагу или столицу по стране.', 'За верный ответ 10 очков плюс бонус за скорость.', 'На Windows флаги-эмодзи могут показываться буквами — в приложении будут картинки.'],
  run(el, ctx) {
    const seg = h('div', { class: 'seg', style: { width: 'min(100%,340px)' } }); ctx.score('');
    el.append(h('div', { class: 'card', style: { width: 'min(100%,360px)', textAlign: 'center' } }, h('b', null, 'Режим'), h('div', { style: { height: '10px' } }), seg));
    [['Флаги', 'f'], ['Столицы', 'c'], ['Вперемешку', 'm']].forEach(([t, m]) => seg.append(h('button', { onclick: () => { el.innerHTML = ''; play(m); } }, t)));
    const play = mode => {
      const qs = shuffle(COUNTRIES.slice()).slice(0, 15); let qi = 0, sc = 0, right = 0, tl, tid;
      const q = h('div', { style: { textAlign: 'center', minHeight: '150px', display: 'grid', placeItems: 'center' } });
      const bar = h('div', { style: { height: '6px', borderRadius: '6px', background: 'var(--ac)', width: '100%', transition: 'width .1s linear' } });
      const opts = h('div', { style: { display: 'grid', gap: '8px', width: 'min(100%,400px)' } });
      const inf = info(el); el.append(h('div', { style: { width: 'min(100%,400px)', background: 'var(--br)', borderRadius: '6px' } }, bar), q, opts); ctx.score(0);
      const next = () => {
        if (qi >= 15) { ctx.finish(sc, `Верных ответов: ${right} из 15`); return; }
        const c = qs[qi], m = mode === 'm' ? (Math.random() < .5 ? 'f' : 'c') : mode;
        const wrong = shuffle(COUNTRIES.filter(x => x !== c)).slice(0, 3), all = shuffle([c, ...wrong]);
        q.innerHTML = ''; q.append(m === 'f' ? h('div', null, h('div', { style: { fontSize: '96px', lineHeight: 1 } }, flagEmoji(c[0])), h('div', { class: 'hint' }, 'Чей это флаг?')) : h('div', null, h('div', { class: 'hint' }, 'Столица страны'), h('div', { style: { fontSize: '30px', fontWeight: 800 } }, c[1])));
        opts.innerHTML = ''; inf.innerHTML = `Вопрос <b>${qi + 1}</b> из 15`;
        let answered = false; tl = 10;
        const ans = (o, b) => {
          if (answered) return; answered = true; clearInterval(tid);
          if (o === c) { right++; sc += 10 + Math.round(tl); b && (b.style.background = 'var(--ok)', b.style.color = '#fff'); }
          else { b && (b.style.background = 'var(--rd)', b.style.color = '#fff'); [...opts.children][all.indexOf(c)].style.background = 'var(--okb)'; }
          ctx.score(sc); qi++; ctx.later(next, 900);
        };
        all.forEach(o => { const b = h('button', { class: 'nb', style: { padding: '14px', fontSize: '16px', background: 'var(--card)', color: 'var(--tx)', boxShadow: 'var(--sh)' }, onclick: () => ans(o, b) }, m === 'f' ? o[1] : o[2]); opts.append(b); });
        tid = setInterval(() => { tl -= .1; bar.style.width = Math.max(0, tl * 10) + '%'; if (tl <= 0) ans(null); }, 100);
      };
      ctx.cleanup(() => clearInterval(tid)); next();
    };
  }
});
