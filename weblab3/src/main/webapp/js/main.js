const canvas = document.getElementById('graph');
const ctx = canvas ? canvas.getContext('2d') : null;

var historyOfTochki = [];
var myishX = null;
var myishY = null;

var danceInterval = null;
var danceR = 0;
var origTableStat = [];
var hideInvalidDotes = true;

const codeword = 'абобус';
const SCALE = 30; // 1 единица = 30 пикселей (при ширине 300px диапазон от -4 до 4 составляет [-120px, +120px])

// веб-аудио контекст для процедурного синтеза звуков фнафа и гта без внешних файлов
var easterAudioCtx = null;
function getAudioContext() {
    try {
        if (!easterAudioCtx) {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                easterAudioCtx = new AudioCtx();
            }
        }
        if (easterAudioCtx && easterAudioCtx.state === 'suspended') {
            easterAudioCtx.resume();
        }
        return easterAudioCtx;
    } catch(e) {
        return null;
    }
}

// синтезируем колокольный перезвон и детский восторженный крик как в fnaf 1 (6:00 am)
function playFnafSound() {
    var aCtx = getAudioContext();
    if (!aCtx) return;
    var now = aCtx.currentTime;

    // перезвон курантов (ноты e4, g#4, f#4, b3)
    var melody = [
        { f: 329.63, t: 0.0, d: 0.45 },
        { f: 415.30, t: 0.22, d: 0.45 },
        { f: 369.99, t: 0.44, d: 0.45 },
        { f: 246.94, t: 0.66, d: 0.65 }
    ];

    melody.forEach(function(note) {
        var osc = aCtx.createOscillator();
        var gain = aCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.f, now + note.t);
        gain.gain.setValueAtTime(0.25, now + note.t);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.t + note.d);
        osc.connect(gain);
        gain.connect(aCtx.destination);
        osc.start(now + note.t);
        osc.stop(now + note.t + note.d);
    });

    // тяжелый колокольный звон 6 утра с металлическими обертонами
    var bellOsc1 = aCtx.createOscillator();
    var bellOsc2 = aCtx.createOscillator();
    var bellGain = aCtx.createGain();
    bellOsc1.type = 'sine';
    bellOsc2.type = 'sine';
    bellOsc1.frequency.setValueAtTime(164.81, now + 0.9);
    bellOsc2.frequency.setValueAtTime(164.81 * 2.76, now + 0.9);
    bellGain.gain.setValueAtTime(0.4, now + 0.9);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    bellOsc1.connect(bellGain);
    bellOsc2.connect(bellGain);
    bellGain.connect(aCtx.destination);
    bellOsc1.start(now + 0.9);
    bellOsc2.start(now + 0.9);
    bellOsc1.stop(now + 3.3);
    bellOsc2.stop(now + 3.3);

    // синтезируем крики детской радости через полосовой шум
    var bufSize = Math.floor(aCtx.sampleRate * 2.2);
    var buffer = aCtx.createBuffer(1, bufSize, aCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.7;
    }
    var noise = aCtx.createBufferSource();
    noise.buffer = buffer;
    var filter = aCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now + 1.0);
    filter.Q.setValueAtTime(2.5, now + 1.0);
    var cheerGain = aCtx.createGain();
    cheerGain.gain.setValueAtTime(0.001, now + 1.0);
    cheerGain.gain.linearRampToValueAtTime(0.28, now + 1.3);
    cheerGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    noise.connect(filter);
    filter.connect(cheerGain);
    cheerGain.connect(aCtx.destination);
    noise.start(now + 1.0);
    noise.stop(now + 3.2);
}

// звук механического щелчка барабана при прокрутке букв
function playSlotTick() {
    var aCtx = getAudioContext();
    if (!aCtx) return;
    var now = aCtx.currentTime;
    var osc = aCtx.createOscillator();
    var gain = aCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.035);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(aCtx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
}

