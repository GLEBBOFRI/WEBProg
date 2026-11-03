/**
 * Клиентский сценарий лабораторной работы №3.
 * Реализует:
 *  - Интерактивный Canvas-график с новыми фигурами (вариант 3 лабы);
 *  - Пунктирное ограничение допустимой зоны: X in [-4, 4], Y in (-5, 3);
 *  - Примагничивание курсора к допустимой области;
 *  - Одиночный выбор чекбоксов X;
 *  - Строгую валидацию полей формы;
 *  - AJAX POST взаимодействие с ControllerServlet;
 *  - Динамическое обновление таблицы и точек на графике.
 */

document.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('graph-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const CENTER_X = canvas.width / 2; // 180
    const CENTER_Y = canvas.height / 2; // 180
    const SCALE = 28; // 1 единица = 28 пикселей

    let mouseX = null;
    let mouseY = null;
    let pointsHistory = [];

    // Инициализация точек из таблицы (если страница загружена с уже имеющейся историей из Bean)
    initHistoryFromTable();

    // 1. Поведение чекбоксов X: одиночный выбор (radio-like)
    const xCheckboxes = document.querySelectorAll('input[type="checkbox"][name="x"]');
    xCheckboxes.forEach(cb => {
        cb.addEventListener('change', function () {
            if (this.checked) {
                xCheckboxes.forEach(other => {
                    if (other !== this) other.checked = false;
                });
            }
        });
    });

    // 2. Обработка изменения R: перерисовка графика
    const rSelect = document.getElementById('r-select');
    rSelect.addEventListener('change', function () {
        redrawCanvas();
    });

    // 3. Обработка движения мыши по Canvas (примагничивание и прицел)
    canvas.addEventListener('mousemove', function (e) {
        const pos = getCanvasRelativeCoords(canvas, e);
        mouseX = pos.x;
        mouseY = pos.y;
        redrawCanvas();
    });

    canvas.addEventListener('mouseleave', function () {
        mouseX = null;
        mouseY = null;
        redrawCanvas();
    });

    // 4. Клик по Canvas
    canvas.addEventListener('click', function (e) {
        const rVal = parseFloat(rSelect.value);
        if (isNaN(rVal) || rVal <= 0) {
            showToast('Невозможно определить координаты: сначала выберите радиус R!', 'error');
            return;
        }

        const pos = getCanvasRelativeCoords(canvas, e);
        const rawCoords = pxToMath(pos.x, pos.y);
        const clamped = clampCoords(rawCoords.x, rawCoords.y);

        sendPointRequest(clamped.x, clamped.y, rVal, true);
    });

    // 5. Отправка формы через AJAX
    const form = document.getElementById('point-form');
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Валидация X
        const selectedX = getSelectedX();
        if (selectedX === null) {
            showToast('Выберите одно значение для координаты X!', 'error');
            return;
        }

        // Валидация Y
        const yInput = document.getElementById('y-input');
        const yStr = yInput.value.trim().replace(',', '.');
        if (yStr === '') {
            showToast('Введите значение координаты Y!', 'error');
            yInput.classList.add('input-error');
            return;
        }

        const yVal = parseFloat(yStr);
        if (isNaN(yVal)) {
            showToast('Координата Y должна быть числом!', 'error');
            yInput.classList.add('input-error');
            return;
        }

        // Строгое неравенство: (-5 ... 3) не включая границы!
        if (yVal <= -5.0 || yVal >= 3.0) {
            showToast('Координата Y должна быть строго в интервале (-5 ... 3)!', 'error');
            yInput.classList.add('input-error');
            return;
        }
        yInput.classList.remove('input-error');

        // Валидация R
        const rVal = parseFloat(rSelect.value);
        if (isNaN(rVal) || ![1, 2, 3, 4, 5].includes(rVal)) {
            showToast('Выберите корректный радиус R из списка!', 'error');
            return;
        }

        sendPointRequest(selectedX, yVal, rVal, false);
    });

    // 6. Очистка истории через AJAX
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            if (!confirm('Вы уверены, что хотите очистить всю историю проверок?')) return;

            const contextPath = form.getAttribute('action') || 'controller';
            fetch(contextPath, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: 'clear=true&ajax=true'
            })
            .then(res => res.json())
            .then(data => {
                if (data.cleared) {
                    pointsHistory = [];
                    const tbody = document.getElementById('results-tbody');
                    if (tbody) {
                        tbody.innerHTML = '<tr><td colspan="7" class="empty-table-msg">История проверок пуста.</td></tr>';
                    }
                    redrawCanvas();
                    showToast('История проверок успешно очищена!', 'success');
                }
            })
            .catch(err => {
                console.error('Ошибка при очистке:', err);
                showToast('Ошибка при связи с сервером.', 'error');
            });
        });
    }

    // ================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==================

    function getSelectedX() {
        const checked = Array.from(xCheckboxes).filter(cb => cb.checked);
        if (checked.length !== 1) return null;
        return parseFloat(checked[0].value);
    }

    function pxToMath(pxX, pxY) {
        return {
            x: (pxX - CENTER_X) / SCALE,
            y: (CENTER_Y - pxY) / SCALE
        };
    }

    function mathToPx(x, y) {
        return {
            x: CENTER_X + x * SCALE,
            y: CENTER_Y - y * SCALE
        };
    }

    // Примагничивание к границам зоны: X in [-4, 4], Y in (-5, 3)
    function clampCoords(x, y) {
        const minX = -4.0;
        const maxX = 4.0;
        // Не включая -5 и 3 -> берем ближайшие валидные значения с шагом 0.001
        const minY = -4.999;
        const maxY = 2.999;

        const clampedX = Math.max(minX, Math.min(maxX, x));
        const clampedY = Math.max(minY, Math.min(maxY, y));

        return {
            x: Math.round(clampedX * 1000) / 1000,
            y: Math.round(clampedY * 1000) / 1000
        };
    }

    function getCanvasRelativeCoords(cvs, evt) {
        const rect = cvs.getBoundingClientRect();
        const scaleX = cvs.width / rect.width;
        const scaleY = cvs.height / rect.height;
        return {
            x: (evt.clientX - rect.left) * scaleX,
            y: (evt.clientY - rect.top) * scaleY
        };
    }

    // Отправка запроса на ControllerServlet
    function sendPointRequest(x, y, r, fromCanvas) {
        const contextPath = form.getAttribute('action') || 'controller';
        const payload = new URLSearchParams({
            x: x.toString(),
            y: y.toString(),
            r: r.toString(),
            fromCanvas: Boolean(fromCanvas).toString(),
            ajax: 'true'
        });

        fetch(contextPath, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: payload.toString()
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok || !data.valid) {
                throw new Error(data.error || 'Ошибка проверки на сервере!');
            }
            return data;
        })
        .then(data => {
            // Добавляем точку в историю
            const newPoint = {
                x: data.x,
                y: data.y,
                r: data.r,
                hit: data.hit,
                currentTime: data.currentTime,
                executionTime: data.executionTime
            };
            pointsHistory.unshift(newPoint);

            // Добавляем строку в таблицу
            addTableRow(newPoint);

            // Перерисовываем Canvas
            redrawCanvas();

            showToast(data.hit ? 'Попадание в область!' : 'Промах!', data.hit ? 'success' : 'error');
        })
        .catch(err => {
            console.error('Ошибка отправки:', err);
            showToast(err.message || 'Ошибка соединения с сервером!', 'error');
        });
    }

    function addTableRow(pt) {
        const tbody = document.getElementById('results-tbody');
        if (!tbody) return;

        // Если в таблице заглушка об отсутствии записей - удаляем её
        const emptyMsg = tbody.querySelector('.empty-table-msg');
        if (emptyMsg) {
            tbody.innerHTML = '';
        }

        const tr = document.createElement('tr');
        const badgeClass = pt.hit ? 'badge-hit' : 'badge-miss';
        const hitText = pt.hit ? 'Попадание' : 'Промах';

        tr.innerHTML = `
            <td><strong>${pt.x.toFixed(3)}</strong></td>
            <td><strong>${pt.y.toFixed(3)}</strong></td>
            <td>${pt.r}</td>
            <td><span class="badge ${badgeClass}">${hitText}</span></td>
            <td>${pt.currentTime}</td>
            <td>${pt.executionTime}</td>
        `;

        tbody.insertBefore(tr, tbody.firstChild);
    }

    function initHistoryFromTable() {
        const rows = document.querySelectorAll('#results-tbody tr');
        rows.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 6) {
                const x = parseFloat(tds[0].textContent);
                const y = parseFloat(tds[1].textContent);
                const r = parseFloat(tds[2].textContent);
                const hit = tds[3].textContent.includes('Попадание');
                const time = tds[4].textContent;
                const execTime = tds[5].textContent;

                if (!isNaN(x) && !isNaN(y) && !isNaN(r)) {
                    pointsHistory.push({ x, y, r, hit, currentTime: time, executionTime: execTime });
                }
            }
        });
        redrawCanvas();
    }

    // ================== ОТРИСОВКА ГРАФИКА ==================
    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const rVal = parseFloat(rSelect.value);
        const hasValidR = !isNaN(rVal) && rVal > 0;
        const currentR = hasValidR ? rVal : 2; // По умолчанию R=2 для масштабирования осей

        // 1. Отрисовка синей целевой области варианта
        if (hasValidR) {
            ctx.fillStyle = '#3b82f6';

            // 1-я четверть: прямоугольник [0, R] x [0, R/2]
            const rPx = currentR * SCALE;
            const halfRPx = (currentR / 2) * SCALE;
            ctx.fillRect(CENTER_X, CENTER_Y - halfRPx, rPx, halfRPx);

            // 2-я четверть: треугольник от (-R/2, 0) до (0, R)
            ctx.beginPath();
            ctx.moveTo(CENTER_X, CENTER_Y);
            ctx.lineTo(CENTER_X - halfRPx, CENTER_Y);
            ctx.lineTo(CENTER_X, CENTER_Y - rPx);
            ctx.closePath();
            ctx.fill();

            // 4-я четверть: четверть круга радиуса R от (R, 0) до (0, -R)
            ctx.beginPath();
            ctx.moveTo(CENTER_X, CENTER_Y);
            ctx.arc(CENTER_X, CENTER_Y, rPx, 0, Math.PI / 2, false);
            ctx.closePath();
            ctx.fill();
        }

        // 2. Ограничение допустимой зоны пунктиром: X in [-4, 4], Y in (-5, 3)
        // Верхний левый угол зоны: (-4, 3) -> px = CENTER_X - 4*SCALE, py = CENTER_Y - 3*SCALE
        const zoneTopLeft = mathToPx(-4, 3);
        const zoneWidth = 8 * SCALE; // от -4 до 4 = 8
        const zoneHeight = 8 * SCALE; // от 3 до -5 = 8

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(zoneTopLeft.x, zoneTopLeft.y, zoneWidth, zoneHeight);
        ctx.restore();

        // 3. Оси координат и стрелки
        ctx.beginPath();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;

        // Ось X
        ctx.moveTo(10, CENTER_Y);
        ctx.lineTo(canvas.width - 10, CENTER_Y);
        // Стрелка X
        ctx.moveTo(canvas.width - 20, CENTER_Y - 5);
        ctx.lineTo(canvas.width - 10, CENTER_Y);
        ctx.lineTo(canvas.width - 20, CENTER_Y + 5);

        // Ось Y
        ctx.moveTo(CENTER_X, canvas.height - 10);
        ctx.lineTo(CENTER_X, 10);
        // Стрелка Y
        ctx.moveTo(CENTER_X - 5, 20);
        ctx.lineTo(CENTER_X, 10);
        ctx.lineTo(CENTER_X + 5, 20);
        ctx.stroke();

        // 4. Засечки и подписи меток осей
        const ticks = [
            { x: -currentR, label: hasValidR ? (-currentR).toString() : '-R', axis: 'x' },
            { x: -currentR / 2, label: hasValidR ? (-currentR / 2).toString() : '-R/2', axis: 'x' },
            { x: currentR / 2, label: hasValidR ? (currentR / 2).toString() : 'R/2', axis: 'x' },
            { x: currentR, label: hasValidR ? currentR.toString() : 'R', axis: 'x' },

            { y: currentR, label: hasValidR ? currentR.toString() : 'R', axis: 'y' },
            { y: currentR / 2, label: hasValidR ? (currentR / 2).toString() : 'R/2', axis: 'y' },
            { y: -currentR / 2, label: hasValidR ? (-currentR / 2).toString() : '-R/2', axis: 'y' },
            { y: -currentR, label: hasValidR ? (-currentR).toString() : '-R', axis: 'y' }
        ];

        ctx.beginPath();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = '#0f172a';
        ctx.font = '11px monospace';

        ticks.forEach(t => {
            if (t.axis === 'x') {
                const pt = mathToPx(t.x, 0);
                if (pt.x >= 15 && pt.x <= canvas.width - 15) {
                    ctx.moveTo(pt.x, CENTER_Y - 4);
                    ctx.lineTo(pt.x, CENTER_Y + 4);
                    ctx.fillText(t.label, pt.x - 8, CENTER_Y + 18);
                }
            } else {
                const pt = mathToPx(0, t.y);
                if (pt.y >= 25 && pt.y <= canvas.height - 15) {
                    ctx.moveTo(CENTER_X - 4, pt.y);
                    ctx.lineTo(CENTER_X + 4, pt.y);
                    ctx.fillText(t.label, CENTER_X + 10, pt.y + 4);
                }
            }
        });
        ctx.stroke();

        ctx.fillText('x', canvas.width - 18, CENTER_Y - 10);
        ctx.fillText('y', CENTER_X + 10, 20);

        // 5. Отрисовка всех точек из истории
        pointsHistory.forEach(pt => {
            const p = mathToPx(pt.x, pt.y);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = pt.hit ? '#10b981' : '#ef4444';
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // 6. Отрисовка прицела мыши с примагничиванием
        if (mouseX !== null && mouseY !== null && hasValidR) {
            drawCursorCrosshair(mouseX, mouseY);
        }
    }

    function drawCursorCrosshair(rawPxX, rawPxY) {
        const mathCoords = pxToMath(rawPxX, rawPxY);
        const clamped = clampCoords(mathCoords.x, mathCoords.y);
        const targetPx = mathToPx(clamped.x, clamped.y);

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1;

        // Проекции на оси
        ctx.moveTo(targetPx.x, CENTER_Y);
        ctx.lineTo(targetPx.x, targetPx.y);
        ctx.lineTo(CENTER_X, targetPx.y);
        ctx.stroke();
        ctx.restore();

        // Точка прицела
        ctx.beginPath();
        ctx.arc(targetPx.x, targetPx.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        // Подпись координат прицела
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`(${clamped.x.toFixed(2)}, ${clamped.y.toFixed(2)})`, targetPx.x + 8, targetPx.y - 8);
    }

    // Всплывающие уведомления
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 3000);
    }
});
