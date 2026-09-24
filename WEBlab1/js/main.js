const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');

var historyOfTochki = [];
var myishX = null;
var myishY = null;

var danceInterval = null;
var danceR = 0;
var origTableStat = [];
var hideInvalidDotes = true; // По умолчанию скрываем подмененные и невалидные точки при перезагрузке

const codeword = 'абобус';

// Запрос реального времени с веб-сервера или через Time API
async function getServerTime() {
    try {
        var cleanUrl = window.location.href.split('?')[0];
        var resp = await fetch(cleanUrl + '?_t=' + Date.now() + Math.random(), {
            method: 'HEAD',
            cache: 'no-store'
        });
        var dateHeader = resp.headers.get('date');
        if (dateHeader) {
            return new Date(dateHeader).toISOString();
        }
    } catch (e) {}
    try {
        var apiResp = await fetch('https://worldtimeapi.org/api/timezone/Europe/Moscow');
        var data = await apiResp.json();
        if (data && data.datetime) {
            return new Date(data.datetime).toISOString();
        }
    } catch (e) {}
    return new Date().toISOString();
}

// Склеивает все джсон строки и прогоняет по 32-битному хэш-алгоритму DJB2
function protectothack(dataObj) {
    if (!dataObj || typeof dataObj !== 'object') return '';
    var str = JSON.stringify({ x: dataObj.x, y: dataObj.y, r: dataObj.r, hit: dataObj.hit, time: dataObj.time }) + codeword;
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash.toString();
}

// Парсит в стринг и превращает точку в запятую
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

// Валидация Р (не включая граничные точки 1 и 4)
function isValidR(rVal) {
    var rNum = toStrAndDZ(rVal);
    return !isNaN(rNum) && rNum > 1 && rNum < 4;
}

// Валидация Y (не включая граничные точки -5 и 3)
function isValidY(yVal) {
    var yNum = toStrAndDZ(yVal);
    return !isNaN(yNum) && yNum > -5 && yNum < 3;
}

// Переводик коорды х у в пиксели холста
function xyToPx(x, y) {
    var px = 150 + x * 25;
    var py = 150 - y * 25;
    return { x: px, y: py };
}

// Парсит нажатие клавиши в коорды плюс примагничивает Х по 0.5 и У по 0.1
function translateMouseToXY(canvasX, canvasY) {
    var rawX = (canvasX - 150) / 25;
    var rawY = (150 - canvasY) / 25;

    var snapX = Math.round(rawX * 2) / 2;
    var snapY = Math.round(rawY * 10) / 10;

    return { x: snapX, y: snapY };
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

// Рисование основного графика через канвас. Координаты 0 - (150; 150)
function narisovatGrafik(rVal) {
    ctx.clearRect(0, 0, 300, 300);

    if (isValidR(rVal)) {
        var rNum = toStrAndDZ(rVal);
        ctx.fillStyle = '#3399ff';

        var kvR = rNum * 25;
        var polR = (rNum / 2) * 25;

        // 2 четверть: прямоугольник
        ctx.fillRect(150 - kvR, 150 - kvR, kvR, kvR);

        // 1 четверть: сектор круга
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, polR, -Math.PI / 2, 0, false);
        ctx.closePath();
        ctx.fill();

        // 3 четверть: треугольник
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.lineTo(150 - polR, 150);
        ctx.lineTo(150, 150 + kvR);
        ctx.closePath();
        ctx.fill();
    }

    // Отрисовка невидимых стен (ограничение допустимой зоны) пунктирной рамкой
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(100, 75, 100, 200);
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

    // Засечки
    for (var i = -5; i <= 5; i++) {
        if (i === 0) continue;
        var px = 150 + i * 25;
        var py = 150 - i * 25;

        if (px >= 0 && px <= 300) {
            ctx.moveTo(px, 145);
            ctx.lineTo(px, 155);
        }

        if (py >= 0 && py <= 300) {
            ctx.moveTo(145, py);
            ctx.lineTo(155, py);
        }
    }

    ctx.stroke();

    // Подписи осей
    ctx.fillStyle = '#000000';
    ctx.font = '11px monospace';
    ctx.fillText('x', 285, 140);
    ctx.fillText('y', 160, 15);

    for (var j = -5; j <= 5; j++) {
        if (j === 0) continue;
        var labelX = 150 + j * 25;
        var labelY = 150 - j * 25;

        if (labelX >= 10 && labelX <= 280) {
            var xOffset = (j > 0) ? -3 : -7;
            ctx.fillText(j.toString(), labelX + xOffset, 140);
        }

        if (labelY >= 20 && labelY <= 290) {
            ctx.fillText(j.toString(), 160, labelY + 4);
        }
    }

    narisovatStaryeTochki();

    if (myishX !== null && isValidR(rVal)) {
        narisovatPricel(myishX, myishY);
    }
}