// синтезируем звук wasted из gta: глубокий саб-удар и тревожный диссонанс
function playGtaSound() {
    var aCtx = getAudioContext();
    if (!aCtx) return;
    var now = aCtx.currentTime;

    // саб-басовый удар в грудь
    var subOsc = aCtx.createOscillator();
    var subGain = aCtx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(80, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 1.0);
    subGain.gain.setValueAtTime(0.7, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    subOsc.connect(subGain);
    subGain.connect(aCtx.destination);
    subOsc.start(now);
    subOsc.stop(now + 2.6);

    // диссонирующие пилы wasted (минорный тритон)
    var chord = [110.0, 155.56, 220.0, 311.13];
    chord.forEach(function(freq) {
        var osc = aCtx.createOscillator();
        var gain = aCtx.createGain();
        var lp = aCtx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 0.97, now + 2.4);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(750, now);
        lp.frequency.exponentialRampToValueAtTime(130, now + 2.4);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
        osc.connect(lp);
        lp.connect(gain);
        gain.connect(aCtx.destination);
        osc.start(now);
        osc.stop(now + 2.6);
    });
}

// запуск летающих конфетти на холсте fnaf оверлея
var confettiAnimId = null;
function runConfetti(canvasEl) {
    if (!canvasEl) return;
    var ctxC = canvasEl.getContext('2d');
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;

    var particles = [];
    var colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#e11d48'];
    for (var i = 0; i < 90; i++) {
        particles.push({
            x: Math.random() * canvasEl.width,
            y: Math.random() * -canvasEl.height,
            size: Math.random() * 8 + 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 4 + 3,
            rot: Math.random() * 360,
            vRot: (Math.random() - 0.5) * 8
        });
    }

    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);

    function frame() {
        ctxC.clearRect(0, 0, canvasEl.width, canvasEl.height);
        for (var j = 0; j < particles.length; j++) {
            var p = particles[j];
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vRot;
            ctxC.save();
            ctxC.translate(p.x, p.y);
            ctxC.rotate(p.rot * Math.PI / 180);
            ctxC.fillStyle = p.color;
            ctxC.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctxC.restore();

            if (p.y > canvasEl.height + 20) {
                p.y = -20;
                p.x = Math.random() * canvasEl.width;
            }
        }
        confettiAnimId = requestAnimationFrame(frame);
    }
    frame();
}

function stopConfetti() {
    if (confettiAnimId) {
        cancelAnimationFrame(confettiAnimId);
        confettiAnimId = null;
    }
}

// триггер пасхалки fnaf 1 (попадание): крутящиеся буквы, часы 6 am и конфетти
var fnafTimeout = null;
function triggerFnafEasterEgg() {
    if (fnafTimeout) clearTimeout(fnafTimeout);

    var overlay = document.getElementById('fnaf-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'fnaf-overlay';
        overlay.innerHTML = '<canvas id="fnaf-confetti"></canvas>' +
            '<div class="fnaf-clock">6:00 AM</div>' +
            '<div class="fnaf-rollers-box" id="fnaf-slots"></div>' +
            '<div class="fnaf-subtext">Смена окончена • Точка попала</div>' +
            '<div class="fnaf-skip-hint">кликни чтобы закрыть</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', closeFnafEasterEgg);
    }

    var slotsBox = document.getElementById('fnaf-slots');
    slotsBox.innerHTML = '';

    var word = 'ПОПАДАНИЕ'.split('');
    var reels = [];

    // генерим механические барабаны для каждой буквы слова попадание
    word.forEach(function(char) {
        var slot = document.createElement('div');
        slot.className = 'fnaf-slot';

        var reel = document.createElement('div');
        reel.className = 'fnaf-reel';

        var pool = ['0', '1', '2', '3', '4', '5', 'X', 'Y', 'R', '★', '◆', char];
        var targetCharEl = null;

        pool.forEach(function(c, i) {
            var el = document.createElement('div');
            el.className = 'fnaf-char';
            el.textContent = c;
            reel.appendChild(el);
            if (i === pool.length - 1) {
                targetCharEl = el;
            }
        });

        slot.appendChild(reel);
        slotsBox.appendChild(slot);
        reels.push({
            reel: reel,
            targetOffset: (pool.length - 1) * 74,
            targetCharEl: targetCharEl
        });
    });

    overlay.classList.add('active');

    // поочередно раскручиваем и защелкиваем барабаны с механическими щелчками
    var animDurationMs = 850;
    var stepDelayMs = 130;
    var baseStartMs = 100;

    reels.forEach(function(item, idx) {
        var startAt = baseStartMs + idx * stepDelayMs;

        // дергаем барабан к целевой букве
        setTimeout(function() {
            item.reel.style.transform = 'translateY(-' + item.targetOffset + 'px)';
            playSlotTick();
        }, startAt);

        // фиксируем букву в слоте с щелчком и сочной подсветкой
        setTimeout(function() {
            playSlotTick();
            if (item.targetCharEl) {
                item.targetCharEl.classList.add('fnaf-locked');
            }
        }, startAt + animDurationMs);
    });

    // когда все барабаны защелкнулись — врубаем куранты 6 утра и праздничные конфетти
    var totalFinishMs = baseStartMs + (reels.length - 1) * stepDelayMs + animDurationMs + 100;
    setTimeout(function() {
        if (!overlay.classList.contains('active')) return;
        playFnafSound();
        var confCanvas = document.getElementById('fnaf-confetti');
        runConfetti(confCanvas);
    }, totalFinishMs);

    // держим экран открытым, чтобы юзер кайфанул от победы, либо закрываем по клику/esc
    fnafTimeout = setTimeout(function() {
        closeFnafEasterEgg();
    }, totalFinishMs + 5000);
}

