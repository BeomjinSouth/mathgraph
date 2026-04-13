/**
 * Geometry.js - 기하 연산 유틸리티
 */

import { MathUtils } from './MathUtils.js';

/**
 * 2D 벡터/점 클래스
 */
export class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    clone() {
        return new Vec2(this.x, this.y);
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    copy(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }

    add(v) {
        return new Vec2(this.x + v.x, this.y + v.y);
    }

    sub(v) {
        return new Vec2(this.x - v.x, this.y - v.y);
    }

    mul(s) {
        return new Vec2(this.x * s, this.y * s);
    }

    div(s) {
        return new Vec2(this.x / s, this.y / s);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    cross(v) {
        return this.x * v.y - this.y * v.x;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    lengthSq() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const len = this.length();
        if (MathUtils.isZero(len)) return new Vec2(0, 0);
        return this.div(len);
    }

    perpendicular() {
        return new Vec2(-this.y, this.x);
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vec2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    distanceTo(v) {
        return this.sub(v).length();
    }

    distanceToSq(v) {
        return this.sub(v).lengthSq();
    }

    lerp(v, t) {
        return new Vec2(
            MathUtils.lerp(this.x, v.x, t),
            MathUtils.lerp(this.y, v.y, t)
        );
    }

    equals(v) {
        return MathUtils.isEqual(this.x, v.x) && MathUtils.isEqual(this.y, v.y);
    }

    toString() {
        return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }

    toArray() {
        return [this.x, this.y];
    }

    static fromAngle(angle, length = 1) {
        return new Vec2(Math.cos(angle) * length, Math.sin(angle) * length);
    }

    static fromArray(arr) {
        return new Vec2(arr[0], arr[1]);
    }
}

/**
 * 기하 연산 유틸리티
 */
export const Geometry = {
    /**
     * 두 점 사이의 거리
     */
    distance(p1, p2) {
        return p1.distanceTo(p2);
    },

    /**
     * 두 점 사이의 중점
     */
    midpoint(p1, p2) {
        return p1.lerp(p2, 0.5);
    },

    /**
     * 점에서 직선까지의 거리
     * @param {Vec2} point - 점
     * @param {Vec2} lineP1 - 직선 위의 점 1
     * @param {Vec2} lineP2 - 직선 위의 점 2
     */
    pointToLineDistance(point, lineP1, lineP2) {
        const dir = lineP2.sub(lineP1);
        const len = dir.length();
        if (MathUtils.isZero(len)) return point.distanceTo(lineP1);

        const cross = dir.cross(point.sub(lineP1));
        return Math.abs(cross) / len;
    },

    /**
     * 점에서 선분까지의 최단 거리
     */
    pointToSegmentDistance(point, segP1, segP2) {
        const dir = segP2.sub(segP1);
        const lenSq = dir.lengthSq();

        if (MathUtils.isZero(lenSq)) {
            return point.distanceTo(segP1);
        }

        let t = point.sub(segP1).dot(dir) / lenSq;
        t = MathUtils.clamp(t, 0, 1);

        const projection = segP1.add(dir.mul(t));
        return point.distanceTo(projection);
    },

    /**
     * 점을 직선에 투영
     */
    projectPointOnLine(point, lineP1, lineP2) {
        const dir = lineP2.sub(lineP1);
        const lenSq = dir.lengthSq();

        if (MathUtils.isZero(lenSq)) return lineP1.clone();

        const t = point.sub(lineP1).dot(dir) / lenSq;
        return lineP1.add(dir.mul(t));
    },

    /**
     * 점을 선분에 투영 (t 파라미터 반환)
     */
    projectPointOnSegment(point, segP1, segP2) {
        const dir = segP2.sub(segP1);
        const lenSq = dir.lengthSq();

        if (MathUtils.isZero(lenSq)) return { t: 0, point: segP1.clone() };

        let t = point.sub(segP1).dot(dir) / lenSq;
        t = MathUtils.clamp(t, 0, 1);

        return {
            t,
            point: segP1.add(dir.mul(t))
        };
    },

    /**
     * 두 직선의 교점
     * @returns {Vec2|null} 교점 또는 null (평행)
     */
    lineLineIntersection(l1p1, l1p2, l2p1, l2p2) {
        const d1 = l1p2.sub(l1p1);
        const d2 = l2p2.sub(l2p1);
        const cross = d1.cross(d2);

        if (MathUtils.isZero(cross)) {
            return null; // 평행
        }

        const d = l2p1.sub(l1p1);
        const t = d.cross(d2) / cross;

        return l1p1.add(d1.mul(t));
    },

    /**
     * 두 선분의 교점
     * @returns {Vec2|null} 교점 또는 null
     */
    segmentSegmentIntersection(s1p1, s1p2, s2p1, s2p2) {
        const d1 = s1p2.sub(s1p1);
        const d2 = s2p2.sub(s2p1);
        const cross = d1.cross(d2);

        if (MathUtils.isZero(cross)) {
            return null; // 평행
        }

        const d = s2p1.sub(s1p1);
        const t1 = d.cross(d2) / cross;
        const t2 = d.cross(d1) / cross;

        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
            return s1p1.add(d1.mul(t1));
        }

        return null;
    },

    /**
     * 직선과 원의 교점
     * @returns {Vec2[]} 교점 배열 (0, 1 또는 2개)
     */
    lineCircleIntersection(lineP1, lineP2, center, radius) {
        const d = lineP2.sub(lineP1);
        const f = lineP1.sub(center);

        const a = d.dot(d);
        const b = 2 * f.dot(d);
        const c = f.dot(f) - radius * radius;

        const solutions = MathUtils.solveQuadratic(a, b, c);

        if (!solutions) return [];

        return solutions.map(t => lineP1.add(d.mul(t)));
    },

    /**
     * 선분과 원의 교점
     */
    segmentCircleIntersection(segP1, segP2, center, radius) {
        const d = segP2.sub(segP1);
        const f = segP1.sub(center);

        const a = d.dot(d);
        const b = 2 * f.dot(d);
        const c = f.dot(f) - radius * radius;

        const solutions = MathUtils.solveQuadratic(a, b, c);

        if (!solutions) return [];

        return solutions
            .filter(t => t >= 0 && t <= 1)
            .map(t => segP1.add(d.mul(t)));
    },

    /**
     * 두 원의 교점
     * @returns {Vec2[]} 교점 배열 (0, 1 또는 2개)
     */
    /**
     * 함수와 직선의 교점
     */
    functionLineIntersection(fn, lineP1, lineP2, options = {}) {
        const {
            lineType = 'line',
            domainMin = null,
            domainMax = null
        } = options;

        if (typeof fn !== 'function' || !lineP1 || !lineP2) {
            return [];
        }

        const d = lineP2.sub(lineP1);
        const dx = d.x;
        const dy = d.y;
        const intersections = [];

        const addCandidate = (point) => {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                return;
            }

            if (domainMin !== null && point.x < domainMin - MathUtils.EPSILON) {
                return;
            }

            if (domainMax !== null && point.x > domainMax + MathUtils.EPSILON) {
                return;
            }

            const isDuplicate = intersections.some(existing =>
                existing.distanceTo(point) <= 1e-7
            );

            if (!isDuplicate) {
                intersections.push(point);
            }
        };

        const evaluate = (x) => {
            let y;
            try {
                y = fn(x);
            } catch {
                return null;
            }

            return Number.isFinite(y) ? y : null;
        };

        if (Math.abs(dx) <= MathUtils.EPSILON) {
            const x = lineP1.x;
            const y = evaluate(x);
            if (y !== null) {
                addCandidate(new Vec2(x, y));
            }
            return intersections;
        }

        const lineY = (x) => lineP1.y + dy * ((x - lineP1.x) / dx);
        const difference = (x) => {
            const y = evaluate(x);
            if (y === null) {
                return null;
            }
            return y - lineY(x);
        };

        let minX;
        let maxX;

        if (lineType === 'segment') {
            minX = Math.min(lineP1.x, lineP2.x);
            maxX = Math.max(lineP1.x, lineP2.x);
        } else if (domainMin !== null && domainMax !== null) {
            minX = domainMin;
            maxX = domainMax;
        } else {
            const centerX = (lineP1.x + lineP2.x) / 2;
            const span = Math.max(Math.abs(dx), Math.abs(dy), 10) * 20;
            minX = centerX - span;
            maxX = centerX + span;
        }

        if (domainMin !== null) {
            minX = Math.max(minX, domainMin);
        }
        if (domainMax !== null) {
            maxX = Math.min(maxX, domainMax);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX > maxX) {
            return [];
        }

        const span = maxX - minX;
        const steps = Math.max(64, Math.min(1024, Math.ceil(Math.abs(span) * 32)));
        const epsilon = 1e-7;
        const samples = [];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = minX + span * t;
            const value = difference(x);

            if (value !== null) {
                samples.push({ x, value });
            }
        }

