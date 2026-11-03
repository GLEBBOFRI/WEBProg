/**
 * Клиентский сценарий лабораторной работы №3 для развертывания в public_html (se.ifmo.ru/~s465457)
 * Реализует:
 *  - Интерактивный Canvas-график с новыми фигурами варианта:
 *      1. I четверть: прямоугольник R x R/2 (0 <= x <= R, 0 <= y <= R/2)
 *      2. II четверть: треугольник (-R/2, 0) -> (0, R) (y <= 2x + R, x >= -R/2)
 *      3. IV четверть: сектор круга радиуса R (x^2 + y^2 <= R^2)
 *  - Пунктирное ограничение допустимой зоны: X in [-4, 4], Y in (-5, 3);
 *  - Примагничивание курсора к допустимой области и проекции;
 *  - Одиночный выбор чекбоксов X;
 *  - Строгую валидацию полей формы;
 *  - Сохранение истории в localStorage и мгновенный отклик;
 *  - AJAX отправку на бэкенд с автоматическим фолбеком.
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

    // Загрузка истории из localStorage
    loadHistoryFromStorage();

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

        processPointCheck(clamped.x, clamped.y, rVal, true);
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

        // Строго (-5 ... 3)
        if (yVal <= -5.0 || yVal >= 3.0) {
            showToast('Координата Y должна быть строго в интервале (-5 ... 3)!', 'error');
            yInput.classList.add('input-error');
            return;
        }
        yInput.classList.remove('input-error');

        // Валидация R
        const rVal = parseFloat(rSelect.value);
        if (isNaN(rVal) || rVal <= 0) {
            showToast('Выберите корректный радиус R!', 'error');
            return;
        }

        processPointCheck(selectedX, yVal, rVal, false);
    });

    // 6. Очистка истории проверок
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            pointsHistory = [];
            localStorage.removeItem('weblab3_history');
            renderTable();
            redrawCanvas();
            showToast('История проверок успешно очищена!', 'success');
        });
    }

    // ================== ПРОВЕРКА ПОПАДАНИЯ В ОБЛАСТЬ ==================

    function checkHit(x, y, r) {
        // I четверть: прямоугольник со сторонами R и R/2
        if (x >= 0 && y >= 0) {
            return (x <= r) && (y <= r / 2.0);
        }
        // II четверть: треугольник (-R/2, 0) -> (0, R)
        if (x <= 0 && y >= 0) {
            return (x >= -r / 2.0) && (y <= 2.0 * x + r);
        }
        // III четверть: пусто
        if (x <= 0 && y <= 0) {
            return false;
        }
        // IV четверть: сектор круга радиуса R
        if (x >= 0 && y <= 0) {
            return (x * x + y * y <= r * r);
        }
        return false;
    }

    function processPointCheck(x, y, r, fromCanvas) {
        const startTime = performance.now();
        const hit = checkHit(x, y, r);
        const endTime = performance.now();
        const execTimeMs = (endTime - startTime).toFixed(3) + ' мс';

        const now = new Date();
        const timeStr = now.toLocaleDateString('ru-RU') + ' ' + now.toLocaleTimeString('ru-RU');

        const resultObj = {
            x: x,
            y: y,
            r: r,
            hit: hit,
            currentTime: timeStr,
            executionTime: execTimeMs,
            fromCanvas: fromCanvas
        };

        // Пытаемся также уведомить backend сервлет, если он запущен
        try {
            fetch('controller', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: new URLSearchParams({
                    x: x.toString(),
                    y: y.toString(),
                    r: r.toString(),
                    fromCanvas: Boolean(fromCanvas).toString(),
                    ajax: 'true'
                })
            }).catch(() => {});
        } catch (_) {}

        // Добавляем в историю
        pointsHistory.unshift(resultObj);
        saveHistoryToStorage();
        renderTable();
        redrawCanvas();

        if (hit) {
            showToast(`✓ Точка (${x.toFixed(2)}, ${y.toFixed(2)}) ПОПАЛА в область (R=${r})!`, 'success');
        } else {
            showToast(`✗ Точка (${x.toFixed(2)}, ${y.toFixed(2)}) ПРОМАХНУЛАСЬ мимо области (R=${r})!`, 'info');
        }
    }

    // ================== РАБОТА С ИСТОРИЕЙ И ТАБЛИЦЕЙ ==================

    function loadHistoryFromStorage() {
        try {
            const saved = localStorage.getItem('weblab3_history');
            if (saved) {
                pointsHistory = JSON.parse(saved);
            }
        } catch (e) {
            pointsHistory = [];
        }
        renderTable();
        redrawCanvas();
    }

    function saveHistoryToStorage() {
        try {
            localStorage.setItem('weblab3_history', JSON.stringify(pointsHistory));
        } catch (e) {}
    }

    function renderTable() {
        const tbody = document.getElementById('results-tbody');
        const counter = document.getElementById('history-counter');
        if (!tbody) return;

        if (counter) {
            counter.textContent = `Всего записей: ${pointsHistory.length}`;
        }

        if (pointsHistory.length === 0) {
            tbody.innerHTML = '<tr id="empty-row"><td colspan="6" class="empty-table-msg">История проверок пуста. Отправьте форму или кликните по графику!</td></tr>';
            return;
        }

        let html = '';
        pointsHistory.forEach(item => {
            const badgeClass = item.hit ? 'badge-hit' : 'badge-miss';
            const badgeText = item.hit ? 'Попадание' : 'Промах';
            html += `<tr>
                <td><strong>${Number(item.x).toFixed(3)}</strong></td>
                <td><strong>${Number(item.y).toFixed(3)}</strong></td>
                <td>${item.r}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td>${item.currentTime}</td>
                <td>${item.executionTime}</td>
            </tr>`;
        });
        tbody.innerHTML = html;
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

    // ================== ОТРИСОВКА CANVAS ГРАФИКА ==================

    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const rVal = parseFloat(rSelect.value);
        const hasValidR = !isNaN(rVal) && rVal > 0;
        const currentR = hasValidR ? rVal : 2;

        // 1. Область попадания (синий цвет #38bdf8 / #0284c7)
        if (hasValidR) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.5;

            // I четверть: прямоугольник R x R/2
            ctx.beginPath();
            const rPxWidth = currentR * SCALE;
            const rHalfPxHeight = (currentR / 2.0) * SCALE;
            ctx.rect(CENTER_X, CENTER_Y - rHalfPxHeight, rPxWidth, rHalfPxHeight);
            ctx.fill();
            ctx.stroke();

            // II четверть: треугольник (-R/2, 0) -> (0, R)
            ctx.beginPath();
            ctx.moveTo(CENTER_X, CENTER_Y);
            ctx.lineTo(CENTER_X - (currentR / 2.0) * SCALE, CENTER_Y);
            ctx.lineTo(CENTER_X, CENTER_Y - currentR * SCALE);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // IV четверть: четверть круга радиуса R
            ctx.beginPath();
            ctx.moveTo(CENTER_X, CENTER_Y);
            ctx.arc(CENTER_X, CENTER_Y, currentR * SCALE, 0, Math.PI / 2, false);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // 2. Рамка допустимой зоны (пунктир красным): X in [-4, 4], Y in (-5, 3)
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
        ctx.lineWidth = 1.5;

        const boundLeft = CENTER_X + (-4) * SCALE;
        const boundRight = CENTER_X + 4 * SCALE;
        const boundTop = CENTER_Y - 3 * SCALE;
        const boundBottom = CENTER_Y - (-5) * SCALE;

        ctx.strokeRect(boundLeft, boundTop, boundRight - boundLeft, boundBottom - boundTop);
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
        ctx.arc(targetPx.x, targetPx.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Плашка с координатами
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        const text = `(${clamped.x.toFixed(2)}, ${clamped.y.toFixed(2)})`;
        ctx.font = '11px sans-serif';
        const textWidth = ctx.measureText(text).width;
        let tooltipX = targetPx.x + 8;
        let tooltipY = targetPx.y - 8;

        if (tooltipX + textWidth + 10 > canvas.width) {
            tooltipX = targetPx.x - textWidth - 14;
        }
        if (tooltipY - 14 < 0) {
            tooltipY = targetPx.y + 18;
        }

        ctx.fillRect(tooltipX - 4, tooltipY - 12, textWidth + 8, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, tooltipX, tooltipY);
    }

    // ================== УВЕДОМЛЕНИЯ (TOASTS) ==================

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (toast.parentNode === container) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3200);
    }
});
