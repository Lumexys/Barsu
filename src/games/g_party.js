/* ===== Словесные и компанейские ===== */
function namesSetup(el, { min, max, def, title, note }, done) {
  let n = def; const box = h('div', { class: 'card', style: { width: 'min(100%,420px)' } });
  const draw = () => {
    box.innerHTML = ''; box.append(h('b', { style: { fontSize: '17px' } }, title), h('p', { class: 'hint' }, note));
    box.append(h('div', { class: 'row', style: { alignItems: 'center', margin: '10px 0' } }, h('button', { class: 'nb', onclick: () => { n = Math.max(min, n - 1); draw(); } }, '−'), h('b', { style: { textAlign: 'center', fontSize: '22px' } }, n + ' игроков'), h('button', { class: 'nb', onclick: () => { n = Math.min(max, n + 1); draw(); } }, '+')));
    const ins = [...Array(n)].map((_, i) => h('input', { id: 'pl' + i, placeholder: 'Игрок ' + (i + 1), maxlength: 16, style: { marginTop: '6px' } }));
    box.append(...ins, h('button', { class: 'go', onclick: () => done(ins.map((x, i) => x.value.trim() || 'Игрок ' + (i + 1))) }, 'Начать'));
  };
  draw(); el.append(box);
}

game({
  id: 'mafia', name: 'Мафия', like: 'ведущий в телефоне', cat: 'party', icon: '🕵️', c1: '#6c757d', c2: '#000', players: '6–12 игроков', modes: ['live'],
  rules: ['Телефон — у ведущего, остальные сидят рядом.', 'Сначала телефон передают по кругу: каждый тайно смотрит свою роль.', 'Ночью мафия выбирает жертву, доктор лечит, комиссар проверяет. Ведущий отмечает выбор в приложении.', 'Днём все обсуждают и голосуют, кого исключить.', 'Мирные побеждают, если мафии не осталось. Мафия — если её не меньше, чем мирных.', 'В онлайн-версии нужен чат с модерацией, поэтому основной режим — живая игра.'],
  run(el, ctx) {
    ctx.score('');
    namesSetup(el, { min: 6, max: 12, def: 7, title: 'Кто играет?', note: 'Ведущий не играет — он держит телефон.' }, names => {
      const n = names.length, mc = n >= 11 ? 4 : n >= 8 ? 3 : 2;
      const roles = shuffle([...Array(mc).fill('Мафия'), 'Комиссар', 'Доктор', ...Array(n - mc - 2).fill('Мирный')]);
      const P = names.map((nm, i) => ({ nm, r: roles[i], alive: true }));
      const RI = { 'Мафия': '🔫', 'Комиссар': '🕵️', 'Доктор': '💊', 'Мирный': '🙂' };
      let day = 0;
      const screen = (...k) => { el.innerHTML = ''; el.append(h('div', { class: 'card', style: { width: 'min(100%,420px)', textAlign: 'center' } }, ...k)); };
      const deal = i => {
        if (i >= n) return night();
        screen(h('div', { style: { fontSize: '40px' } }, '🤫'), h('b', { style: { fontSize: '18px' } }, 'Передайте телефон: ' + P[i].nm), h('button', { class: 'go', onclick: () => screen(h('div', { style: { fontSize: '60px' } }, RI[P[i].r]), h('b', { style: { fontSize: '24px' } }, P[i].r), h('p', { class: 'hint' }, P[i].r === 'Мафия' ? 'Ваши сообщники: ' + P.filter((p, j) => p.r === 'Мафия' && j !== i).map(p => p.nm).join(', ') : P[i].r === 'Комиссар' ? 'Каждую ночь проверяете одного игрока' : P[i].r === 'Доктор' ? 'Каждую ночь спасаете одного игрока' : 'Найдите мафию днём'), h('button', { class: 'go', onclick: () => deal(i + 1) }, 'Запомнил, скрыть')) }, 'Показать мою роль'));
      };
      const pickOne = (title, hint, list, cb) => { screen(h('b', { style: { fontSize: '18px' } }, title), h('p', { class: 'hint' }, hint), h('div', { style: { display: 'grid', gap: '6px', marginTop: '8px' } }, ...list.map(p => h('button', { class: 'nb', onclick: () => cb(p) }, p.nm))), cb.skip ? h('button', { class: 'go sec', onclick: () => cb(null) }, 'Пропустить') : ''); };
      const alive = () => P.filter(p => p.alive);
      const winCheck = () => { const m = alive().filter(p => p.r === 'Мафия').length, c = alive().length - m; if (!m) return 'Мирные жители победили! 🎉'; if (m >= c) return 'Победила мафия 🔫'; return null; };
      const finish = t => { screen(h('div', { style: { fontSize: '50px' } }, '🏁'), h('b', { style: { fontSize: '20px' } }, t), h('p', { class: 'hint', style: { textAlign: 'left' } }, P.map(p => `${RI[p.r]} ${p.nm} — ${p.r}${p.alive ? '' : ' (выбыл)'}`).join('\n')), h('button', { class: 'go', onclick: () => ctx.match('draw', t) }, 'Завершить')); el.querySelector('.hint').style.whiteSpace = 'pre-line'; };
      const night = () => {
        day++; let victim, saved;
        screen(h('div', { style: { fontSize: '50px' } }, '🌙'), h('b', { style: { fontSize: '20px' } }, 'Ночь ' + day), h('p', { class: 'hint' }, 'Ведущий читает вслух: «Город засыпает. Мафия просыпается и молча выбирает жертву».'), h('button', { class: 'go', onclick: () => {
          pickOne('Кого выбрала мафия?', 'Покажите пальцем, ведущий нажимает', alive(), v => { victim = v;
            const doc = alive().find(p => p.r === 'Доктор'), com = alive().find(p => p.r === 'Комиссар');
            const afterDoc = () => { if (com) { pickOne('Комиссар просыпается', 'Кого проверяет комиссар?', alive().filter(p => p !== com), c => { screen(h('b', { style: { fontSize: '20px' } }, c.nm + (c.r === 'Мафия' ? ' — мафия 👎' : ' — не мафия 👍')), h('p', { class: 'hint' }, 'Покажите комиссару жестом. Он засыпает.'), h('button', { class: 'go', onclick: morning } , 'Утро')); }); } else morning(); };
            if (doc) pickOne('Доктор просыпается', 'Кого лечит доктор?', alive(), d => { saved = d; afterDoc(); }); else afterDoc();
          });
        } }, 'Начать ночь'));
        const morning = () => {
          let t; if (victim && victim !== saved) { victim.alive = false; t = 'Этой ночью выбыл ' + victim.nm; } else t = 'Этой ночью никто не погиб — доктор успел';
          const w = winCheck(); if (w) return finish(t + '. ' + w);
          let left = 90, tid;
          const tm = h('div', { style: { fontSize: '44px', fontWeight: 800, fontFamily: 'var(--f-num)' } }, '1:30');
          screen(h('div', { style: { fontSize: '50px' } }, '☀️'), h('b', { style: { fontSize: '19px' } }, t), h('p', { class: 'hint' }, 'Обсуждение. В живых: ' + alive().map(p => p.nm).join(', ')), tm, h('button', { class: 'go', onclick: () => { clearInterval(tid); vote(); } }, 'К голосованию'));
          tid = ctx.every(() => { left--; tm.textContent = Math.floor(Math.max(0, left) / 60) + ':' + String(Math.max(0, left) % 60).padStart(2, '0'); if (left <= 0) { clearInterval(tid); tm.style.color = 'var(--rd)'; } }, 1000);
        };
      };
      const vote = () => { const f = p => { if (p) p.alive = false; const w = winCheck(); if (w) return finish((p ? p.nm + ' исключён. ' : '') + w); screen(h('b', { style: { fontSize: '19px' } }, p ? p.nm + ' покидает игру' : 'Город никого не исключил'), h('button', { class: 'go', onclick: night }, 'Наступает ночь')); }; f.skip = true; pickOne('Голосование', 'Кого исключает город? (по большинству голосов)', alive(), f); };
      deal(0);
    });
  }
});