// Рисует прицел с точными пунктирами
function narisovatPricel(cX, cY) {
    var snapped = translateMouseToXY(cX, cY);

    if (snapped.x < -2 || snapped.x > 2 || snapped.y <= -5 || snapped.y >= 3) {
        return;
    }

    var targetPx = xyToPx(snapped.x, snapped.y);

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
    ctx.fillText('(' + snapped.x + ', ' + snapped.y + ')', targetPx.x + 7, targetPx.y - 7);
}

// Рисует точки из массива истории
function narisovatStaryeTochki() {
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

// Точный расчет координат мыши с учетом масштабирования Canvas
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

    var rVal = document.getElementById('r-input').value;
    narisovatGrafik(rVal);
});

canvas.addEventListener('mouseleave', function() {
    myishX = null;
    myishY = null;

    var rVal = document.getElementById('r-input').value;
    narisovatGrafik(rVal);
});

// Клик по канвасу
canvas.addEventListener('click', async function(e) {
    var rVal = document.getElementById('r-input').value;

    if (!isValidR(rVal)) {
        pokazatOshibku('Укажи значение R строго в интервале от 1 до 4 (не включая 1 и 4)!');
        return;
    }

    var rNum = toStrAndDZ(rVal);
    var pos = getXY(canvas, e);
    var snapped = translateMouseToXY(pos.x, pos.y);

    if (snapped.x < -2 || snapped.x > 2 || snapped.y <= -5 || snapped.y >= 3) {
        pokazatOshibku('Точка за пределами допустимой области (-2 < X < 2, -5 < Y < 3)!');
        return;
    }

    await obrabotkaTochki(snapped.x, snapped.y, rNum);
});

// Проверка попадания в область
function proverkaPopadaniya(x, y, r) {
    if (x <= 0 && y >= 0) {
        return (x >= -r) && (y <= r);
    }
    if (x >= 0 && y >= 0) {
        return (x * x + y * y) <= ((r / 2) * (r / 2));
    }
    if (x <= 0 && y <= 0) {
        return y >= (-2 * x - r);
    }
    return false;
}

// Форматирует ISO-дату
function formatiruyDaty(isoStr) {
    if (!isoStr) return '-';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;

    var formattedDate = d.toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return formattedDate + ' (Европа/Москва)';
}

// Генерит тэйбл роу и вставляет
function vstavkaVTablicu(x, y, r, Popadal, vremyaStr, isInvalid, isTampered) {
    var tbody = document.getElementById('results-body');
    if (!tbody) return;

    var tr = document.createElement('tr');

    if (isTampered || isInvalid) {
        tr.classList.add('invalid-row');
        if (hideInvalidDotes) {
            tr.classList.add('hidden-row');
        }
    }

    var dt = formatiruyDaty(vremyaStr);
    var resText = (isTampered || isInvalid) ? 'Тут хрень' : (Popadal === true ? 'Попал' : (Popadal === false ? 'Мимо' : 'Тут хрень'));

    tr.innerHTML = '<td>' + x + '</td>' +
        '<td>' + y + '</td>' +
        '<td>' + r + '</td>' +
        '<td>' + resText + '</td>' +
        '<td>' + dt + '</td>';

    tbody.prepend(tr);
}

// Сохраняет в LocalStorage
function sohranitVStorage(zapis) {
    var massiv = [];
    try {
        massiv = JSON.parse(localStorage.getItem('lab1_history')) || [];
    } catch(e) {
        massiv = [];
    }
    zapis.hash = protectothack(zapis);
    massiv.push(zapis);
    localStorage.setItem('lab1_history', JSON.stringify(massiv));
}

// Загрузка из LocalStorage с полной валидацией
function zagruzitIzStorage() {
    var rawData = localStorage.getItem('lab1_history');
    if (!rawData) return;

    historyOfTochki = [];
    var staryeDannye = [];

    try {
        staryeDannye = JSON.parse(rawData);
    } catch(e) {
        var matches = rawData.match(/\{[^{}]*\}/g);
        if (matches) {
            for (var m = 0; m < matches.length; m++) {
                try {
                    staryeDannye.push(JSON.parse(matches[m]));
                } catch(objErr) {
                    staryeDannye.push({ isCorrupted: true });
                }
            }
        }
    }

    var validXValues = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];

    for (var i = 0; i < staryeDannye.length; i++) {
        try {
            var elem = staryeDannye[i];
            if (!elem || typeof elem !== 'object') continue;

            if (elem.isCorrupted) {
                vstavkaVTablicu('?', '?', '?', false, new Date().toISOString(), true, true);
                historyOfTochki.push({ x: 0, y: 0, r: 1, hit: false, isInvalid: true, isTampered: true });
                continue;
            }

            var xNum = toStrAndDZ(elem.x);
            var yNum = toStrAndDZ(elem.y);
            var rNum = toStrAndDZ(elem.r);

            var isTampered = false;
            var expectedHash = protectothack(elem);
            if (!elem.hash || elem.hash !== expectedHash) {
                isTampered = true;
            }

            if (typeof elem.hit !== 'boolean') {
                isTampered = true;
            }

            var isInvalid = false;
            if (isNaN(xNum) || validXValues.indexOf(xNum) === -1 ||
                isNaN(yNum) || yNum <= -5 || yNum >= 3 ||
                isNaN(rNum) || rNum <= 1 || rNum >= 4) {
                isInvalid = true;
            }

            vstavkaVTablicu(elem.x, elem.y, elem.r, elem.hit, elem.time, isInvalid, isTampered);
            historyOfTochki.push({
                x: xNum,
                y: yNum,
                r: rNum,
                hit: Boolean(elem.hit),
                isInvalid: isInvalid,
                isTampered: isTampered
            });
        } catch(err) {
            vstavkaVTablicu('?', '?', '?', false, new Date().toISOString(), true, true);
        }
    }
}

