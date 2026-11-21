const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');

var historyOfTochki = [];
var myishX = null;
var myishY = null;

var danceInterval = null;
var danceR = 0;
var origTableStat = [];
var hideInvalidDotes = true;

const codeword = 'абобус';
const SCALE = 30; // 1 единица = 30 пикселей (при ширине 300px диапазон от -4 до 4 составляет [-120px, +120px])

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
    ctx.clearRect(0, 0, 300, 300);

    var hasValidR = isValidR(rVal);
    var rNum = hasValidR ? toStrAndDZ(rVal) : 2;

    if (hasValidR) {
        ctx.fillStyle = '#3399ff';

        var rPx = rNum * SCALE;
        var halfRPx = (rNum / 2) * SCALE;

        // 1 четверть: заливаем прямоугольник [0, r] на [0, r/2]
        ctx.fillRect(150, 150 - halfRPx, rPx, halfRPx);

        // 2 четверть: заливаем треугольник от (-r/2, 0) до (0, r)
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.lineTo(150 - halfRPx, 150);
        ctx.lineTo(150, 150 - rPx);
        ctx.closePath();
        ctx.fill();

        // 4 четверть: заливаем четверть круга радиуса r
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, rPx, 0, Math.PI / 2, false);
        ctx.closePath();
        ctx.fill();
    }

    // рисуем пунктирную границу допустимой зоны клика: x [-4..4], y (-5..3)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(30, 60, 240, 240);
    ctx.setLineDash([]);

    // чертим оси x и y
    ctx.beginPath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    ctx.moveTo(0, 150); ctx.lineTo(300, 150);
    ctx.moveTo(150, 0); ctx.lineTo(150, 300);

    // рисуем стрелочки на концах осей
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

    // подписываем оси x и y
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

// рисуем прицел мышки с пунктирными проекциями на оси
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

// отрисовываем точки из истории проверок (зеленые - попал, красные - мимо)
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

// вычисляем точные координаты курсора с учетом реального размера канваса
function getXY(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

// трекаем движение мыши для прицела
canvas.addEventListener('mousemove', function(e) {
    var pos = getXY(canvas, e);
    myishX = pos.x;
    myishY = pos.y;

    var rVal = document.getElementById('r-select').value;
    narisovatGrafik(rVal);
});

// убираем прицел когда курсор ушел с холста
canvas.addEventListener('mouseleave', function() {
    myishX = null;
    myishY = null;

    var rVal = document.getElementById('r-select').value;
    narisovatGrafik(rVal);
});

// клик по графику: если r выбран — шлем на сервер, если нет — ругаемся о невозможности определения координат
canvas.addEventListener('click', async function(e) {
    var rSelect = document.getElementById('r-select');
    var rVal = rSelect.value;

    if (!isValidR(rVal)) {
        pokazatOshibku('Невозможно определить координаты: сначала выберите радиус области R!');
        return;
    }

    var rNum = toStrAndDZ(rVal);
    var pos = getXY(canvas, e);
    var coords = getClampedCoords(pos.x, pos.y);

    await otpravitZapros(coords.x, coords.y, rNum, true);
});

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

// слушаем поле пасхалки на ввод триггерных слов
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

        var rVal = document.getElementById('r-select').value;
        narisovatGrafik(rVal);
    });
}

// финальный чекер перед сабмитом формы (улетает post на controller -> area-check -> result.jsp)
document.getElementById('point-form').addEventListener('submit', function(e) {
    var xVal = document.getElementById('x-input').value;
    if (!isValidX(xVal)) {
        e.preventDefault();
        pokazatOshibku('Выберите значение координаты X!');
        return;
    }

    var yVal = document.getElementById('y-input').value;
    if (!isValidY(yVal)) {
        e.preventDefault();
        pokazatOshibku('Введите Y строго в интервале (-5 ... 3)!');
        return;
    }

    var rVal = document.getElementById('r-select').value;
    if (!isValidR(rVal)) {
        e.preventDefault();
        pokazatOshibku('Выберите значение R из предложенного списка!');
        return;
    }
});

// очищаем таблицу и просим контроллер дропнуть историю в сессии
document.getElementById('clear-btn').addEventListener('click', async function() {
    var endpoint = getEndpoint();
    try {
        await fetch(endpoint + '?action=clear&ajax=true', {
            method: 'GET',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
    } catch(err) {
        console.warn('Не удалось очистить историю на сервере:', err);
    }

    document.getElementById('results-body').innerHTML = '';
    historyOfTochki = [];
    var rVal = document.getElementById('r-select').value;
    narisovatGrafik(rVal);
});

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
validForm();
narisovatGrafik(document.getElementById('r-select').value);