        const bisectRoot = (leftX, rightX, leftValue, rightValue) => {
            let a = leftX;
            let b = rightX;
            let fa = leftValue;
            let fb = rightValue;

            for (let i = 0; i < 64; i++) {
                const mid = (a + b) / 2;
                const fm = difference(mid);
                if (fm === null) {
                    break;
                }

                if (Math.abs(fm) <= epsilon || Math.abs(b - a) <= epsilon) {
                    return mid;
                }

                if (fa * fm <= 0) {
                    b = mid;
                    fb = fm;
                } else {
                    a = mid;
                    fa = fm;
                }

                if (Math.abs(fa) <= epsilon) {
                    return a;
                }
                if (Math.abs(fb) <= epsilon) {
                    return b;
                }
            }

            return (a + b) / 2;
        };

        for (let i = 0; i < samples.length; i++) {
            const current = samples[i];

            if (Math.abs(current.value) <= epsilon) {
                addCandidate(new Vec2(current.x, lineY(current.x)));
            }

            const next = samples[i + 1];
            if (!next) continue;

            if (current.value * next.value < 0) {
                const rootX = bisectRoot(current.x, next.x, current.value, next.value);
                const rootY = evaluate(rootX);
                if (rootY !== null) {
                    addCandidate(new Vec2(rootX, rootY));
                }
            }
        }