// Главная функция обработки точки
async function obrabotkaTochki(x, y, r) {
    var isHit = proverkaPopadaniya(x, y, r);
    var nowTime = await getServerTime();

    var obj = { x: x, y: y, r: r, hit: isHit, time: nowTime };

    historyOfTochki.push({ x: x, y: y, hit: isHit, isInvalid: false, isTampered: false });
    vstavkaVTablicu(x, y, r, isHit, nowTime, false, false);
    sohranitVStorage(obj);

    narisovatGrafik(r.toString());
}

// Очистка ввода от букв и лишних символов
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

function validCoords(inputEl) {
    if (!inputEl) return true;
    sanitizeInput(inputEl);
    var val = inputEl.value.trim();
    if (val === '') return false;
    return true;
}

function validForm() {
    var submitBtn = document.getElementById('submit-btn');
    if (!submitBtn) return;

    var yInput = document.getElementById('y-input');
    var rInput = document.getElementById('r-input');

    if (yInput) sanitizeInput(yInput);
    if (rInput) sanitizeInput(rInput);

    var yVal = yInput ? yInput.value.trim() : '';
    var rVal = rInput ? rInput.value.trim() : '';

    if (yVal === '' || rVal === '') {
        submitBtn.disabled = true;
        return;
    }

    var isYValid = isValidY(yVal);
    var isRValid = isValidR(rVal);

    submitBtn.disabled = !(isYValid && isRValid);
}

// Навешивание слушателей
var yInputEl = document.getElementById('y-input');
var rInputEl = document.getElementById('r-input');

if (yInputEl) {
    yInputEl.addEventListener('input', validForm);
    yInputEl.addEventListener('keyup', validForm);
}

if (rInputEl) {
    rInputEl.addEventListener('input', function() {
        validForm();
        narisovatGrafik(this.value);
    });
    rInputEl.addEventListener('keyup', function() {
        validForm();
        narisovatGrafik(this.value);
    });
}

// Пасхалка
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

// Переключение видимости невалидных точек
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

        var rVal = document.getElementById('r-input').value;
        narisovatGrafik(rVal);
    });
}

// Обработка отправки формы
document.getElementById('point-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    var xVybory = document.querySelectorAll('input[name="x"]:checked');
    if (xVybory.length === 0) {
        pokazatOshibku('Выбери хотя бы один X!');
        return;
    }

    var validXValues = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];

    for (var i = 0; i < xVybory.length; i++) {
        var xNum = toStrAndDZ(xVybory[i].value);
        if (validXValues.indexOf(xNum) === -1) {
            pokazatOshibku('Выбран недопустимый X!');
            return;
        }
    }

    var yVal = document.getElementById('y-input').value;

    if (!isValidY(yVal)) {
        pokazatOshibku('Введи Y строго в интервале от -5 до 3 (не включая -5 и 3)!');
        return;
    }

    var rVal = document.getElementById('r-input').value;

    if (!isValidR(rVal)) {
        pokazatOshibku('Введи R строго в интервале от 1 до 4 (не включая 1 и 4)!');
        return;
    }

    var yNum = toStrAndDZ(yVal);
    var rNum = toStrAndDZ(rVal);

    for (var j = 0; j < xVybory.length; j++) {
        var xVal = toStrAndDZ(xVybory[j].value);
        await obrabotkaTochki(xVal, yNum, rNum);
    }
});

// Очистка истории
document.getElementById('clear-btn').addEventListener('click', function() {
    localStorage.removeItem('lab1_history');
    document.getElementById('results-body').innerHTML = '';
    historyOfTochki = [];
    var rVal = document.getElementById('r-input').value;
    narisovatGrafik(rVal);
});

// Первый запуск
zagruzitIzStorage();
validForm();
narisovatGrafik(document.getElementById('r-input').value);