/**
 * Solid3D.js - 투영 입체도형 객체
 * 정육면체, 직육면체, 각기둥, 각뿔
 * 
 * 숨은선(점선/실선) 판정:
 * - 투영(Oblique): X = x + α*z, Y = y + β*z
 * - 시선 방향: viewDir = normalize(-α, -β, 1)
 * - 모서리 가시성: 인접 면 중 하나라도 앞면이면 실선, 모두 뒷면이면 점선
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2, Geometry } from '../utils/Geometry.js';

/**
 * 간단한 3D 벡터 클래스
 */
class Vec3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    sub(v) {
        return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    cross(v) {
        return new Vec3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    normalize() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (len === 0) return new Vec3(0, 0, 0);
        return new Vec3(this.x / len, this.y / len, this.z / len);
    }

    add(v) {
        return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    mul(s) {
        return new Vec3(this.x * s, this.y * s, this.z * s);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
}

/**
 * 투영 파라미터 (Oblique projection)
 * X = x + ALPHA * z, Y = y + BETA * z
 */
const ALPHA = 0.5;
const BETA = 0.35;

/**
 * 시선 방향 (투영 파라미터 기반)
 * 카메라가 바라보는 방향 = normalize(-α, -β, 1)
 */
const VIEW_DIR = new Vec3(-ALPHA, -BETA, 1).normalize();

/**
 * 삼각형 면의 법선 벡터 계산
 * @param {Vec3} p1 첫 번째 꼭짓점
 * @param {Vec3} p2 두 번째 꼭짓점
 * @param {Vec3} p3 세 번째 꼭짓점
 * @returns {Vec3} 정규화된 법선 벡터
 */
function calculateFaceNormal(p1, p2, p3) {
    const edge1 = p2.sub(p1);
    const edge2 = p3.sub(p1);
    return edge1.cross(edge2).normalize();
}

/**
 * 법선이 바깥쪽을 향하도록 통일
 * @param {Vec3} normal 원래 법선
 * @param {Vec3} facePoint 면 위의 한 점
 * @param {Vec3} solidCenter 도형의 중심점
 * @returns {Vec3} 바깥쪽을 향하도록 조정된 법선
 */
function ensureOutwardNormal(normal, facePoint, solidCenter) {
    // N · (P - O) > 0 이면 바깥쪽
    const outwardTest = normal.dot(facePoint.sub(solidCenter));
    if (outwardTest < 0) {
        // 법선이 안쪽을 향함 → 뒤집기
        return new Vec3(-normal.x, -normal.y, -normal.z);
    }
    return normal;
}

/**
 * 면이 앞면인지 판단 (카메라를 향하는지)
 * dot(normal, VIEW_DIR) > 0 이면 카메라를 향함 = 앞면
 * @param {Vec3} normal 면의 법선 (바깥쪽 향함)
 * @returns {boolean} true면 앞면(보임), false면 뒷면(숨김)
 */
function isFaceFront(normal) {
    return normal.dot(VIEW_DIR) > 0;
}

/**
 * 2D 점을 가상 3D로 변환 (z=0 평면)
 */
function to3D(point2D, z = 0) {
    return new Vec3(point2D.x, point2D.y, z);
}

/**
 * 화면 좌표(투영된 좌표)를 실제 3D 좌표로 역변환
 * 투영 공식: X = x + α*z, Y = y + β*z
 * 역변환: x = X - α*z, y = Y - β*z
 */
function unproject(screenPt, z) {
    return new Vec3(screenPt.x - ALPHA * z, screenPt.y - BETA * z, z);
}

/**
 * 3D 점들의 중심 계산
 */
function calculate3DCenter(points) {
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const p of points) {
        sumX += p.x;
        sumY += p.y;
        sumZ += p.z;
    }
    const n = points.length;
    return new Vec3(sumX / n, sumY / n, sumZ / n);
}



/**
 * 각기둥 (Prism)
 * 밑면 다각형 + 윗면 다각형으로 정의
 */
export class Prism extends GeoObject {
    constructor(baseVertexIds, topVertexIds, params = {}) {
        super(ObjectType.PRISM, params);
        this.baseVertexIds = baseVertexIds; // 밑면 꼭짓점 ID 배열
        this.topVertexIds = topVertexIds;   // 윗면 꼭짓점 ID 배열

        for (const id of baseVertexIds) {
            this.addDependency(id);
        }
        for (const id of topVertexIds) {
            this.addDependency(id);
        }

        // 캐시
        this._baseVertices = [];
        this._topVertices = [];
        this._hiddenEdges = [];
    }