        intersections.sort((a, b) => {
            if (Math.abs(a.x - b.x) > 1e-9) {
                return a.x - b.x;
            }
            return a.y - b.y;
        });

        return intersections;
    },

    circleCircleIntersection(c1, r1, c2, r2) {
        const d = c2.sub(c1);
        const dist = d.length();

        // 원이 일치하거나 떨어져있음
        if (MathUtils.isZero(dist) || dist > r1 + r2 || dist < Math.abs(r1 - r2)) {
            return [];
        }

        const a = (r1 * r1 - r2 * r2 + dist * dist) / (2 * dist);
        const h2 = r1 * r1 - a * a;

        if (h2 < 0) return [];

        const h = Math.sqrt(h2);
        const p = c1.add(d.mul(a / dist));

        if (MathUtils.isZero(h)) {
            return [p]; // 접함
        }

        const perp = d.perpendicular().normalize().mul(h);
        return [p.add(perp), p.sub(perp)];
    },

    /**
     * 세 점을 지나는 원 (외접원)
     * @returns {{center: Vec2, radius: number}|null}
     */
    circumcircle(p1, p2, p3) {
        const d21 = p2.sub(p1);
        const d31 = p3.sub(p1);
        const cross = d21.cross(d31);

        if (MathUtils.isZero(cross)) {
            return null; // 세 점이 일직선
        }

        const m1 = p1.add(p2).mul(0.5);
        const m2 = p1.add(p3).mul(0.5);

        const center = this.lineLineIntersection(
            m1, m1.add(d21.perpendicular()),
            m2, m2.add(d31.perpendicular())
        );

        if (!center) return null;

        return {
            center,
            radius: center.distanceTo(p1)
        };
    },

    /**
     * 원의 접선 (접점에서)
     * @returns {{p1: Vec2, p2: Vec2}} 접선의 두 점
     */
    tangentAtPoint(center, tangentPoint) {
        const dir = tangentPoint.sub(center).perpendicular().normalize();
        return {
            p1: tangentPoint.sub(dir),
            p2: tangentPoint.add(dir)
        };
    },

    /**
     * 각의 이등분선 방향 벡터
     */
    angleBisectorDirection(origin, p1, p2) {
        const d1 = p1.sub(origin).normalize();
        const d2 = p2.sub(origin).normalize();
        const bisector = d1.add(d2);

        if (MathUtils.isZero(bisector.length())) {
            // 두 방향이 반대인 경우, 수직 방향 반환
            return d1.perpendicular();
        }

        return bisector.normalize();
    },

    /**
     * 점이 다각형 내부에 있는지 확인 (레이 캐스팅)
     */
    pointInPolygon(point, vertices) {
        let inside = false;
        const n = vertices.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const vi = vertices[i];
            const vj = vertices[j];

            if ((vi.y > point.y) !== (vj.y > point.y) &&
                point.x < (vj.x - vi.x) * (point.y - vi.y) / (vj.y - vi.y) + vi.x) {
                inside = !inside;
            }
        }

        return inside;
    },

    /**
     * 다각형의 넓이 (Shoelace formula)
     */
    polygonArea(vertices) {
        let area = 0;
        const n = vertices.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }

        return Math.abs(area) / 2;
    },

    /**
     * 다각형의 무게중심
     */
    polygonCentroid(vertices) {
        let cx = 0, cy = 0;
        const n = vertices.length;

        for (const v of vertices) {
            cx += v.x;
            cy += v.y;
        }

        return new Vec2(cx / n, cy / n);
    },

    /**
     * 바운딩 박스
     */
    boundingBox(points) {
        if (points.length === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        return {
            min: new Vec2(minX, minY),
            max: new Vec2(maxX, maxY),
            width: maxX - minX,
            height: maxY - minY,
            center: new Vec2((minX + maxX) / 2, (minY + maxY) / 2)
        };
    }
};

export default Geometry;