const CROC = ['Зачётка', 'Стипендия', 'Студенческий билет', 'Шпаргалка', 'Общежитие', 'Библиотека', 'Будильник', 'Столовая', 'Костёр', 'Палатка', 'Компас', 'Самокат', 'Пылесос', 'Жираф', 'Кенгуру', 'Пингвин', 'Повар', 'Пожарный', 'Балерина', 'Космонавт', 'Зубная щётка', 'Холодильник', 'Микроволновка', 'Зонтик', 'Снеговик', 'Гитара', 'Барабан', 'Скрипка', 'Удочка', 'Сноуборд', 'Лифт', 'Светофор', 'Автобус', 'Драники', 'Аист', 'Зубр', 'Шахматы', 'Шашлык', 'Ёлка', 'Подарок', 'Фейерверк', 'Утюг', 'Стиральная машина', 'Кот в сапогах', 'Колобок', 'Русалка', 'Робот', 'Динозавр', 'Привидение', 'Фокусник', 'Ракета', 'Маяк', 'Радуга', 'Кактус', 'Улитка', 'Осьминог', 'Вертолёт', 'Корона', 'Очки', 'Наушники', 'Микрофон', 'Пицца', 'Мороженое', 'Арбуз', 'Ананас', 'Велосипед', 'Парашют', 'Замок', 'Мост', 'Глобус', 'Микроскоп', 'Телескоп', 'Лампочка', 'Ножницы', 'Батарейка', 'Песочные часы', 'Якорь', 'Паук', 'Бабочка', 'Сова', 'Ёжик', 'Черепаха', 'Дракон', 'Единорог', 'Вулкан', 'Пирамида', 'Эйфелева башня', 'Снежинка', 'Молния', 'Луна', 'Солнце', 'Облако', 'Дождь', 'Рюкзак', 'Карандаш', 'Доска', 'Звонок', 'Диплом', 'Кофе'];
game({
  id: 'crocodile', name: 'Крокодил', like: 'один рисует, все угадывают', cat: 'party', icon: '🐊', c1: '#80b918', c2: '#2b9348', players: '3–8 игроков', modes: ['hot'],
  rules: ['Игроки по очереди рисуют. Художник выбирает одно из трёх слов и рисует его пальцем.', 'Буквы и цифры писать нельзя! Остальные смотрят на экран и угадывают вслух.', 'Кто угадал первым — нажмите его имя: ему 2 очка, художнику 1. На рисунок 80 секунд.', 'Слово можно подсмотреть, удерживая кнопку «👁 Слово».', 'Каждый рисует по два раза (если игроков больше пяти — по одному). Побеждает тот, у кого больше очков.', 'В онлайн-версии все видят рисунок на своих телефонах в реальном времени и пишут догадки в чат — приложение само проверяет ответ.'],
  run(el, ctx) {
    ctx.score('');
    namesSetup(el, { min: 3, max: 8, def: 4, title: 'Кто играет?', note: 'Рисуют по очереди на этом телефоне, остальные смотрят на экран.' }, names => {
      const sc = names.map(() => 0), turns = names.length > 5 ? 1 : 2, order = [...Array(turns)].flatMap(() => names.map((_, i) => i));
      const words = shuffle(CROC.slice()); let wi = 0, ti = 0;
      const scr = (...k) => { el.innerHTML = ''; el.append(h('div', { class: 'card', style: { width: 'min(100%,420px)', textAlign: 'center' } }, ...k)); };
      const table = () => h('p', { class: 'hint' }, names.map((n, i) => n + ': ' + sc[i]).sort((a, b) => +b.split(': ')[1] - +a.split(': ')[1]).join(' · '));
      const next = () => {
        if (ti >= order.length) { const best = Math.max(...sc); scr(h('div', { style: { fontSize: '48px' } }, '🏆'), h('b', { style: { fontSize: '20px' } }, names.filter((_, i) => sc[i] === best).join(', ') + ' — лучший художник и отгадчик'), table(), h('button', { class: 'go', onclick: () => ctx.match('draw', 'Игра окончена') }, 'Завершить')); return; }
        const d = order[ti];
        scr(h('small', { class: 'hint' }, 'Ход ' + (ti + 1) + ' из ' + order.length), h('div', { style: { fontSize: '44px' } }, '🎨'), h('b', { style: { fontSize: '19px', display: 'block' } }, 'Рисует: ' + names[d]), h('p', { class: 'hint' }, 'Остальные, не подглядывайте, пока ' + names[d] + ' выбирает слово'), table(),
          h('button', { class: 'go', onclick: () => { const opts = [words[wi++ % words.length], words[wi++ % words.length], words[wi++ % words.length]]; scr(h('b', { style: { fontSize: '18px' } }, names[d] + ', выберите слово'), h('div', { style: { display: 'grid', gap: '8px', marginTop: '12px' } }, ...opts.map(w => h('button', { class: 'nb', style: { padding: '14px', fontSize: '17px' }, onclick: () => draw(d, w) }, w)))); } }, 'Я ' + names[d] + ', выбрать слово'));
      };
      const draw = (d, word) => {
        el.innerHTML = '';
        const S = 340, [c, x] = canvas(el, S, S); c.style.background = '#fff'; c.style.maxHeight = 'calc(100dvh - 330px)';
        const COL = ['#111111', '#e63946', '#f4a100', '#2a9d5c', '#1f6fd1', '#7b2cbf', '#8d5524', '#ff8fab'];
        let col = COL[0], size = 6, erase = false, strokes = [], cur = null, left = 80, done = false;
        const redraw = () => { x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); strokes.forEach(s => { x.strokeStyle = s.c; x.lineWidth = s.w; x.lineCap = x.lineJoin = 'round'; x.beginPath(); s.p.forEach((q, i) => i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y)); if (s.p.length === 1) x.lineTo(s.p[0].x + .1, s.p[0].y); x.stroke(); }); };
        redraw();
        ctx.on(c, 'pointerdown', e => { if (done) return; c.setPointerCapture(e.pointerId); cur = { c: erase ? '#fff' : col, w: erase ? size * 4 : size, p: [c.pos(e)] }; strokes.push(cur); redraw(); });
        ctx.on(c, 'pointermove', e => { if (!cur) return; const q = c.pos(e), l = cur.p[cur.p.length - 1]; if (Math.hypot(q.x - l.x, q.y - l.y) < 1.5) return; cur.p.push(q); x.strokeStyle = cur.c; x.lineWidth = cur.w; x.lineCap = 'round'; x.beginPath(); x.moveTo(l.x, l.y); x.lineTo(q.x, q.y); x.stroke(); });
        const up = () => { cur = null; }; ctx.on(c, 'pointerup', up); ctx.on(c, 'pointercancel', up);
        const tools = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', width: 'min(100%,400px)' } });
        const drawTools = () => {
          tools.innerHTML = '';
          COL.forEach(cc => tools.append(h('button', { 'aria-label': 'Цвет', onclick: () => { col = cc; erase = false; drawTools(); }, style: { width: '30px', height: '30px', borderRadius: '50%', background: cc, boxShadow: !erase && col === cc ? '0 0 0 3px var(--bg),0 0 0 5px var(--ac)' : 'inset 0 0 0 2px rgba(0,0,0,.1)' } })));
          [[3, '·'], [6, '•'], [12, '●']].forEach(([s, t]) => tools.append(h('button', { class: 'nb', style: { padding: '4px 10px', background: size === s ? 'var(--ac)' : '', color: size === s ? '#fff' : '' }, onclick: () => { size = s; drawTools(); } }, t)));
          tools.append(h('button', { class: 'nb', style: { padding: '4px 10px', background: erase ? 'var(--ac)' : '', color: erase ? '#fff' : '' }, onclick: () => { erase = !erase; drawTools(); } }, '🧽'), h('button', { class: 'nb', style: { padding: '4px 10px' }, onclick: () => { strokes.pop(); redraw(); } }, '↶'), h('button', { class: 'nb red', style: { padding: '4px 10px' }, onclick: () => { strokes = []; redraw(); } }, '🗑'));
        };
        drawTools();
        const peek = h('button', { class: 'nb', style: { touchAction: 'none', flex: 'none' } }, '👁 Слово');
        const show = on => { peek.textContent = on ? word : '👁 Слово'; }; peek.addEventListener('pointerdown', e => { e.preventDefault(); show(true); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => peek.addEventListener(ev, () => show(false)));
        const tm = h('b', { style: { fontFamily: 'var(--f-num)', fontSize: '20px', minWidth: '44px', textAlign: 'center' } }, '80');
        const hint = h('span', { class: 'hint', style: { margin: 0, letterSpacing: '3px', fontWeight: 700 } }, [...word].map(ch => ch === ' ' ? '  ' : '_').join(''));
        el.prepend(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', width: 'min(100%,400px)', justifyContent: 'space-between' } }, h('span', { style: { fontWeight: 700, fontSize: '14px' } }, '🎨 ' + names[d]), hint, tm, peek));
        const who = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', width: 'min(100%,400px)' } }, h('span', { class: 'hint', style: { width: '100%', textAlign: 'center', margin: 0 } }, 'Кто угадал первым?'));
        names.forEach((n, i) => { if (i !== d) who.append(h('button', { class: 'nb', style: { flex: 'none', background: 'var(--ok)', color: '#fff' }, onclick: () => end(i) }, n)); });
        who.append(h('button', { class: 'nb red', style: { flex: 'none' }, onclick: () => end(-1) }, 'Никто'));
        el.append(tools, who);
        const tid = ctx.every(() => { left--; tm.textContent = Math.max(0, left); tm.style.color = left <= 10 ? 'var(--rd)' : ''; if (left === 40) hint.textContent = [...word].map((ch, k) => k === 0 || ch === ' ' ? ch : '_').join(''); if (left <= 0) end(-1); }, 1000);
        const end = g => {
          if (done) return; done = true; clearInterval(tid);
          if (g >= 0) { sc[g] += 2; sc[d] += 1; }
          const img = h('img', { src: c.toDataURL('image/png'), alt: 'Рисунок', style: { width: '160px', borderRadius: '12px', boxShadow: 'var(--sh)', background: '#fff' } });
          scr(img, h('div', { style: { fontSize: '26px', fontWeight: 800, margin: '10px 0 4px' } }, word), h('p', { class: 'hint' }, g >= 0 ? names[g] + ' угадал(а): +2, ' + names[d] + ' +1' : 'Никто не угадал'), table(), h('button', { class: 'go', onclick: () => { ti++; next(); } }, 'Дальше'));
        };
      };
      next();
    });
  }
});
game({
  id: 'balda', name: 'Балда', like: 'слова на поле 5×5', cat: 'party', icon: '🔤', c1: '#9d4edd', c2: '#3c096c', modes: ['hot'],
  rules: ['В центре поля стоит слово. Игроки по очереди добавляют одну букву в клетку рядом с занятыми.', 'Затем составляют слово, проводя по соседним клеткам (вверх, вниз, влево, вправо). Новая буква обязательно входит в слово.', 'Очки — длина слова. Одно слово нельзя использовать дважды.', 'Словаря в прототипе нет: соперник нажимает «Принять» или «Не слово».', 'Игра заканчивается, когда поле заполнено.'],
  run(el, ctx) {
    const N = 5, g = Array(25).fill(''), start = pick(W5); [...start].forEach((ch, i) => g[10 + i] = ch);
    const used = new Set([start]), sc = [0, 0], names = ['Игрок 1', 'Игрок 2']; let turn = 0, step = 'cell', nc = -1, path = [], passes = 0;
    const say = turnInfo(ctx, el);
    const bd = h('div', { class: 'bd', style: { gridTemplateColumns: 'repeat(5,1fr)', gap: '5px', width: 'min(100%,340px)' } });
    const kw = h('div', { style: { width: '100%', display: 'flex', justifyContent: 'center' } }), ctl = h('div', { class: 'bar2' });
    el.append(bd, ctl, kw);
    const adj = (a, b) => Math.abs((a / N | 0) - (b / N | 0)) + Math.abs(a % N - b % N) === 1;
    const draw = () => {
      bd.innerHTML = ''; g.forEach((ch, i) => { const can = step === 'cell' && !ch && g.some((c, j) => c && adj(i, j)); bd.append(h('button', { onclick: () => tap(i), style: { background: path.includes(i) ? 'var(--ac)' : i === nc ? 'var(--wb)' : ch ? 'var(--card)' : can ? 'var(--ac2)' : 'var(--bg)', color: path.includes(i) ? '#fff' : 'var(--tx)', boxShadow: ch ? 'var(--sh)' : 'inset 0 0 0 1px var(--br)', borderRadius: '10px', fontSize: '26px', textTransform: 'uppercase', fontFamily: 'var(--f-num)' } }, ch)); });
      ctx.score(sc.join(':')); ctl.innerHTML = ''; kw.innerHTML = '';
      const word = path.map(i => g[i]).join('');
      if (step === 'cell') { say(`<b>${names[turn]}</b>: выберите пустую клетку рядом с буквами`); ctl.append(h('button', { class: 'nb red', onclick: () => { passes++; if (passes >= 2) return end(); turn = 1 - turn; draw(); } }, 'Пропустить ход')); }
      if (step === 'letter') { say(`<b>${names[turn]}</b>: какую букву поставить?`); kbRU(kw, k => { if (k.length === 1) { g[nc] = k; step = 'word'; path = []; draw(); } if (k === 'BS') { nc = -1; step = 'cell'; draw(); } }, '—'); }
      if (step === 'word') { say(`<b>${names[turn]}</b>: проведите слово по клеткам · <b>${word.toUpperCase() || '…'}</b>`); ctl.append(h('button', { class: 'nb', onclick: () => { path = []; draw(); } }, 'Сначала'), h('button', { class: 'nb red', onclick: () => { g[nc] = ''; nc = -1; step = 'cell'; path = []; draw(); } }, 'Отменить букву'), h('button', { class: 'nb', style: { background: 'var(--ac)', color: '#fff' }, onclick: submit }, 'Готово')); }
      if (step === 'judge') { say(`${names[1 - turn]}, это слово? <b>${word.toUpperCase()}</b>`); ctl.append(h('button', { class: 'nb red', onclick: () => { ctx.toast('Слово не принято'); g[nc] = ''; nc = -1; step = 'cell'; path = []; draw(); } }, 'Не слово'), h('button', { class: 'nb', style: { background: 'var(--ok)', color: '#fff' }, onclick: () => { used.add(word); sc[turn] += word.length; passes = 0; nc = -1; path = []; step = 'cell'; turn = 1 - turn; if (g.every(Boolean)) return end(); draw(); } }, 'Принять')); }
    };
    const end = () => { draw(); ctx.match('draw', sc[0] === sc[1] ? 'Ничья ' + sc.join(':') : names[sc[0] > sc[1] ? 0 : 1] + ' победил ' + sc.join(':')); };
    const submit = () => { const w = path.map(i => g[i]).join(''); if (w.length < 2) return ctx.toast('Слово слишком короткое'); if (!path.includes(nc)) return ctx.toast('Новая буква должна входить в слово'); if (used.has(w)) return ctx.toast('Такое слово уже было'); step = 'judge'; draw(); };
    const tap = i => {
      if (step === 'cell') { if (!g[i] && g.some((c, j) => c && adj(i, j))) { nc = i; step = 'letter'; draw(); } return; }
      if (step === 'word') { if (!g[i]) return; if (path.includes(i)) { if (path[path.length - 1] === i) path.pop(); draw(); return; } if (path.length && !adj(path[path.length - 1], i)) return ctx.toast('Клетки должны быть соседними'); path.push(i); draw(); }
    };
    draw();
  }
});

