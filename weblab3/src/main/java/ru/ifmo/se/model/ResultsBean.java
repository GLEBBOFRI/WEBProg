package ru.ifmo.se.model;

import java.io.Serializable;
import java.util.Collections;
import java.util.LinkedList;
import java.util.List;

/**
 * Сессионный JavaBean компонент для хранения истории проверок точек.
 */
public class ResultsBean implements Serializable {
    private static final long serialVersionUID = 1L;

    private final List<PointResult> results = new LinkedList<>();

    public ResultsBean() {
    }

    public synchronized void addResult(PointResult result) {
        if (result != null) {
            results.add(0, result); // Добавляем в начало, чтобы последние результаты были сверху
        }
    }

    public synchronized List<PointResult> getResults() {
        return Collections.unmodifiableList(new LinkedList<>(results));
    }

    public synchronized void clear() {
        results.clear();
    }

    public synchronized int getCount() {
        return results.size();
    }

    public synchronized boolean isEmpty() {
        return results.isEmpty();
    }
}
