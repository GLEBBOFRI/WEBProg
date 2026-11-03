const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');

var historyOfTochki = [];
var myishX = null;
var myishY = null;

var danceInterval = null;
var danceR = 0;
var origTableStat = [];
var hideInvalidDotes = true; // По умолчанию скрываем невалидные точки при перезагрузке

const codeword = 'абобус';
const SCALE = 30; // 1 единица = 30 пикселей (при ширине 300px диапазон от -4 до 4 составляет [-120px, +120px])

// Склеивает все джсон строки и прогоняет по 32-битному хэш-алгоритму DJB2
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

// Парсит в число и заменяет запятую на точку
function toStrAndDZ(val) {
    if (val === null || val === undefined) return NaN;
    var str = String(val).trim().replace(',', '.');
    return str === '' ? NaN : Number(str);
}

// Создает на 3 сек тост с ошибкой
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

// Валидация R: Select {'1', '2', '3', '4', '5'}
function isValidR(rVal) {
    var rNum = toStrAndDZ(rVal);
    var validR = [1, 2, 3, 4, 5];
    return !isNaN(rNum) && validR.indexOf(rNum) !== -1;
}

// Валидация Y: Text (-5 ... 3), строгий интервал не включая границы
function isValidY(yVal) {
    var yNum = toStrAndDZ(yVal);
    return !isNaN(yNum) && yNum > -5 && yNum < 3;
}

// Валидация X: Checkbox {'-4','-3','-2','-1','0','1','2','3','4'}
function isValidX(xVal) {
    var xNum = toStrAndDZ(xVal);
    var validX = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    return !isNaN(xNum) && validX.indexOf(xNum) !== -1;
}

// Перевод координат (x, y) в пиксели холста
function xyToPx(x, y) {
    var px = 150 + x * SCALE;
    var py = 150 - y * SCALE;
    return { x: px, y: py };
}

// Перевод пикселей холста в координаты (x, y)
function pxToXY(px, py) {
    var rawX = (px - 150) / SCALE;
    var rawY = (150 - py) / SCALE;
    return {
        x: Math.round(rawX * 1000) / 1000,
        y: Math.round(rawY * 1000) / 1000
    };
}

// Пасхалка с танцами таблиц
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

// Проверка попадания на клиенте (для валидации и отображения)
function proverkaPopadaniya(x, y, r) {
    // 1 четверть: прямоугольник [0, R] x [0, R/2]
    if (x >= 0 && y >= 0) {
        return (x <= r) && (y <= (r / 2));
    }
    // 2 четверть: треугольник (-R/2, 0), (0, 0), (0, R)
    if (x <= 0 && y >= 0) {
        return (x >= -r / 2) && (y <= (2 * x + r));
    }
    // 4 четверть: сектор круга радиуса R
    if (x >= 0 && y <= 0) {
        return (x * x + y * y) <= (r * r);
    }
    return false;
}

// Отрисовка графика варианта 3 лабы
function narisovatGrafik(rVal) {
    ctx.clearRect(0, 0, 300, 300);

    var hasValidR = isValidR(rVal);
    var rNum = hasValidR ? toStrAndDZ(rVal) : 2; // Если R не выбран, используем 2 для разметки осей

    if (hasValidR) {
        ctx.fillStyle = '#3399ff';

        var rPx = rNum * SCALE;
        var halfRPx = (rNum / 2) * SCALE;

        // 1 четверть: прямоугольник (ширина R, высота R/2)
        ctx.fillRect(150, 150 - halfRPx, rPx, halfRPx);

        // 2 четверть: треугольник (от (-R/2, 0) до (0, R))
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.lineTo(150 - halfRPx, 150);
        ctx.lineTo(150, 150 - rPx);
        ctx.closePath();
        ctx.fill();

        // 4 четверть: четверть круга радиуса R (от (R, 0) до (0, -R))
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, rPx, 0, Math.PI / 2, false);
        ctx.closePath();
        ctx.fill();
    }

    // Отрисовка невидимых стен (ограничение допустимой зоны: X: -4..4, Y: от -5 до 3 не включая) пунктирной рамкой
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(30, 60, 240, 240);
    ctx.setLineDash([]);

    // Оси координат
    ctx.beginPath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    ctx.moveTo(0, 150); ctx.lineTo(300, 150);
    ctx.moveTo(150, 0); ctx.lineTo(150, 300);

    // Стрелочки
    ctx.moveTo(290, 145); ctx.lineTo(300, 150); ctx.lineTo(290, 155);
    ctx.moveTo(145, 10);  ctx.lineTo(150, 0);   ctx.lineTo(155, 10);

    // Засечки и метки на осях
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

    // Подписи осей и меток
    ctx.fillStyle = '#000000';
    ctx.font = '11px monospace';
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

    narisovatStaryeTochki(rVal);

    if (myishX !== null && hasValidR) {
        narisovatPricel(myishX, myishY);
    }
}