    update(objectManager) {
        this._baseVertices = [];
        this._topVertices = [];

        // 밑면 꼭짓점 수집
        for (const id of this.baseVertexIds) {
            const point = objectManager.getObject(id);
            if (!point || !point.valid) {
                this.valid = false;
                return;
            }
            this._baseVertices.push(point.getPosition());
        }

        // 윗면 꼭짓점 수집
        for (const id of this.topVertexIds) {
            const point = objectManager.getObject(id);
            if (!point || !point.valid) {
                this.valid = false;
                return;
            }
            this._topVertices.push(point.getPosition());
        }

        // 깊이 벡터 계산 (밑면 중심에서 윗면 중심까지)
        if (this._baseVertices.length > 0 && this._topVertices.length > 0) {
            const baseCenter = Geometry.polygonCentroid(this._baseVertices);
            const topCenter = Geometry.polygonCentroid(this._topVertices);
            this.depthVector = topCenter.sub(baseCenter);
        }

        this._calculateHiddenEdges();
        this.valid = this._baseVertices.length >= 3 && this._topVertices.length >= 3;
    }

    _calculateHiddenEdges() {
        this._hiddenEdges = [];
        const n = this._baseVertices.length;
        if (n < 3) return;

        // === 1. 3D 좌표 생성 (참조 코드와 동일한 방식) ===
        // 밑면에서 윗면 중심까지의 화면상 벡터
        const baseCenter = Geometry.polygonCentroid(this._baseVertices);
        const topCenter = Geometry.polygonCentroid(this._topVertices);
        const shiftX = topCenter.x - baseCenter.x;
        const shiftY = topCenter.y - baseCenter.y;

        // 높이 z 계산 (투영 역산)
        let h;
        if (Math.abs(ALPHA) > Math.abs(BETA) && Math.abs(ALPHA) > 0.01) {
            h = shiftX / ALPHA;
        } else if (Math.abs(BETA) > 0.01) {
            h = shiftY / BETA;
        } else {
            h = Math.sqrt(shiftX * shiftX + shiftY * shiftY) * 2 + 1;
        }
        h = Math.max(h, 0.5);

        // 밑면: z=0 (화면 좌표 = 3D 좌표)
        const base3D = this._baseVertices.map(p => new Vec3(p.x, p.y, 0));

        // 윗면: 참조 코드처럼 투영 역변환 적용
        // 화면에서 (baseX + shiftX, baseY + shiftY)로 보이려면
        // 3D 좌표는 (baseX + shiftX - α*h, baseY + shiftY - β*h, h)
        const top3D = this._baseVertices.map(p => new Vec3(
            p.x + shiftX - ALPHA * h,
            p.y + shiftY - BETA * h,
            h
        ));

        const verts = [...base3D, ...top3D]; // 0~n-1: base, n~2n-1: top

        // === 2. 도형 내부점 계산 (winding 통일용) ===
        const interior = verts.reduce((acc, p) => acc.add(p), new Vec3(0, 0, 0));
        const interiorPt = interior.mul(1 / verts.length);

        // === 3. 삼각형 목록 생성 ===
        const tris = [];

        // 밑면 (아래 방향)
        for (let i = 1; i < n - 1; i++) {
            tris.push([0, i + 1, i]);
        }

        // 윗면 (위 방향) - 참조 코드와 동일
        for (let i = 1; i < n - 1; i++) {
            tris.push([n, n + i, n + i + 1]);
        }

        // 옆면: (i, j, j') + (i, j', i')
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const iT = n + i;
            const jT = n + j;
            tris.push([i, j, jT]);
            tris.push([i, jT, iT]);
        }

