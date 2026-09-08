const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');

function narisovatGrafik() {
    ctx.clearRect(0, 0, 300, 300);

    ctx.fillStyle = '#3399ff';

    ctx.fillRect(50, 50, 100, 100);

    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.arc(150, 150, 50, -Math.PI / 2, 0, false);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.lineTo(100, 150);
    ctx.lineTo(150, 250);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    ctx.moveTo(0, 150); ctx.lineTo(300, 150);
    ctx.moveTo(150, 0); ctx.lineTo(150, 300);

    ctx.moveTo(290, 145); ctx.lineTo(300, 150); ctx.lineTo(290, 155);
    ctx.moveTo(145, 10);  ctx.lineTo(150, 0);   ctx.lineTo(155, 10);

    ctx.moveTo(200, 145); ctx.lineTo(200, 155);
    ctx.moveTo(250, 145); ctx.lineTo(250, 155);
    ctx.moveTo(100, 145); ctx.lineTo(100, 155);
    ctx.moveTo(50, 145);  ctx.lineTo(50, 155);

    ctx.moveTo(145, 100); ctx.lineTo(155, 100);
    ctx.moveTo(145, 50);  ctx.lineTo(155, 50);
    ctx.moveTo(145, 200); ctx.lineTo(155, 200);
    ctx.moveTo(145, 250); ctx.lineTo(155, 250);

    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = '12px monospace';
    ctx.fillText('x', 285, 140);
    ctx.fillText('y', 160, 15);

    ctx.fillText('R/2', 190, 140);
    ctx.fillText('R', 245, 140);
    ctx.fillText('-R/2', 85, 140);
    ctx.fillText('-R', 35, 140);

    ctx.fillText('R/2', 160, 105);
    ctx.fillText('R', 160, 55);
    ctx.fillText('-R/2', 160, 205);
    ctx.fillText('-R', 160, 255);
}

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

function vstavkaVTablicu(x, y, r, Popadal, vremyaStr) {
    const tbody = document.getElementById('results-body');
    const tr = document.createElement('tr');

    const dt = new Date(vremyaStr).toLocaleString('ru-RU');
    const resText = Popadal ? 'Попал' : 'Мимо';

    tr.innerHTML = '<td>' + x + '</td>' +
        '<td>' + y + '</td>' +
        '<td>' + r + '</td>' +
        '<td>' + resText + '</td>' +
        '<td>' + dt + '</td>';

    tbody.appendChild(tr);
}

function sohranitVStorage(zapis) {
    let massiv = JSON.parse(localStorage.getItem('lab1_history')) || [];
    massiv.push(zapis);
    localStorage.setItem('lab1_history', JSON.stringify(massiv));
}

function zagruzitIzStorage() {
    let staryeDannye = JSON.parse(localStorage.getItem('lab1_history')) || [];
    for (let i = 0; i < staryeDannye.length; i++) {
        let elem = staryeDannye[i];
        vstavkaVTablicu(elem.x, elem.y, elem.r, elem.hit, elem.time);
    }
}

function obrabotkaTochki(x, y, r) {
    let isHit = proverkaPopadaniya(x, y, r);
    let nowTime = new Date().toISOString();

    let obj = { x: x, y: y, r: r, hit: isHit, time: nowTime };

    vstavkaVTablicu(x, y, r, isHit, nowTime);
    sohranitVStorage(obj);
}

document.getElementById('point-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const xVybory = document.querySelectorAll('input[name="x"]:checked');
    if (xVybory.length === 0) {
        alert('Выбери хотя бы один X, если хочешь 0 специально ведь кнопку добавил');
        return;
    }

    const yVal = document.getElementById('y-input').value.trim();
    const yNum = parseFloat(yVal);

    if (yVal === '' || isNaN(yNum) || yNum < -5 || yNum > 3) {
        alert('Специально 2 раза ограничения написал... Введи ты Y в диапазоне от -5 до 3');
        return;
    }

    const rVal = document.getElementById('r-input').value.trim();
    const rNum = parseFloat(rVal);

    if (rVal === '' || isNaN(rNum) || rNum < 1 || rNum > 4) {
        alert('Специально 2 раза ограничения написал... Введи ты R в диапазоне от 1 до 4');
        return;
    }

    xVybory.forEach(function (chk) {
        let xNum = parseFloat(chk.value);
        obrabotkaTochki(xNum, yNum, rNum);
    });
});

document.getElementById('clear-btn').addEventListener('click', function () {
    localStorage.removeItem('lab1_history');
    document.getElementById('results-body').innerHTML = '';
});

narisovatGrafik();
zagruzitIzStorage();