// Перевод координат курсора с примагничиванием к границам допустимой зоны (X: -4..4, Y: (-5..3))
function getClampedCoords(canvasX, canvasY) {
    var raw = pxToXY(canvasX, canvasY);
    var minX = -4;
    var maxX = 4;
    // Границы Y не включая -5 и 3
    var minY = -4.999;
    var maxY = 2.999;

    var clampedX = Math.max(minX, Math.min(maxX, raw.x));
    var clampedY = Math.max(minY, Math.min(maxY, raw.y));

    return {
        x: Math.round(clampedX * 1000) / 1000,
        y: Math.round(clampedY * 1000) / 1000
    };
}

// Прицел при наведении мыши (точка примагничивается к пунктирной границе)
function narisovatPricel(cX, cY) {
    var coords = getClampedCoords(cX, cY);
    var targetPx = xyToPx(coords.x, coords.y);

    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;

    ctx.moveTo(targetPx.x, 150);
    ctx.lineTo(targetPx.x, targetPx.y);
    ctx.lineTo(150, targetPx.y);
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.fillStyle = '#ff0000';
    ctx.arc(targetPx.x, targetPx.y, 4, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font = '11px monospace';
    ctx.fillText('(' + coords.x.toFixed(2) + ', ' + coords.y.toFixed(2) + ')', targetPx.x + 7, targetPx.y - 7);
}

// Отрисовка точек из истории
function narisovatStaryeTochki(currentRVal) {
    for (var i = 0; i < historyOfTochki.length; i++) {
        var pt = historyOfTochki[i];
        if (hideInvalidDotes && (pt.isInvalid || pt.isTampered)) {
            continue;
        }

        var pos = xyToPx(pt.x, pt.y);

        ctx.beginPath();
        if (pt.isTampered || pt.isInvalid) {
            ctx.fillStyle = '#ff8c00';
        } else if (pt.hit) {
            ctx.fillStyle = '#00cc00';
        } else {
            ctx.fillStyle = '#ff0000';
        }

        ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// Расчет координат мыши с учетом масштаба Canvas
function getXY(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

canvas.addEventListener('mousemove', function(e) {
    var pos = getXY(canvas, e);
    myishX = pos.x;
    myishY = pos.y;

    var rVal = document.getElementById('r-select').value;
    narisovatGrafik(rVal);
});

canvas.addEventListener('mouseleave', function() {
    myishX = null;
    myishY = null;

    var rVal = document.getElementById('r-select').value;
    narisovatGrafik(rVal);
});

// Клик по канвасу
canvas.addEventListener('click', async function(e) {
    var rSelect = document.getElementById('r-select');
    var rVal = rSelect.value;

    if (!isValidR(rVal)) {
        pokazatOshibku('Сначала выберите корректное значение R!');
        return;
    }

    var rNum = toStrAndDZ(rVal);
    var pos = getXY(canvas, e);
    var coords = getClampedCoords(pos.x, pos.y);

    await otpravitZapros(coords.x, coords.y, rNum, true);
});

// Вставка строки в таблицу результатов
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

// Загрузка истории точек с сервера (точки хранятся на сервере, а не на клиенте)
async function zagruzitIstoriyuSServera() {
    var endpoint = getEndpoint();
    try {
        var response = await fetch(endpoint + '?action=history', {
            method: 'GET'
        });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        var data = await response.json();
        if (data && Array.isArray(data.points)) {
            historyOfTochki = [];
            var tbody = document.getElementById('results-body');
            tbody.innerHTML = '';
            for (var i = 0; i < data.points.length; i++) {
                var p = data.points[i];
                var xNum = toStrAndDZ(p.x);
                var yNum = toStrAndDZ(p.y);
                var rNum = toStrAndDZ(p.r);
                historyOfTochki.push({
                    x: xNum,
                    y: yNum,
                    r: rNum,
                    hit: Boolean(p.hit),
                    isInvalid: false,
                    isTampered: false
                });
                vstavkaVTablicu(xNum, yNum, rNum, p.hit, p.currentTime || p.time, p.executionTime || p.execTime, false, false);
            }
            var rVal = document.getElementById('r-select').value;
            narisovatGrafik(rVal);
        }
    } catch(err) {
        console.warn('Сервер недоступен для загрузки истории, загрузка из локального хранилища:', err);
        try {
            var saved = localStorage.getItem('lab3_history');
            if (saved) {
                var list = JSON.parse(saved);
                if (Array.isArray(list)) {
                    historyOfTochki = list;
                    var tbody = document.getElementById('results-body');
                    tbody.innerHTML = '';
                    for (var k = 0; k < historyOfTochki.length; k++) {
                        var pt = historyOfTochki[k];
                        vstavkaVTablicu(pt.x, pt.y, pt.r, pt.hit, pt.time, pt.execTime, false, false);
                    }
                    var rVal = document.getElementById('r-select').value;
                    narisovatGrafik(rVal);
                }
            }
        } catch(e) {}
    }
}

function getEndpoint() {
    // 1. При открытии через веб-сервер факультета (se.ifmo.ru/~s465457)
    // запросы идут на порт 25000 через поднятый SSH-туннель
    if (window.location.hostname === 'se.ifmo.ru' || window.location.hostname.endsWith('.se.ifmo.ru')) {
        return 'http://localhost:25000/fcgi-bin/server.jar';
    }

    // 2. При локальном тестировании в WebStorm, Live Server или через file://
    if (window.location.protocol === 'file:' || (window.location.hostname === 'localhost' && window.location.port !== '25000')) {
        return 'http://localhost:25000/fcgi-bin/server.jar';
    }

    // 3. При прямом обращении через веб-сервер Apache (localhost:25000)
    return '/fcgi-bin/server.jar';
}

// Отправка AJAX GET запроса на FastCGI сервер
async function otpravitZapros(x, y, r, fromCanvas) {
    var endpoint = getEndpoint();
    var query = '?x=' + encodeURIComponent(x) +
                '&y=' + encodeURIComponent(y) +
                '&r=' + encodeURIComponent(r) +
                '&fromCanvas=' + encodeURIComponent(Boolean(fromCanvas));
    var url = endpoint + query;

    var startTimeClient = performance.now();

    try {
        var response = await fetch(url, {
            method: 'GET'
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        var data = await response.json();
        if (!data.valid) {
            pokazatOshibku(data.error || 'Сервер отклонил параметры!');
            return;
        }

        var entry = {
            x: data.x,
            y: data.y,
            r: data.r,
            hit: data.hit,
            time: data.currentTime,
            execTime: data.executionTime
        };

        historyOfTochki.push({
            x: data.x,
            y: data.y,
            r: data.r,
            hit: data.hit,
            isInvalid: false,
            isTampered: false
        });

        vstavkaVTablicu(data.x, data.y, data.r, data.hit, data.currentTime, data.executionTime, false, false);
        try {
            localStorage.setItem('lab3_history', JSON.stringify(historyOfTochki));
        } catch(e) {}
        narisovatGrafik(r.toString());

    } catch(err) {
        // Fallback для работы без поднятого Apache FastCGI
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
        try {
            localStorage.setItem('lab3_history', JSON.stringify(historyOfTochki));
        } catch(e) {}
        narisovatGrafik(r.toString());
    }
}

// Очистка ввода от недопустимых символов
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

// Проверка валидности всей формы для активации кнопки "Проверить"
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

// Обработка выбора чекбоксов X (Checkbox: одиночный выбор)
var xCheckboxes = document.querySelectorAll('.x-cb');
var xButtons = document.querySelectorAll('.x-btn');
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

xButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
        if (this.classList.contains('active')) {
            this.classList.remove('active');
            xInput.value = '';
        } else {
            xButtons.forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            xInput.value = this.getAttribute('data-value');
        }
        validForm();
    });
});

// Слушатели для Y и R
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

// Пасхалка танца таблиц
var topInput = document.getElementById('top-left-input');
if (topInput) {
    topInput.addEventListener('input', function() {
        var val = this.value.trim().toLowerCase();
        if (val === 'dance' || val === 'dancce' || val === codeword) {
            startDance();
        } else {
            stopDance();
        }
    });
}

// Кнопка показа/скрытия невалидных точек
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

        var rVal = document.getElementById('r-select').value;
        narisovatGrafik(rVal);
    });
}