function closeFnafEasterEgg() {
    if (fnafTimeout) clearTimeout(fnafTimeout);
    var overlay = document.getElementById('fnaf-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    stopConfetti();
}

// триггер пасхалки gta wasted (промах): затемнение, тряска и саб-бас
var gtaTimeout = null;
function triggerGtaEasterEgg() {
    if (gtaTimeout) clearTimeout(gtaTimeout);

    var overlay = document.getElementById('gta-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'gta-overlay';
        overlay.innerHTML = '<div class="gta-banner" id="gta-banner">' +
            '<div class="gta-title">ПРОМАХ</div>' +
            '<div class="gta-subtitle">Точка не попала в заданную область</div>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', closeGtaEasterEgg);
    }

    var banner = document.getElementById('gta-banner');
    if (banner) {
        banner.classList.remove('gta-shake');
        void banner.offsetWidth;
        banner.classList.add('gta-shake');
    }

    overlay.classList.add('active');
    playGtaSound();

    gtaTimeout = setTimeout(function() {
        closeGtaEasterEgg();
    }, 3400);
}

function closeGtaEasterEgg() {
    if (gtaTimeout) clearTimeout(gtaTimeout);
    var overlay = document.getElementById('gta-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// закрытие пасхалок по кнопке esc
window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeFnafEasterEgg();
        closeGtaEasterEgg();
    }
});

// склеиваем json-строку и хэшируем через djb2 чтоб данные не подделали
function protectothack(dataObj) {
    if (!dataObj || typeof dataObj !== 'object') return '';
    var str = JSON.stringify({
        x: dataObj.x,
        y: dataObj.y,
        r: dataObj.r,
        hit: dataObj.hit,
        time: dataObj.time,
        execTime: dataObj.execTime
    }) + codeword;
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash.toString();
}

// приводим ввод к числу и меняем запятую на точку если юзер ошибся
function toStrAndDZ(val) {
    if (val === null || val === undefined) return NaN;
    var str = String(val).trim().replace(',', '.');
    return str === '' ? NaN : Number(str);
}

// спавним красный тост с ошибкой на три секунды
function pokazatOshibku(text) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;

    container.appendChild(toast);

    setTimeout(function() {
        if (toast.parentNode === container) {
            container.removeChild(toast);
        }
    }, 3000);
}

// чекаем радиус r: строго из селекта {1, 2, 3, 4, 5}
function isValidR(rVal) {
    var rNum = toStrAndDZ(rVal);
    var validR = [1, 2, 3, 4, 5];
    return !isNaN(rNum) && validR.indexOf(rNum) !== -1;
}

// чекаем y: строго открытый интервал (-5 ... 3), крайние значения отсекаем
function isValidY(yVal) {
    var yNum = toStrAndDZ(yVal);
    return !isNaN(yNum) && yNum > -5 && yNum < 3;
}

// чекаем x: строго один чекбокс из {-4, -3, -2, -1, 0, 1, 2, 3, 4}
function isValidX(xVal) {
    var xNum = toStrAndDZ(xVal);
    var validX = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    return !isNaN(xNum) && validX.indexOf(xNum) !== -1;
}

