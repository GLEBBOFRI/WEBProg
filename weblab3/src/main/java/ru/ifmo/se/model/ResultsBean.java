package ru.ifmo.se.model;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/*
 * сессионная бинка для хранения истории вычислений студента
 */
public class ResultsBean implements Serializable {
    private static final long serialVersionUID = 1L;

    // синхронизированный список, чтоб несколько запросов не уронили коллекцию
    private List<PointResult> results;

    // дефолтный конструктор без аргументов по канону javabeans
    public ResultsBean() {
        this.results = Collections.synchronizedList(new ArrayList<>());
    }

    public List<PointResult> getResults() {
        return results;
    }

    public void setResults(List<PointResult> results) {
        this.results = results != null ? Collections.synchronizedList(results) : Collections.synchronizedList(new ArrayList<>());
    }

    // закидываем новую точку в историю проверок
    public void addResult(PointResult result) {
        if (result != null) {
            results.add(result);
        }
    }

    // сносим все точки если нажали кнопку очистки
    public void clear() {
        results.clear();
    }

    // общее количество сохраненных проверок
    public int getCount() {
        return results.size();
    }

    // проверка пустая ли история
    public boolean isEmpty() {
        return results.isEmpty();
    }
}
