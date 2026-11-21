package ru.ifmo.se.model;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/*
 * сессионный бин с историей точек
 * почему обычный arraylist или голый synchronizedList тут не катят:
 * 1) в вебе юзер может накликать кучу запросов параллельно (сессия одна, а потоков несколько).
 * 2) Collections.synchronizedList синхронит только единичные методы (типа add), но при итерации
 *    (например, когда jstl крутит c:forEach) блокировка не держится! если в этот момент прилетит add(),
 *    вылетит ConcurrentModificationException прямо на странице.
 * 3) решение: используем потокобезопасный CopyOnWriteArrayList + явные synchronized методы
 *    для атомарных операций и безопасной отдачи неизменяемого снапшота.
 */
public class ResultsBean implements Serializable {
    private static final long serialVersionUID = 1L;

    // потокобезопасный список: итераторы не падают с concurrent modification exception при переборе в jstl
    private final List<PointResult> results;

    public ResultsBean() {
        this.results = new CopyOnWriteArrayList<>();
    }

    // явно синхронизируем добавление точки: добавляем в самое начало (индекс 0), чтоб свежие проверки были сверху
    public synchronized void addResult(PointResult result) {
        if (result != null) {
            results.add(0, result);
        }
    }

    // отдаем список точек: снапшот для c:forEach безопасен для многопоточного чтения
    public synchronized List<PointResult> getResults() {
        return Collections.unmodifiableList(new ArrayList<>(results));
    }

    // явная синхронизация при очистке списка точек
    public synchronized void clear() {
        results.clear();
    }

    // количество сохраненных точек
    public synchronized int getCount() {
        return results.size();
    }

    // проверка пустая ли история
    public synchronized boolean isEmpty() {
        return results.isEmpty();
    }
}
