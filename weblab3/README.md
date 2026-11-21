# Лабораторная работа №3 по Веб-программированию
**Студент:** Вохрамеев Глеб Дмитриевич | **Группа:** P3218 | **Вариант:** 45218 | **ИСУ:** s465457

---

## 1. Структура проекта

```text
weblab3/
├── src/main/
│   ├── java/ru/ifmo/se/
│   │   ├── model/
│   │   │   ├── PointResult.java    # JavaBean результата проверки точки
│   │   │   └── ResultsBean.java    # Сессионный бин истории точек
│   │   └── servlets/
│   │       ├── ControllerServlet.java # MVC контроллер (диспетчер запросов)
│   │       └── AreaCheckServlet.java  # Сервлет валидации и проверки попадания
│   └── webapp/
│       ├── css/styles.css          # Стили оформления, пасхалки FNAF и GTA Wasted
│       ├── js/main.js              # Валидация, канвас, Web Audio API пасхалки
│       ├── WEB-INF/web.xml         # Дескриптор развертывания сервлетов
│       ├── index.jsp               # Главная страница ввода координат
│       └── result.jsp              # Страница отображения результата AreaCheckServlet
├── pom.xml                         # Конфигурация сборки Maven (WildFly WAR)
├── deploy-helios.sh                # Автоматический деплой на Helios
└── README.md                       # Описание лабораторной работы
```

---

## 2. Параметры варианта 45218

- **Изменение X:** Кнопки (Button) `{-4, -3, -2, -1, 0, 1, 2, 3, 4}`
- **Изменение Y:** Текстовое поле (Text) `(-3 ... 3)` (строгий интервал: `-3 < Y < 3`)
- **Изменение R:** Выпадающий список (Select) `{1, 1.5, 2, 2.5, 3}`
- **Метод отправки:** HTTP GET (параметры передаются через Query String: `?x=...&y=...&r=...&fromCanvas=...`)
- **Формат ответа сервера:** JSON (`valid`, `x`, `y`, `r`, `hit`, `executionTime`, `currentTime`)

### Геометрическая область попадания точки:
1. **1-я четверть ($x \ge 0, y \ge 0$):** Прямоугольник шириной $R$ и высотой $R/2$:
   $$0 \le x \le R \quad \text{и} \quad 0 \le y \le \frac{R}{2}$$
2. **2-я четверть ($x \le 0, y \ge 0$):** Прямоугольный треугольник с вершинами $(0, 0), (-R, 0), (0, R/2)$:
   $$-R \le x \le 0 \quad \text{и} \quad 0 \le y \le \frac{1}{2}x + \frac{R}{2}$$
3. **3-я четверть ($x \le 0, y \le 0$):** Пусто (точки не попадают)
4. **4-я четверть ($x \ge 0, y \le 0$):** Четверть круга радиуса $R/2$:
   $$x \ge 0, \quad y \le 0 \quad \text{и} \quad x^2 + y^2 \le \left(\frac{R}{2}\right)^2$$

---

## 3. Сборка и запуск FastCGI сервера локально

```bash
cd server
./build.sh
./run.sh 24001
```
*Сервер запустится в гибридном режиме: FastCGI на порту 24001 + локальный HTTP-сервер на http://localhost:24000/.*

---

## 4. Автоматическое развертывание на сервере Helios

### Шаг 1: Запуск скрипта развертывания
В корне проекта выполните:
```bash
./deploy-helios.sh s465457 2222
```
Скрипт автоматически:
1. Проверит и соберет `server/server.jar`.
2. Создаст каталоги `~/public_html`, `~/httpd-root/static`, `~/httpd-root/fcgi-bin`, `~/httpd-root/mutex-dir` и выставит права `711` и `755`.
3. Загрузит клиентскую статику (HTML, CSS, JS) строго в каталог веб-сервера `~/httpd-root/static/`, а в `~/public_html/` настроит редирект.
4. Загрузит `server.jar` в `~/httpd-root/fcgi-bin/` и `httpd.conf` в `~/httpd-root/`.

### Шаг 2: Запуск служб на Helios
Подключитесь к Helios по SSH:
```bash
ssh -p 2222 s465457@helios.cs.ifmo.ru
```
И выполните:
```bash
# 1. Запуск FastCGI сервера в фоновом режиме (NO_HTTP=true отключает встроенный HTTP-сервер, освобождая порт 24000 для Apache)
nohup java -DFCGI_PORT=24001 -DNO_HTTP=true -jar ~/httpd-root/fcgi-bin/server.jar > ~/httpd-root/server.log 2>&1 &

# 2. Запуск веб-сервера Apache httpd на порту 24000
httpd -f ~/httpd-root/httpd.conf -k start
```

### Шаг 3: Проброс SSH-туннеля (на вашем локальном компьютере)
В отдельном окне локального терминала запустите:
```bash
ssh -p 2222 -L 24000:localhost:24000 s465457@helios.cs.ifmo.ru -N
```

### Шаг 4: Открытие приложения
Откройте сайт в браузере:
- **Напрямую с веб-сервера Apache:** [http://localhost:24000/](http://localhost:24000/)

> **Проверка требования ЛР:** Страница отдается напрямую веб-сервером Apache (порт 24000). Если веб-сервер выключен (`httpd -f ~/httpd-root/httpd.conf -k stop`), то страница [http://localhost:24000/](http://localhost:24000/) **не загрузится**! При этом в коде сохранена локальная обработка на случай временного отсутствия ответа FastCGI.

---

## 5. Полезные команды на Helios

- Остановка Apache:
  ```bash
  httpd -f ~/httpd-root/httpd.conf -k stop
  ```
- Просмотр логов ошибок:
  ```bash
  tail -f ~/httpd-root/error.log
  ```
- Завершение всех процессов Java (FastCGI):
  ```bash
  killall java
  ```