        // === 4. winding을 바깥으로 통일 (참조 코드와 동일) ===
        const fixedTris = tris.map(idxs => {
            const a = verts[idxs[0]];
            const b = verts[idxs[1]];
            const c = verts[idxs[2]];
            const nrm = b.sub(a).cross(c.sub(a)); // 정규화 안 함
            const center = a.add(b).add(c).mul(1 / 3);
            const s = nrm.dot(center.sub(interiorPt));
            if (s < 0) {
                return [idxs[0], idxs[2], idxs[1]]; // 뒤집기
            }
            return idxs;
        });

        const triangles = fixedTris.map(t => ({ a: t[0], b: t[1], c: t[2] }));

        // === 5. 각 면의 앞/뒤 판정 ===
        const triFacing = triangles.map(t => {
            const a = verts[t.a];
            const b = verts[t.b];
            const c = verts[t.c];
            const nrm = b.sub(a).cross(c.sub(a)).normalize();
            const front = nrm.dot(VIEW_DIR) > 0;
            return { ...t, front };
        });

        // === 6. edge -> 인접 삼각형 맵 ===
        const adj = new Map();
        for (let i = 0; i < triangles.length; i++) {
            const t = triangles[i];
            const arr = [t.a, t.b, t.c];
            for (let e = 0; e < 3; e++) {
                const u0 = arr[e];
                const v0 = arr[(e + 1) % 3];
                const u = Math.min(u0, v0);
                const v = Math.max(u0, v0);
                const key = `${u}-${v}`;
                if (!adj.has(key)) adj.set(key, []);
                adj.get(key).push(i);
            }
        }

