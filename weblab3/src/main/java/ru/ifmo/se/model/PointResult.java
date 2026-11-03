package ru.ifmo.se.model;

import java.io.Serializable;
import java.util.Objects;

/**
 * Модель данных одного результата проверки точки на попадание в область.
 */
public class PointResult implements Serializable {
    private static final long serialVersionUID = 1L;

    private double x;
    private double y;
    private double r;
    private boolean hit;
    private String currentTime;
    private String executionTime;
    private boolean fromCanvas;

    public PointResult() {
    }

    public PointResult(double x, double y, double r, boolean hit, String currentTime, String executionTime, boolean fromCanvas) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.hit = hit;
        this.currentTime = currentTime;
        this.executionTime = executionTime;
        this.fromCanvas = fromCanvas;
    }

    public double getX() {
        return x;
    }

    public void setX(double x) {
        this.x = x;
    }

    public double getY() {
        return y;
    }

    public void setY(double y) {
        this.y = y;
    }

    public double getR() {
        return r;
    }

    public void setR(double r) {
        this.r = r;
    }

    public boolean isHit() {
        return hit;
    }

    public void setHit(boolean hit) {
        this.hit = hit;
    }

    public String getCurrentTime() {
        return currentTime;
    }

    public void setCurrentTime(String currentTime) {
        this.currentTime = currentTime;
    }

    public String getExecutionTime() {
        return executionTime;
    }

    public void setExecutionTime(String executionTime) {
        this.executionTime = executionTime;
    }

    public boolean isFromCanvas() {
        return fromCanvas;
    }

    public void setFromCanvas(boolean fromCanvas) {
        this.fromCanvas = fromCanvas;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PointResult that = (PointResult) o;
        return Double.compare(that.x, x) == 0 &&
                Double.compare(that.y, y) == 0 &&
                Double.compare(that.r, r) == 0 &&
                hit == that.hit &&
                fromCanvas == that.fromCanvas &&
                Objects.equals(currentTime, that.currentTime);
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y, r, hit, currentTime, fromCanvas);
    }

    @Override
    public String toString() {
        return "PointResult{" +
                "x=" + x +
                ", y=" + y +
                ", r=" + r +
                ", hit=" + hit +
                ", currentTime='" + currentTime + '\'' +
                ", executionTime='" + executionTime + '\'' +
                ", fromCanvas=" + fromCanvas +
                '}';
    }
}