// конвертим математические координаты (x, y) в пиксели холста
function xyToPx(x, y) {
    var px = 150 + x * SCALE;
    var py = 150 - y * SCALE;
    return { x: px, y: py };
}

// конвертим пиксели холста обратно в нормальные координаты (x, y)
function pxToXY(px, py) {
    var rawX = (px - 150) / SCALE;
    var rawY = (150 - py) / SCALE;
    return {
        x: Math.round(rawX * 1000) / 1000,
        y: Math.round(rawY * 1000) / 1000
    };
}

// пасхалочка: заставляем таблицы на странице флексить и летать по синусоиде
function startDance() {
    if (danceInterval !== null) return;

    var DI = document.getElementsByTagName("table");
    var DIL = DI.length;

    origTableStat = [];
    for (var k = 0; k < DIL; k++) {
        origTableStat.push({
            position: DI[k].style.position,
            left: DI[k].style.left,
            top: DI[k].style.top
        });
    }

    danceR = 0;
    var x1 = 0.1, y1 = 0.05, x2 = 0.25, y2 = 0.24, x3 = 1.6, y3 = 0.24, x4 = 300, y4 = 200, x5 = 300, y5 = 200;

    danceInterval = setInterval(function() {
        for (var i = 0; i < DIL; i++) {
            var DIS = DI[i].style;
            DIS.position = 'absolute';
            DIS.left = (Math.sin(danceR * x1 + i * x2 + x3) * x4 + x5) + "px";
            DIS.top = (Math.cos(danceR * y1 + i * y2 + y3) * y4 + y5) + "px";
        }
        danceR++;
    }, 20);
}

// глушим флекс таблиц и возвращаем все стили на место
function stopDance() {
    if (danceInterval !== null) {
        clearInterval(danceInterval);
        danceInterval = null;

        var DI = document.getElementsByTagName("table");
        for (var i = 0; i < DI.length; i++) {
            if (origTableStat[i]) {
                DI[i].style.position = origTableStat[i].position;
                DI[i].style.left = origTableStat[i].left;
                DI[i].style.top = origTableStat[i].top;
            }
        }
    }
}

// быстрая проверка попадания на фронте для раскраски точек и отрисовки
function proverkaPopadaniya(x, y, r) {
    // 1 четверть: прямоугольник шириной r и высотой r/2
    if (x >= 0 && y >= 0) {
        return (x <= r) && (y <= (r / 2));
    }
    // 2 четверть: треугольник от (-r/2, 0) до (0, r)
    if (x <= 0 && y >= 0) {
        return (x >= -r / 2) && (y <= (2 * x + r));
    }
    // 4 четверть: сектор круга радиуса r
    if (x >= 0 && y <= 0) {
        return (x * x + y * y) <= (r * r);
    }
    // 3 четверть: тут точек нет, всегда мимо
    return false;
}