// Отправка формы
document.getElementById('point-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    var xVal = document.getElementById('x-input').value;
    if (!isValidX(xVal)) {
        pokazatOshibku('Выберите значение координаты X!');
        return;
    }

    var yVal = document.getElementById('y-input').value;
    if (!isValidY(yVal)) {
        pokazatOshibku('Введите Y строго в интервале (-5 ... 3)!');
        return;
    }

    var rVal = document.getElementById('r-select').value;
    if (!isValidR(rVal)) {
        pokazatOshibku('Выберите значение R из предложенного списка!');
        return;
    }

    var xNum = toStrAndDZ(xVal);
    var yNum = toStrAndDZ(yVal);
    var rNum = toStrAndDZ(rVal);

    await otpravitZapros(xNum, yNum, rNum, false);
});

// Очистка таблицы и истории на сервере
document.getElementById('clear-btn').addEventListener('click', async function() {
    var endpoint = getEndpoint();
    try {
        await fetch(endpoint + '?action=clear', {
            method: 'GET'
        });
    } catch(err) {
        console.warn('Не удалось очистить историю на сервере:', err);
    }

    try {
        localStorage.removeItem('lab3_history');
    } catch(e) {}

    document.getElementById('results-body').innerHTML = '';
    historyOfTochki = [];
    var rVal = document.getElementById('r-select').value;
    narisovatGrafik(rVal);
});

// Инициализация при загрузке страницы: загружаем сохраненные точки
zagruzitIstoriyuSServera();
validForm();
narisovatGrafik(document.getElementById('r-select').value);