game({
  id: 'hangman', name: 'Виселица', like: 'угадай слово по буквам', cat: 'party', icon: '🪢', c1: '#ffd6a5', c2: '#e76f51',
  rules: ['Угадайте слово, называя буквы.', 'Каждая ошибка дорисовывает человечка. 7 ошибок — проигрыш.', 'С ботом слово загадывает приложение. На одном телефоне — первый игрок вводит слово, второй угадывает.'],
  run(el, ctx) {
    const bank = CW_WORDS.map(([w, c]) => [w.replace('ё', 'е'), c]);
    const play = (word, hint) => {
      el.innerHTML = ''; const got = new Set(), bad = new Set(); let over = false;
      const [c, x] = canvas(el, 220, 170); c.style.boxShadow = 'none'; c.style.background = 'var(--card)';
      const wd = h('div', { style: { fontSize: '30px', letterSpacing: '6px', fontWeight: 800, fontFamily: 'var(--f-num)', textTransform: 'uppercase', textAlign: 'center', overflowWrap: 'anywhere' } });
      const inf = info(el); el.append(wd); const kw = h('div', { style: { width: '100%', display: 'flex', justifyContent: 'center' } }); el.append(kw);
      const keys = kbRU(kw, k => guess(k), '—');
      const paint = () => {
        x.clearRect(0, 0, 220, 170); x.strokeStyle = cssv('--tx'); x.lineWidth = 4; x.lineCap = 'round';
        const n = bad.size, L = (a, b, c2, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); };
        L(20, 160, 120, 160); L(50, 160, 50, 15); L(50, 15, 140, 15); L(140, 15, 140, 35);
        if (n > 0) { x.beginPath(); x.arc(140, 50, 15, 0, 7); x.stroke(); } if (n > 1) L(140, 65, 140, 110); if (n > 2) L(140, 75, 118, 95); if (n > 3) L(140, 75, 162, 95); if (n > 4) L(140, 110, 122, 140); if (n > 5) L(140, 110, 158, 140); if (n > 6) { x.strokeStyle = cssv('--rd'); L(132, 45, 138, 51); L(138, 45, 132, 51); L(142, 45, 148, 51); L(148, 45, 142, 51); }
        wd.textContent = [...word].map(ch => got.has(ch) || over ? ch : '_').join('');
        inf.innerHTML = (hint ? 'Подсказка: <b>' + esc(hint) + '</b> · ' : '') + 'ошибок ' + n + ' из 7';
      };
      const guess = k => {
        if (over || k.length !== 1 || got.has(k) || bad.has(k)) return;
        if (word.includes(k)) { got.add(k); keys[k].className = 'g'; } else { bad.add(k); keys[k].className = 'x'; }
        if ([...word].every(ch => got.has(ch))) { over = true; paint(); ctx.match(ctx.mode === 'hot' ? 'draw' : 'win', ctx.mode === 'hot' ? 'Слово угадано!' : 'Угадали: ' + word.toUpperCase()); return; }
        if (bad.size >= 7) { over = true; paint(); ctx.match(ctx.mode === 'hot' ? 'draw' : 'loss', 'Было слово: ' + word.toUpperCase()); return; }
        paint();
      };
      physKeys(ctx, guess); paint();
    };
    if (ctx.mode === 'hot') {
      const inp = h('input', { id: 'hw', type: 'password', placeholder: 'Слово (только буквы)', autocomplete: 'off' }), hi = h('input', { id: 'hh', placeholder: 'Подсказка (можно пусто)', style: { marginTop: '8px' } });
      el.append(h('div', { class: 'card', style: { width: 'min(100%,380px)' } }, h('b', null, 'Игрок 1 загадывает слово'), h('p', { class: 'hint' }, 'Второй игрок пусть отвернётся.'), inp, hi, h('button', { class: 'go', onclick: () => { const w = inp.value.trim().toLowerCase().replace(/ё/g, 'е'); if (!/^[а-я]{3,15}$/.test(w)) return ctx.toast('Нужно слово из 3–15 русских букв'); play(w, hi.value.trim()); } }, 'Загадать')));
    } else { const [w, c] = pick(bank); play(w, c); }
  }
});