// отрисовываем всю фигуру варианта 3 лабы на холсте
function narisovatGrafik(rVal) {
    if (!ctx) return;
    ctx.clearRect(0, 0, 300, 300);

    var hasValidR = isValidR(rVal);
    var rNum = hasValidR ? toStrAndDZ(rVal) : 2;

    if (hasValidR) {
        // неоновый градиент вайс-сити для закраски фигуры
        var grad = ctx.createLinearGradient(0, 0, 300, 300);
        grad.addColorStop(0, 'rgba(255, 42, 133, 0.7)');
        grad.addColorStop(0.5, 'rgba(168, 17, 199, 0.65)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.7)');
        ctx.fillStyle = grad;

        var rPx = rNum * SCALE;
        var halfRPx = (rNum / 2) * SCALE;

        // 1 четверть: прямоугольник [0, r] на [0, r/2]
        ctx.fillRect(150, 150 - halfRPx, rPx, halfRPx);

        // 2 четверть: треугольник от (-r/2, 0) до (0, r)
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.lineTo(150 - halfRPx, 150);
        ctx.lineTo(150, 150 - rPx);
        ctx.closePath();
        ctx.fill();

        // 4 четверть: сектор круга радиуса r
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, rPx, 0, Math.PI / 2, false);
        ctx.closePath();
        ctx.fill();
    }

    // рисуем пунктирную границу допустимой зоны клика: x [-4..4], y (-5..3)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(30, 60, 240, 240);
    ctx.setLineDash([]);

    // чертим оси x и y неоновым цветом
    ctx.beginPath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;

    ctx.moveTo(0, 150); ctx.lineTo(300, 150);
    ctx.moveTo(150, 0); ctx.lineTo(150, 300);

    // стрелочки осей
    ctx.moveTo(290, 145); ctx.lineTo(300, 150); ctx.lineTo(290, 155);
    ctx.moveTo(145, 10);  ctx.lineTo(150, 0);   ctx.lineTo(155, 10);

    // засечки с метками r и r/2
    var rLabel = hasValidR ? rNum : 'R';
    var rHalfLabel = hasValidR ? (rNum / 2) : 'R/2';
    var rPxVal = rNum * SCALE;
    var halfRPxVal = (rNum / 2) * SCALE;

    var ticks = [
        { px: 150 - rPxVal, label: hasValidR ? (-rNum).toString() : '-R', axis: 'x' },
        { px: 150 - halfRPxVal, label: hasValidR ? (-rNum / 2).toString() : '-R/2', axis: 'x' },
        { px: 150 + halfRPxVal, label: hasValidR ? (rNum / 2).toString() : 'R/2', axis: 'x' },
        { px: 150 + rPxVal, label: hasValidR ? rNum.toString() : 'R', axis: 'x' },
        { py: 150 - rPxVal, label: hasValidR ? rNum.toString() : 'R', axis: 'y' },
        { py: 150 - halfRPxVal, label: hasValidR ? (rNum / 2).toString() : 'R/2', axis: 'y' },
        { py: 150 + halfRPxVal, label: hasValidR ? (-rNum / 2).toString() : '-R/2', axis: 'y' },
        { py: 150 + rPxVal, label: hasValidR ? (-rNum).toString() : '-R', axis: 'y' }
    ];

    for (var i = 0; i < ticks.length; i++) {
        var t = ticks[i];
        if (t.axis === 'x') {
            if (t.px >= 10 && t.px <= 290) {
                ctx.moveTo(t.px, 145);
                ctx.lineTo(t.px, 155);
            }
        } else {
            if (t.py >= 10 && t.py <= 290) {
                ctx.moveTo(145, t.py);
                ctx.lineTo(155, t.py);
            }
        }
    }
    ctx.stroke();

    // подписываем оси x и y ярким белым цветом
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('x', 285, 140);
    ctx.fillText('y', 160, 15);

    for (var j = 0; j < ticks.length; j++) {
        var item = ticks[j];
        if (item.axis === 'x') {
            if (item.px >= 10 && item.px <= 280) {
                ctx.fillText(item.label, item.px - 10, 140);
            }
        } else {
            if (item.py >= 20 && item.py <= 290) {
                ctx.fillText(item.label, 160, item.py + 4);
            }
        }
    }

    // рисуем все точки из истории
    narisovatStaryeTochki(rVal);

    // если мышь наведена на график — рисуем прицел
    if (myishX !== null && hasValidR) {
        narisovatPricel(myishX, myishY);
    }
}

// примагничиваем координаты к пунктирной рамке [-4..4] и (-5..3) чтоб не вылететь за границы
function getClampedCoords(canvasX, canvasY) {
    var raw = pxToXY(canvasX, canvasY);
    var minX = -4;
    var maxX = 4;
    var minY = -4.999;
    var maxY = 2.999;

    var clampedX = Math.max(minX, Math.min(maxX, raw.x));
    var clampedY = Math.max(minY, Math.min(maxY, raw.y));

    return {
        x: Math.round(clampedX * 1000) / 1000,
        y: Math.round(clampedY * 1000) / 1000
    };
}