        // === 7. 모서리 목록 (밑면 + 윗면 + 세로) ===
        const edges = [];
        for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n]);
        for (let i = 0; i < n; i++) edges.push([n + i, n + ((i + 1) % n)]);
        for (let i = 0; i < n; i++) edges.push([i, n + i]);

        // 중복 제거
        const seen = new Set();
        const uniqEdges = [];
        for (const [u0, v0] of edges) {
            const u = Math.min(u0, v0);
            const v = Math.max(u0, v0);
            const key = `${u}-${v}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqEdges.push([u, v]);
            }
        }

        // === 8. 모서리 가시성: 인접 면 중 하나라도 앞면이면 실선 ===
        for (const [u, v] of uniqEdges) {
            const key = `${u}-${v}`;
            const triIdxs = adj.get(key) ?? [];
            const anyFront = triIdxs.some(idx => triFacing[idx].front);

            if (!anyFront) {
                // 어느 타입인지 판별
                let type = 'vertical';
                let index = u;

                if (u < n && v < n) {
                    type = 'base';
                    index = Math.min(u, v);
                } else if (u >= n && v >= n) {
                    type = 'top';
                    index = Math.min(u, v) - n;
                } else {
                    type = 'vertical';
                    index = u < n ? u : v;
                }

                this._hiddenEdges.push({ type, index });
            }
        }
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        const n = this._baseVertices.length;

        // Mk2.1: 모서리 선택/하이라이트 지원
        // - 사용자가 모서리를 선택할 수 있도록, 마지막 hitTest에서 감지된 엣지를 저장합니다.
        // - 선택된 엣지는 더 두껍고 눈에 띄는 색으로 덧그려 보여줍니다.
        const highlightEdge = (p1, p2) => {
            canvas.drawSegment(p1, p2, {
                color: '#f97316',
                width: Math.max(3, (this.lineWidth || 2) + 2),
                dashed: false
            });
        };

        // 상단면
        for (let i = 0; i < n; i++) {
            const isHidden = this._hiddenEdges.some(
                e => e.type === 'top' && e.index === i
            );
            canvas.drawSegment(
                this._topVertices[i],
                this._topVertices[(i + 1) % n],
                {
                    color: this.color,
                    width: this.lineWidth,
                    dashed: isHidden,
                    dashPattern: [4, 4]
                }
            );
        }

        // 하단면
        for (let i = 0; i < n; i++) {
            const isHidden = this._hiddenEdges.some(
                e => e.type === 'base' && e.index === i
            );
            canvas.drawSegment(
                this._baseVertices[i],
                this._baseVertices[(i + 1) % n],
                {
                    color: this.color,
                    width: this.lineWidth,
                    dashed: isHidden,
                    dashPattern: [4, 4]
                }
            );
        }

        // 세로 모서리
        for (let i = 0; i < n; i++) {
            const isHidden = this._hiddenEdges.some(
                e => e.type === 'vertical' && e.index === i
            );

            canvas.drawSegment(this._baseVertices[i], this._topVertices[i], {
                color: this.color,
                width: this.lineWidth,
                dashed: isHidden,
                dashPattern: [4, 4]
            });
        }

        // 선택된(또는 호버된) 모서리 강조 표시
        const edge = this._activeEdge || this._hoverEdge;
        if ((this.selected || this.highlighted) && edge) {
            if (edge.kind === 'top') {
                highlightEdge(this._topVertices[edge.index], this._topVertices[(edge.index + 1) % n]);
            } else if (edge.kind === 'base') {
                highlightEdge(this._baseVertices[edge.index], this._baseVertices[(edge.index + 1) % n]);
            } else if (edge.kind === 'vertical') {
                highlightEdge(this._baseVertices[edge.index], this._topVertices[edge.index]);
            }
        }

        if (this.showLabel && this.label) {
            const center = Geometry.polygonCentroid(this._topVertices);
            canvas.drawLabel(center, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        // Mk2.1: 모서리(엣지) 근처 클릭을 우선 감지합니다.
        // threshold는 screen 픽셀 기반으로 들어오므로 math 길이로 변환해 비교합니다.
        const tol = canvas.toMathLength(threshold);
        const n = this._baseVertices.length;

        // 후보 엣지들: top/base/vertical
        let best = null;
        let bestDist = Infinity;

        const checkEdge = (kind, index, p1, p2) => {
            const dist = Geometry.pointToSegmentDistance(point, p1, p2);
            if (dist < bestDist) {
                bestDist = dist;
                best = { kind, index };
            }
        };

        for (let i = 0; i < n; i++) {
            checkEdge('base', i, this._baseVertices[i], this._baseVertices[(i + 1) % n]);
            checkEdge('top', i, this._topVertices[i], this._topVertices[(i + 1) % n]);
            checkEdge('vertical', i, this._baseVertices[i], this._topVertices[i]);
        }

        if (best && bestDist <= tol) {
            // hover vs select 구분을 위해 selected 상태를 보고 저장 위치를 다르게 둡니다.
            // (ObjectManager.highlightObject는 highlighted를 true로 만들 수 있습니다.)
            this._hoverEdge = best;
            // 실제 클릭으로 select가 걸리면 다음 프레임에서 selected가 true가 되므로
            // 계속 보여줄 수 있도록 activeEdge도 갱신합니다.
            this._activeEdge = best;
            return true;
        }

        // 엣지를 못 잡으면 중심 근처를 클릭했는지로 판정 (기존 동작 유지)
        const center = Geometry.polygonCentroid(this._baseVertices);
        const topCenter = Geometry.polygonCentroid(this._topVertices);
        const overallCenter = center.lerp(topCenter, 0.5);
        const ok = point.distanceTo(overallCenter) < canvas.toMathLength(60);
        if (!ok) {
            this._hoverEdge = null;
        }
        return ok;
    }

    isDraggable() {
        return false;
    }

    setDepthVector(x, y) {
        this.depthVector = new Vec2(x, y);
    }

    /**
     * 모든 모서리 정보 반환
     * @returns {Array<{type: string, index: number, p1: Vec2, p2: Vec2, length: number}>}
     */
    getEdges() {
        if (!this.valid) return [];
        const edges = [];
        const n = this._baseVertices.length;

        // 밑면 모서리
        for (let i = 0; i < n; i++) {
            const p1 = this._baseVertices[i];
            const p2 = this._baseVertices[(i + 1) % n];
            edges.push({
                type: 'base',
                index: i,
                p1: p1,
                p2: p2,
                length: p1.distanceTo(p2),
                label: `밑면 ${i + 1}`
            });
        }

        // 윗면 모서리
        for (let i = 0; i < n; i++) {
            const p1 = this._topVertices[i];
            const p2 = this._topVertices[(i + 1) % n];
            edges.push({
                type: 'top',
                index: i,
                p1: p1,
                p2: p2,
                length: p1.distanceTo(p2),
                label: `윗면 ${i + 1}`
            });
        }

        // 세로 모서리
        for (let i = 0; i < n; i++) {
            const p1 = this._baseVertices[i];
            const p2 = this._topVertices[i];
            edges.push({
                type: 'vertical',
                index: i,
                p1: p1,
                p2: p2,
                length: p1.distanceTo(p2),
                label: `옆면 ${i + 1}`
            });
        }

        return edges;
    }

    /**
     * 모든 꼭짓점 정보 반환
     * @returns {Array<{type: string, index: number, position: Vec2}>}
     */
    getVertices() {
        if (!this.valid) return [];
        const vertices = [];

        // 밑면 꼭짓점
        for (let i = 0; i < this._baseVertices.length; i++) {
            vertices.push({
                type: 'base',
                index: i,
                position: this._baseVertices[i],
                label: `밑면 꼭짓점 ${i + 1}`
            });
        }

        // 윗면 꼭짓점
        for (let i = 0; i < this._topVertices.length; i++) {
            vertices.push({
                type: 'top',
                index: i,
                position: this._topVertices[i],
                label: `윗면 꼭짓점 ${i + 1}`
            });
        }

        return vertices;
    }

    /**
     * 특정 모서리 길이 반환
     */
    getEdgeLength(type, index) {
        const edges = this.getEdges();
        const edge = edges.find(e => e.type === type && e.index === index);
        return edge ? edge.length : null;
    }

    /**
     * 현재 선택된/호버된 모서리 정보 반환
     */
    getActiveEdge() {
        const edge = this._activeEdge || this._hoverEdge;
        if (!edge) return null;

        const n = this._baseVertices.length;
        let p1, p2;

        if (edge.kind === 'base') {
            p1 = this._baseVertices[edge.index];
            p2 = this._baseVertices[(edge.index + 1) % n];
        } else if (edge.kind === 'top') {
            p1 = this._topVertices[edge.index];
            p2 = this._topVertices[(edge.index + 1) % n];
        } else if (edge.kind === 'vertical') {
            p1 = this._baseVertices[edge.index];
            p2 = this._topVertices[edge.index];
        }

        if (p1 && p2) {
            return {
                ...edge,
                p1: p1,
                p2: p2,
                length: p1.distanceTo(p2)
            };
        }
        return null;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            baseVertexIds: [...this.baseVertexIds],
            topVertexIds: [...this.topVertexIds],
            depthVectorX: this.depthVector?.x || 0,
            depthVectorY: this.depthVector?.y || 0
        };
    }
}

/**
 * 각뿔 (Pyramid)
 * 밑면 다각형 + 꼭대기점으로 정의
 */
export class Pyramid extends GeoObject {
    constructor(baseVertexIds, apexId, params = {}) {
        super(ObjectType.PYRAMID, params);
        this.baseVertexIds = baseVertexIds;
        this.apexId = apexId;

        for (const id of baseVertexIds) {
            this.addDependency(id);
        }
        this.addDependency(apexId);

        this._baseVertices = [];
        this._apex = new Vec2(0, 0);
        this._hiddenEdges = [];
    }

    update(objectManager) {
        this._baseVertices = [];

        for (const id of this.baseVertexIds) {
            const point = objectManager.getObject(id);
            if (!point || !point.valid) {
                this.valid = false;
                return;
            }
            this._baseVertices.push(point.getPosition());
        }

        const apexPoint = objectManager.getObject(this.apexId);
        if (!apexPoint || !apexPoint.valid) {
            this.valid = false;
            return;
        }

        this._apex = apexPoint.getPosition();
        this._calculateHiddenEdges();

        this.valid = this._baseVertices.length >= 3;
    }

    _calculateHiddenEdges() {
        this._hiddenEdges = [];
        const n = this._baseVertices.length;
        if (n < 3) return;

        // === 1. 3D 좌표 생성 (참조 코드와 동일한 방식) ===
        const baseCenter2D = Geometry.polygonCentroid(this._baseVertices);
        const shiftX = this._apex.x - baseCenter2D.x;
        const shiftY = this._apex.y - baseCenter2D.y;

        // 높이 계산 (투영 역산)
        let h;
        if (Math.abs(ALPHA) > Math.abs(BETA) && Math.abs(ALPHA) > 0.01) {
            h = shiftX / ALPHA;
        } else if (Math.abs(BETA) > 0.01) {
            h = shiftY / BETA;
        } else {
            h = Math.sqrt(shiftX * shiftX + shiftY * shiftY) * 2 + 1;
        }
        h = Math.max(h, 0.5);

        // 밑면: z=0 (화면 좌표 = 3D 좌표)
        const base3D = this._baseVertices.map(p => new Vec3(p.x, p.y, 0));

        // 꼭대기: 참조 코드처럼 투영 역변환 적용
        // 밑면 중심에서 (shiftX, shiftY)만큼 이동해 보이려면
        // 3D 좌표는 (centerX + shiftX - α*h, centerY + shiftY - β*h, h)
        const apex3D = new Vec3(
            baseCenter2D.x + shiftX - ALPHA * h,
            baseCenter2D.y + shiftY - BETA * h,
            h
        );

        const verts = [...base3D, apex3D];
        const apexIndex = n;

        // === 2. 도형 내부점 계산 (winding 통일용) ===
        const interior = verts.reduce((acc, p) => acc.add(p), new Vec3(0, 0, 0));
        const interiorPt = interior.mul(1 / verts.length);

        // === 3. 삼각형 목록 생성 ===
        const tris = [];

        // 밑면 (아래 방향)
        for (let i = 1; i < n - 1; i++) {
            tris.push([0, i + 1, i]);
        }

        // 측면: (i, j, apex)
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            tris.push([i, j, apexIndex]);
        }

        // === 4. winding을 바깥으로 통일 (참조 코드와 동일) ===
        const fixedTris = tris.map(idxs => {
            const a = verts[idxs[0]];
            const b = verts[idxs[1]];
            const c = verts[idxs[2]];
            const nrm = b.sub(a).cross(c.sub(a)); // 정규화 안 함
            const center = a.add(b).add(c).mul(1 / 3);
            const s = nrm.dot(center.sub(interiorPt));
            if (s < 0) {
                return [idxs[0], idxs[2], idxs[1]]; // 뒤집기
            }
            return idxs;
        });

        const triangles = fixedTris.map(t => ({ a: t[0], b: t[1], c: t[2] }));

        // === 5. 각 면의 앞/뒤 판정 ===
        const triFacing = triangles.map(t => {
            const a = verts[t.a];
            const b = verts[t.b];
            const c = verts[t.c];
            const nrm = b.sub(a).cross(c.sub(a)).normalize();
            const front = nrm.dot(VIEW_DIR) > 0;
            return { ...t, front };
        });

        // === 6. edge -> 인접 삼각형 맵 ===
        const adj = new Map();
        for (let i = 0; i < triangles.length; i++) {
            const t = triangles[i];
            const arr = [t.a, t.b, t.c];
            for (let e = 0; e < 3; e++) {
                const u0 = arr[e];
                const v0 = arr[(e + 1) % 3];
                const u = Math.min(u0, v0);
                const v = Math.max(u0, v0);
                const key = `${u}-${v}`;
                if (!adj.has(key)) adj.set(key, []);
                adj.get(key).push(i);
            }
        }

        // === 7. 모서리 목록 ===
        const edges = [];
        // 밑면 테두리
        for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n]);
        // 측면 모서리
        for (let i = 0; i < n; i++) edges.push([i, apexIndex]);

        // 중복 제거
        const seen = new Set();
        const uniqEdges = [];
        for (const [u0, v0] of edges) {
            const u = Math.min(u0, v0);
            const v = Math.max(u0, v0);
            const key = `${u}-${v}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqEdges.push([u, v]);
            }
        }

        // === 8. 모서리 가시성: 인접 면 중 하나라도 앞면이면 실선 ===
        for (const [u, v] of uniqEdges) {
            const key = `${u}-${v}`;
            const triIdxs = adj.get(key) ?? [];
            const anyFront = triIdxs.some(idx => triFacing[idx].front);

            if (!anyFront) {
                // 어느 타입인지 판별
                let type = 'lateral';
                let index = u;

                if (u < n && v < n) {
                    type = 'base';
                    index = Math.min(u, v);
                } else {
                    type = 'lateral';
                    index = u < n ? u : v - n;
                }

                this._hiddenEdges.push({ type, index });
            }
        }
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        const n = this._baseVertices.length;

        const highlightEdge = (p1, p2) => {
            canvas.drawSegment(p1, p2, {
                color: '#f97316',
                width: Math.max(3, (this.lineWidth || 2) + 2),
                dashed: false
            });
        };

        // 밑면
        for (let i = 0; i < n; i++) {
            const isHidden = this._hiddenEdges.some(
                e => e.type === 'base' && e.index === i
            );

            canvas.drawSegment(
                this._baseVertices[i],
                this._baseVertices[(i + 1) % n],
                {
                    color: this.color,
                    width: this.lineWidth,
                    dashed: isHidden,
                    dashPattern: [4, 4]
                }
            );
        }

        // 측면 모서리 (꼭대기로)
        for (let i = 0; i < n; i++) {
            const isHidden = this._hiddenEdges.some(
                e => e.type === 'lateral' && e.index === i
            );

            canvas.drawSegment(this._baseVertices[i], this._apex, {
                color: this.color,
                width: this.lineWidth,
                dashed: isHidden,
                dashPattern: [4, 4]
            });
        }

        // 선택된(또는 호버된) 모서리 강조 표시
        const edge = this._activeEdge || this._hoverEdge;
        if ((this.selected || this.highlighted) && edge) {
            if (edge.kind === 'base') {
                highlightEdge(this._baseVertices[edge.index], this._baseVertices[(edge.index + 1) % n]);
            } else if (edge.kind === 'lateral') {
                highlightEdge(this._baseVertices[edge.index], this._apex);
            }
        }

        // 꼭대기 점
        canvas.drawPoint(this._apex, {
            radius: this.pointSize,
            color: this.color
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this._apex, this.label, {
                fontSize: this.fontSize,
                color: this.color,
                offsetY: -15
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        // Mk2.1: 모서리(엣지) 선택 지원
        const tol = canvas.toMathLength(threshold);
        const n = this._baseVertices.length;

        let best = null;
        let bestDist = Infinity;

        const checkEdge = (kind, index, p1, p2) => {
            const dist = Geometry.pointToSegmentDistance(point, p1, p2);
            if (dist < bestDist) {
                bestDist = dist;
                best = { kind, index };
            }
        };

        for (let i = 0; i < n; i++) {
            checkEdge('base', i, this._baseVertices[i], this._baseVertices[(i + 1) % n]);
            checkEdge('lateral', i, this._baseVertices[i], this._apex);
        }

        if (best && bestDist <= tol) {
            this._hoverEdge = best;
            this._activeEdge = best;
            return true;
        }

        const center = Geometry.polygonCentroid(this._baseVertices);
        const overallCenter = center.lerp(this._apex, 0.4);
        const ok = point.distanceTo(overallCenter) < canvas.toMathLength(60);
        if (!ok) {
            this._hoverEdge = null;
        }
        return ok;
    }

    isDraggable() {
        return false;
    }

    /**
     * 모든 모서리 정보 반환
     * @returns {Array<{type: string, index: number, p1: Vec2, p2: Vec2, length: number}>}
     */
    getEdges() {
        if (!this.valid) return [];
        const edges = [];
        const n = this._baseVertices.length;

        // 밑면 모서리
        for (let i = 0; i < n; i++) {
            const p1 = this._baseVertices[i];
            const p2 = this._baseVertices[(i + 1) % n];
            edges.push({
                type: 'base',
                index: i,
                p1: p1,
                p2: p2,
                length: p1.distanceTo(p2),
                label: `밑면 ${i + 1}`
            });
        }

        // 측면 모서리 (꼭대기로)
        for (let i = 0; i < n; i++) {
            const p1 = this._baseVertices[i];
            const p2 = this._apex;
            edges.push({
                type: 'lateral',
                index: i,
                p1: p1,
                p2: p2,
                length: p1.distanceTo(p2),
                label: `측면 ${i + 1}`
            });
        }

        return edges;
    }

    /**
     * 모든 꼭짓점 정보 반환
     * @returns {Array<{type: string, index: number, position: Vec2}>}
     */
    getVertices() {
        if (!this.valid) return [];
        const vertices = [];

        // 밑면 꼭짓점
        for (let i = 0; i < this._baseVertices.length; i++) {
            vertices.push({
                type: 'base',
                index: i,
                position: this._baseVertices[i],
                label: `밑면 꼭짓점 ${i + 1}`
            });
        }

        // 꼭대기
        vertices.push({
            type: 'apex',
            index: 0,
            position: this._apex,
            label: '꼭대기'
        });

        return vertices;
    }

    /**
     * 특정 모서리 길이 반환
     */
    getEdgeLength(type, index) {
        const edges = this.getEdges();
        const edge = edges.find(e => e.type === type && e.index === index);
        return edge ? edge.length : null;
    }

    /**
     * 현재 선택된/호버된 모서리 정보 반환
     */
    getActiveEdge() {
        const edge = this._activeEdge || this._hoverEdge;
        if (!edge) return null;

        const n = this._baseVertices.length;
        let p1, p2;

        if (edge.kind === 'base') {
            p1 = this._baseVertices[edge.index];
            p2 = this._baseVertices[(edge.index + 1) % n];
        } else if (edge.kind === 'lateral') {
            p1 = this._baseVertices[edge.index];
            p2 = this._apex;
        }

        if (p1 && p2) {
            return {
                ...edge,
                p1: p1,
                p2: p2,
                length: p1.distanceTo(p2)
            };
        }
        return null;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            baseVertexIds: [...this.baseVertexIds],
            apexId: this.apexId
        };
    }
}

export default { Prism, Pyramid };
