package ru.ifmo.se.model;

import lombok.Data;

import java.io.Serializable;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicLong;

/*
 * бинка статистики запросов приложения: живет в ServletContext (application scope), потокобезопасна на AtomicLong
 */
@Data
public class RequestStats implements Serializable {
    private static final long serialVersionUID = 1L;

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss").withZone(ZoneId.of("Europe/Moscow"));

    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong getRequests = new AtomicLong(0);
    private final AtomicLong postRequests = new AtomicLong(0);
    private final AtomicLong pointChecks = new AtomicLong(0);
    private final AtomicLong hits = new AtomicLong(0);
    private final AtomicLong misses = new AtomicLong(0);

    private final Instant serverStartTime = Instant.now();
    private volatile String lastRequestTime = FORMATTER.format(Instant.now()) + " (МСК)";

    // инкрементим общий счетчик запросов
    public void recordRequest(String method) {
        totalRequests.incrementAndGet();
        if ("GET".equalsIgnoreCase(method)) {
            getRequests.incrementAndGet();
        } else if ("POST".equalsIgnoreCase(method)) {
            postRequests.incrementAndGet();
        }
        lastRequestTime = FORMATTER.format(Instant.now()) + " (МСК)";
    }

    // фиксируем проверку точки
    public void recordPointCheck(boolean isHit) {
        pointChecks.incrementAndGet();
        if (isHit) {
            hits.incrementAndGet();
        } else {
            misses.incrementAndGet();
        }
    }

    // красивый вывод аптайма сервера
    public String getUptime() {
        Duration d = Duration.between(serverStartTime, Instant.now());
        long hours = d.toHours();
        long minutes = d.toMinutesPart();
        long seconds = d.toSecondsPart();
        return String.format("%d ч %d мин %d сек", hours, minutes, seconds);
    }
}