game({
  id: 'whosaid', name: 'Угадай, кто сказал', like: 'для компании', cat: 'party', icon: '💬', c1: '#ff99c8', c2: '#a06cd5', players: '3–8 игроков', modes: ['live'],
  rules: ['Каждый по очереди тайно пишет две фразы: любимую цитату, факт о себе, смешной случай.', 'Потом фразы показываются по одной в случайном порядке, все пытаются угадать автора.', 'Ведущий отмечает, кто угадал, — каждому по очку. Автору очко, если его не угадал никто.', 'В приложении на любую фразу можно будет пожаловаться — она сразу скроется.'],
  run(el, ctx) {
    ctx.score('');
    namesSetup(el, { min: 3, max: 8, def: 4, title: 'Кто играет?', note: 'Телефон будут передавать по кругу.' }, names => {
      const Q = [], sc = names.map(() => 0);
      const scr = (...k) => { el.innerHTML = ''; el.append(h('div', { class: 'card', style: { width: 'min(100%,420px)', textAlign: 'center' } }, ...k)); };
      const write = i => {
        if (i >= names.length) return show(shuffle(Q), 0);
        scr(h('b', { style: { fontSize: '18px' } }, 'Передайте телефон: ' + names[i]), h('button', { class: 'go', onclick: () => {
          const a = h('textarea', { id: 'w1', placeholder: 'Фраза 1', maxlength: 140, style: { marginTop: '8px' } }), b = h('textarea', { id: 'w2', placeholder: 'Фраза 2', maxlength: 140, style: { marginTop: '8px' } });
          scr(h('b', null, names[i] + ', напишите две фразы'), h('p', { class: 'hint' }, 'Никто не должен видеть'), a, b, h('button', { class: 'go', onclick: () => { [a, b].forEach(t => t.value.trim() && Q.push({ t: t.value.trim(), a: i })); write(i + 1); } }, 'Готово, передать дальше'));
        } }, 'Это я'));
      };
      const show = (qs, k) => {
        if (k >= qs.length) { const best = Math.max(...sc); scr(h('div', { style: { fontSize: '48px' } }, '🏆'), h('b', { style: { fontSize: '19px' } }, names.filter((_, i) => sc[i] === best).join(', ') + ' — лучше всех знает друзей'), h('p', { class: 'hint' }, names.map((n, i) => n + ': ' + sc[i]).join(' · ')), h('button', { class: 'go', onclick: () => ctx.match('draw', 'Игра окончена') }, 'Завершить')); return; }
        const q = qs[k], right = new Set();
        const chips = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '10px' } });
        const dc = () => { chips.innerHTML = ''; names.forEach((n, i) => { if (i === q.a) return; chips.append(h('button', { class: 'nb', style: { flex: 'none', background: right.has(i) ? 'var(--ok)' : '', color: right.has(i) ? '#fff' : '' }, onclick: () => { right.has(i) ? right.delete(i) : right.add(i); dc(); } }, n)); }); };
        scr(h('small', { class: 'hint' }, 'Фраза ' + (k + 1) + ' из ' + qs.length), h('div', { style: { fontSize: '22px', fontWeight: 700, margin: '14px 0', overflowWrap: 'anywhere' } }, '«' + q.t + '»'), h('p', { class: 'hint' }, 'Каждый называет автора вслух. Отметьте, кто угадал:'), chips,
          h('button', { class: 'go', onclick: () => { right.forEach(i => sc[i]++); if (!right.size) sc[q.a]++; scr(h('b', { style: { fontSize: '20px' } }, 'Это написал(а) ' + names[q.a]), h('p', { class: 'hint' }, right.size ? 'Угадали: ' + [...right].map(i => names[i]).join(', ') : 'Никто не угадал — очко автору'), h('button', { class: 'go', onclick: () => show(qs, k + 1) }, 'Дальше')); } }, 'Показать автора'));
        dc();
      };
      write(0);
    });
  }
});