// рисуем прицел мышки с пунктирными проекциями на оси в неоновом стиле
function narisovatPricel(cX, cY) {
    if (!ctx) return;
    var coords = getClampedCoords(cX, cY);
    var targetPx = xyToPx(coords.x, coords.y);

    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;

    ctx.moveTo(targetPx.x, 150);
    ctx.lineTo(targetPx.x, targetPx.y);
    ctx.lineTo(150, targetPx.y);
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.fillStyle = '#ff2a85';
    ctx.arc(targetPx.x, targetPx.y, 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('(' + coords.x.toFixed(2) + ', ' + coords.y.toFixed(2) + ')', targetPx.x + 7, targetPx.y - 7);
}

// отрисовываем точки из истории проверок (зеленые - попал, розовые - мимо)
function narisovatStaryeTochki(currentRVal) {
    if (!ctx) return;
    for (var i = 0; i < historyOfTochki.length; i++) {
        var pt = historyOfTochki[i];
        if (hideInvalidDotes && (pt.isInvalid || pt.isTampered)) {
            continue;
        }

        var pos = xyToPx(pt.x, pt.y);

        ctx.beginPath();
        if (pt.isTampered || pt.isInvalid) {
            ctx.fillStyle = '#ffaa00';
        } else if (pt.hit) {
            ctx.fillStyle = '#00ff88';
        } else {
            ctx.fillStyle = '#ff2a85';
        }

        ctx.arc(pos.x, pos.y, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// вычисляем точные координаты курсора с учетом реального размера канваса
function getXY(cvs, event) {
    var rect = cvs.getBoundingClientRect();
    var scaleX = cvs.width / rect.width;
    var scaleY = cvs.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

if (canvas) {
    // трекаем движение мыши для прицела
    canvas.addEventListener('mousemove', function(e) {
        var pos = getXY(canvas, e);
        myishX = pos.x;
        myishY = pos.y;

        var rVal = document.getElementById('r-select') ? document.getElementById('r-select').value : '';
        narisovatGrafik(rVal);
    });

    // убираем прицел когда курсор ушел с холста
    canvas.addEventListener('mouseleave', function() {
        myishX = null;
        myishY = null;

        var rVal = document.getElementById('r-select') ? document.getElementById('r-select').value : '';
        narisovatGrafik(rVal);
    });

    // клик по графику: если r выбран — шлем на сервер, если нет — ругаемся о невозможности определения координат
    canvas.addEventListener('click', async function(e) {
        var rSelect = document.getElementById('r-select');
        var rVal = rSelect ? rSelect.value : '';

        if (!isValidR(rVal)) {
            pokazatOshibku('Невозможно определить координаты: сначала выберите радиус области R!');
            return;
        }

        var rNum = toStrAndDZ(rVal);
        var pos = getXY(canvas, e);
        var coords = getClampedCoords(pos.x, pos.y);

        await otpravitZapros(coords.x, coords.y, rNum, true);
    });
}

// добавляем свежую строку в html-таблицу на клиенте
function vstavkaVTablicu(x, y, r, hit, timeStr, execTimeStr, isInvalid, isTampered) {
    var tbody = document.getElementById('results-body');
    if (!tbody) return;

    var tr = document.createElement('tr');

    if (isTampered || isInvalid) {
        tr.classList.add('invalid-row');
        if (hideInvalidDotes) {
            tr.classList.add('hidden-row');
        }
    }

    var resText = (isTampered || isInvalid) ? 'Тут хрень' : (hit === true ? 'Попал' : (hit === false ? 'Мимо' : 'Тут хрень'));
    var xDisplay = typeof x === 'number' ? x.toFixed(3) : x;
    var yDisplay = typeof y === 'number' ? y.toFixed(3) : y;
    var rDisplay = typeof r === 'number' ? r.toFixed(1) : r;

    tr.innerHTML = '<td>' + xDisplay + '</td>' +
        '<td>' + yDisplay + '</td>' +
        '<td>' + rDisplay + '</td>' +
        '<td>' + resText + '</td>' +
        '<td>' + (timeStr || '-') + '</td>' +
        '<td>' + (execTimeStr || '-') + '</td>';

    tbody.prepend(tr);
}

// определяем url сервлета контроллера с учетом context path
function getEndpoint() {
    if (window.CONTEXT_PATH !== undefined) {
        return window.CONTEXT_PATH + '/controller';
    }
    return '/weblab3/controller';
}

// отправляем ajax post запрос на ControllerServlet
async function otpravitZapros(x, y, r, fromCanvas) {
    var endpoint = getEndpoint();
    var params = new URLSearchParams();
    params.append('x', x);
    params.append('y', y);
    params.append('r', r);
    params.append('fromCanvas', Boolean(fromCanvas));
    params.append('ajax', 'true');

    var startTimeClient = performance.now();

    try {
        var response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: params.toString()
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        var data = await response.json();
        if (!data.valid) {
            pokazatOshibku(data.error || 'Сервер отклонил параметры!');
            return;
        }

        historyOfTochki.push({
            x: data.x,
            y: data.y,
            r: data.r,
            hit: data.hit,
            isInvalid: false,
            isTampered: false
        });

        vstavkaVTablicu(data.x, data.y, data.r, data.hit, data.currentTime, data.executionTime, false, false);
        narisovatGrafik(r.toString());

        // врубаем пасхалку только для ручного ввода, по графику ничего не триггерим
        if (!fromCanvas) {
            if (data.hit) {
                triggerFnafEasterEgg();
            } else {
                triggerGtaEasterEgg();
            }
        }

    } catch(err) {
        console.warn('Сервер недоступен, расчет локально:', err);
        var hit = proverkaPopadaniya(x, y, r);
        var clientExecTime = (performance.now() - startTimeClient).toFixed(3) + ' мс';
        var nowStr = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' (Европа/Москва)';

        historyOfTochki.push({
            x: x,
            y: y,
            r: r,
            hit: hit,
            isInvalid: false,
            isTampered: false
        });

        vstavkaVTablicu(x, y, r, hit, nowStr, clientExecTime, false, false);
        narisovatGrafik(r.toString());

        // пасхалка чисто при ручном вводе, клик по графику ничего не триггерит
        if (!fromCanvas) {
            if (hit) {
                triggerFnafEasterEgg();
            } else {
                triggerGtaEasterEgg();
            }
        }
    }
}

// срезаем левые символы в поле y на лету
function sanitizeInput(el) {
    if (!el) return;
    var rawVal = el.value;

    var val = rawVal.replace(/[^0-9.,-]/g, '');
    val = val.replace(/[\.,]{2,}/g, '.');

    var parts = val.split(/[\.,]/);
    if (parts.length > 2) {
        val = parts[0] + '.' + parts.slice(1).join('');
    }

    if (val.indexOf('-') > 0) {
        val = val.charAt(0) + val.substring(1).replace(/-/g, '');
    }

    if (rawVal !== val) {
        el.value = val;
    }
}

// разблокируем кнопку отправки только если все инпуты заполнены по фэншую
function validForm() {
    var submitBtn = document.getElementById('submit-btn');
    if (!submitBtn) return;

    var xInput = document.getElementById('x-input');
    var yInput = document.getElementById('y-input');
    var rSelect = document.getElementById('r-select');

    if (yInput) sanitizeInput(yInput);

    var xVal = xInput ? xInput.value.trim() : '';
    var yVal = yInput ? yInput.value.trim() : '';
    var rVal = rSelect ? rSelect.value.trim() : '';

    if (xVal === '' || yVal === '' || rVal === '') {
        submitBtn.disabled = true;
        return;
    }

    var isXValid = isValidX(xVal);
    var isYValid = isValidY(yVal);
    var isRValid = isValidR(rVal);

    submitBtn.disabled = !(isXValid && isYValid && isRValid);
}

// логика выбора чекбоксов x: делаем поведение как у радиокнопки (только один выбор)
var xCheckboxes = document.querySelectorAll('.x-cb');
var xInput = document.getElementById('x-input');

if (xCheckboxes.length > 0) {
    xCheckboxes.forEach(function(cb) {
        cb.addEventListener('change', function() {
            if (this.checked) {
                xCheckboxes.forEach(function(other) {
                    if (other !== cb) {
                        other.checked = false;
                        if (other.parentElement) other.parentElement.classList.remove('active');
                    }
                });
                if (this.parentElement) this.parentElement.classList.add('active');
                xInput.value = this.value;
            } else {
                if (this.parentElement) this.parentElement.classList.remove('active');
                xInput.value = '';
            }
            validForm();
        });
    });
}

// слушатели на ввод y и смену r
var yInputEl = document.getElementById('y-input');
var rSelectEl = document.getElementById('r-select');

if (yInputEl) {
    yInputEl.addEventListener('input', validForm);
    yInputEl.addEventListener('keyup', validForm);
}

if (rSelectEl) {
    rSelectEl.addEventListener('change', function() {
        validForm();
        narisovatGrafik(this.value);
    });
}

// слушаем поле пасхалки на ввод триггерных слов (dance, fnaf, wasted, абобус)
var topInput = document.getElementById('top-left-input');
if (topInput) {
    topInput.addEventListener('input', function() {
        var val = this.value.trim().toLowerCase();
        if (val === 'dance' || val === 'dancce' || val === codeword) {
            startDance();
        } else if (val === 'fnaf' || val === '6am' || val === 'попадание') {
            stopDance();
            triggerFnafEasterEgg();
        } else if (val === 'gta' || val === 'wasted' || val === 'промах') {
            stopDance();
            triggerGtaEasterEgg();
        } else {
            stopDance();
        }
    });
}

// кнопка переключения видимости невалидных точек
var toggleInvalidBtn = document.getElementById('toggle-invalid-btn');
if (toggleInvalidBtn) {
    toggleInvalidBtn.textContent = hideInvalidDotes ? 'Показать невалидные' : 'Скрыть невалидные';

    toggleInvalidBtn.addEventListener('click', function() {
        hideInvalidDotes = !hideInvalidDotes;

        var invalidRows = document.querySelectorAll('.invalid-row');
        for (var i = 0; i < invalidRows.length; i++) {
            if (hideInvalidDotes) {
                invalidRows[i].classList.add('hidden-row');
            } else {
                invalidRows[i].classList.remove('hidden-row');
            }
        }

        this.textContent = hideInvalidDotes ? 'Показать невалидные' : 'Скрыть невалидные';

        var rVal = document.getElementById('r-select') ? document.getElementById('r-select').value : '';
        narisovatGrafik(rVal);
    });
}

// финальный чекер перед сабмитом формы (улетает post на controller -> area-check -> result.jsp)
var pointForm = document.getElementById('point-form');
if (pointForm) {
    pointForm.addEventListener('submit', function(e) {
        var xVal = document.getElementById('x-input') ? document.getElementById('x-input').value : '';
        if (!isValidX(xVal)) {
            e.preventDefault();
            pokazatOshibku('Выберите значение координаты X!');
            return;
        }

        var yVal = document.getElementById('y-input') ? document.getElementById('y-input').value : '';
        if (!isValidY(yVal)) {
            e.preventDefault();
            pokazatOshibku('Введите Y строго в интервале (-5 ... 3)!');
            return;
        }

        var rVal = document.getElementById('r-select') ? document.getElementById('r-select').value : '';
        if (!isValidR(rVal)) {
            e.preventDefault();
            pokazatOshibku('Выберите значение R из предложенного списка!');
            return;
        }
    });
}

// очищаем таблицу и просим контроллер дропнуть историю в сессии
var clearBtn = document.getElementById('clear-btn');
if (clearBtn) {
    clearBtn.addEventListener('click', async function() {
        var endpoint = getEndpoint();
        try {
            await fetch(endpoint + '?action=clear&ajax=true', {
                method: 'GET',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
        } catch(err) {
            console.warn('Не удалось очистить историю на сервере:', err);
        }

        var tbody = document.getElementById('results-body');
        if (tbody) tbody.innerHTML = '';
        historyOfTochki = [];
        var rVal = document.getElementById('r-select') ? document.getElementById('r-select').value : '';
        narisovatGrafik(rVal);
    });
}

// подгружаем сохраненные точки из сессионного бина при старте страницы
if (window.INITIAL_POINTS && Array.isArray(window.INITIAL_POINTS)) {
    for (var k = 0; k < window.INITIAL_POINTS.length; k++) {
        var pt = window.INITIAL_POINTS[k];
        historyOfTochki.push({
            x: toStrAndDZ(pt.x),
            y: toStrAndDZ(pt.y),
            r: toStrAndDZ(pt.r),
            hit: Boolean(pt.hit),
            isInvalid: false,
            isTampered: false
        });
    }
}

// запускаем валидацию формы и рисуем пустой график с дефолтным r
if (canvas) {
    validForm();
    var rElInit = document.getElementById('r-select');
    if (rElInit) narisovatGrafik(rElInit.value);
}
