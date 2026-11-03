package ru.ifmo.se.model;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * JavaBean для хранения истории результатов проверок в сессии пользователя.
 */
public class ResultsBean implements Serializable {
    private static final long serialVersionUID = 1L;

    private List<PointResult> results;

    public ResultsBean() {
        this.results = Collections.synchronizedList(new ArrayList<>());
    }

    public List<PointResult> getResults() {
        return results;
    }

    public void setResults(List<PointResult> results) {
        this.results = results != null ? Collections.synchronizedList(results) : Collections.synchronizedList(new ArrayList<>());
    }

    public void addResult(PointResult result) {
        if (result != null) {
            results.add(result);
        }
    }

    public void clear() {
        results.clear();
    }

    public int getCount() {
        return results.size();
    }

    public boolean isEmpty() {
        return results.isEmpty();
    }
}
