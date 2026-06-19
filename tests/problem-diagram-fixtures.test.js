import assert from 'node:assert/strict';
import test from 'node:test';

import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { SemanticValidator } from '../js/ai/SemanticValidator.js';

const fixtures = [
    {
        name: 'quadratic and line intersections',
        prompt: '다음 좌표평면에서 이차함수 y=x^2-4x+3과 직선 y=x+1의 교점을 나타내는 문제이다.',
        data: {
            operations: [
                { op: 'create', id: 'f', type: 'function', expression: 'x^2 - 4*x + 3', label: 'y=x^2-4x+3' },
                { op: 'create', id: 'g', type: 'function', expression: 'x + 1', label: 'y=x+1' },
                { op: 'create', id: 'A', type: 'point', x: -0.45, y: 0.55, label: 'A' },
                { op: 'create', id: 'B', type: 'point', x: 4.45, y: 5.45, label: 'B' }
            ]
        }
    },
    {
        name: 'inequality region',
        prompt: '좌표평면에서 두 일차부등식이 나타내는 영역을 음영으로 표시하는 문제이다.',
        data: {
            operations: [
                { op: 'create', id: 'l1a', type: 'point', x: -3, y: 3, visible: false, pointSize: 0 },
                { op: 'create', id: 'l1b', type: 'point', x: 3, y: -3, visible: false, pointSize: 0 },
                { op: 'create', id: 'l2a', type: 'point', x: -3, y: -1, visible: false, pointSize: 0 },
                { op: 'create', id: 'l2b', type: 'point', x: 3, y: 2, visible: false, pointSize: 0 },
                { op: 'create', id: 'line1', type: 'line', point1Id: 'l1a', point2Id: 'l1b', label: 'x+y=0' },
                { op: 'create', id: 'line2', type: 'line', point1Id: 'l2a', point2Id: 'l2b', label: 'y=1/2x+1/2' },
                { op: 'create', id: 'r1', type: 'point', x: 0, y: 0.4, visible: false, pointSize: 0 },
                { op: 'create', id: 'r2', type: 'point', x: 2.5, y: 1.8, visible: false, pointSize: 0 },
                { op: 'create', id: 'r3', type: 'point', x: 2.5, y: 3.2, visible: false, pointSize: 0 },
                { op: 'create', id: 'region', type: 'polygon', vertexIds: ['r1', 'r2', 'r3'], fillOpacity: 0.14 }
            ]
        }
    },
    {
        name: 'circle tangent',
        prompt: '원 O 위의 점 A에서 접선을 그리고 반지름과 접선이 수직임을 나타내는 문제이다.',
        data: {
            operations: [
                { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
                { op: 'create', id: 'A', type: 'point', x: 2, y: 0, label: 'A' },
                { op: 'create', id: 'T', type: 'point', x: 2, y: 2, visible: false, pointSize: 0 },
                { op: 'create', id: 'c', type: 'circle', centerId: 'O', pointOnCircleId: 'A' },
                { op: 'create', id: 'r', type: 'segment', point1Id: 'O', point2Id: 'A' },
                { op: 'create', id: 'tan', type: 'line', point1Id: 'A', point2Id: 'T', label: 't' },
                { op: 'create', id: 'ra', type: 'rightAngleMarker', vertexId: 'A', line1Id: 'r', line2Id: 'tan' }
            ]
        }
    },
    {
        name: 'triangle similarity',
        prompt: '두 삼각형의 닮음과 대응각을 표시하는 평면도형 문제이다.',
        data: {
            operations: [
                { op: 'create', id: 'A', type: 'point', x: -3, y: 0, label: 'A' },
                { op: 'create', id: 'B', type: 'point', x: -1, y: 0, label: 'B' },
                { op: 'create', id: 'C', type: 'point', x: -2.4, y: 1.6, label: 'C' },
                { op: 'create', id: 'D', type: 'point', x: 0.5, y: 0, label: 'D' },
                { op: 'create', id: 'E', type: 'point', x: 3.5, y: 0, label: 'E' },
                { op: 'create', id: 'F', type: 'point', x: 1.4, y: 2.4, label: 'F' },
                { op: 'create', id: 'tri1', type: 'polygon', vertexIds: ['A', 'B', 'C'], fillOpacity: 0 },
                { op: 'create', id: 'tri2', type: 'polygon', vertexIds: ['D', 'E', 'F'], fillOpacity: 0 },
                { op: 'create', id: 'angA', type: 'angleDimension', vertexId: 'A', point1Id: 'B', point2Id: 'C', label: 'α' },
                { op: 'create', id: 'angD', type: 'angleDimension', vertexId: 'D', point1Id: 'E', point2Id: 'F', label: 'α' }
            ]
        }
    },
    {
        name: 'number line radical',
        prompt: '수직선 위에 제곱근의 위치를 표시하는 문제이다.',
        data: {
            operations: [
                {
                    op: 'create',
                    id: 'nl',
                    type: 'numberLine',
                    start: -1,
                    end: 4,
                    step: 1,
                    y: 0,
                    customMarks: [{ value: 1.414, label: 'sqrt(2)' }]
                }
            ]
        }
    },
    {
        name: 'rectangular prism',
        prompt: '직육면체의 모서리 길이와 입체도형 구조를 나타내는 문제이다.',
        data: {
            operations: [
                { op: 'create', id: 'A', type: 'point', x: -2, y: -1, label: 'A' },
                { op: 'create', id: 'B', type: 'point', x: 1, y: -1, label: 'B' },
                { op: 'create', id: 'C', type: 'point', x: 2, y: 0, label: 'C' },
                { op: 'create', id: 'D', type: 'point', x: -1, y: 0, label: 'D' },
                { op: 'create', id: 'E', type: 'point', x: -2, y: 2, label: 'E' },
                { op: 'create', id: 'F', type: 'point', x: 1, y: 2, label: 'F' },
                { op: 'create', id: 'G', type: 'point', x: 2, y: 3, label: 'G' },
                { op: 'create', id: 'H', type: 'point', x: -1, y: 3, label: 'H' },
                { op: 'create', id: 'box', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['E', 'F', 'G', 'H'] }
            ]
        }
    },
    {
        name: 'histogram approximation',
        prompt: '통계 자료의 도수분포를 히스토그램으로 근사하여 나타내는 문제이다.',
        data: {
            operations: [
                { op: 'create', id: 'a1', type: 'point', x: 0, y: 0, visible: false, pointSize: 0 },
                { op: 'create', id: 'a2', type: 'point', x: 1, y: 0, visible: false, pointSize: 0 },
                { op: 'create', id: 'a3', type: 'point', x: 1, y: 2, visible: false, pointSize: 0 },
                { op: 'create', id: 'a4', type: 'point', x: 0, y: 2, visible: false, pointSize: 0 },
                { op: 'create', id: 'b1', type: 'point', x: 1, y: 0, visible: false, pointSize: 0 },
                { op: 'create', id: 'b2', type: 'point', x: 2, y: 0, visible: false, pointSize: 0 },
                { op: 'create', id: 'b3', type: 'point', x: 2, y: 3, visible: false, pointSize: 0 },
                { op: 'create', id: 'b4', type: 'point', x: 1, y: 3, visible: false, pointSize: 0 },
                { op: 'create', id: 'bar1', type: 'polygon', vertexIds: ['a1', 'a2', 'a3', 'a4'], fillOpacity: 0.12 },
                { op: 'create', id: 'bar2', type: 'polygon', vertexIds: ['b1', 'b2', 'b3', 'b4'], fillOpacity: 0.12 }
            ]
        }
    },
    {
        name: 'scatter approximation',
        prompt: '산점도 자료의 양의 상관관계를 나타내는 통계 문제이다.',
        data: {
            operations: [
                { op: 'create', id: 'p1', type: 'point', x: 0, y: 0.4 },
                { op: 'create', id: 'p2', type: 'point', x: 1, y: 1.2 },
                { op: 'create', id: 'p3', type: 'point', x: 2, y: 1.7 },
                { op: 'create', id: 'p4', type: 'point', x: 3, y: 3.1 },
                { op: 'create', id: 't1', type: 'point', x: 0, y: 0, visible: false, pointSize: 0 },
                { op: 'create', id: 't2', type: 'point', x: 3.4, y: 3.2, visible: false, pointSize: 0 },
                { op: 'create', id: 'trend', type: 'line', point1Id: 't1', point2Id: 't2', label: 'trend' }
            ]
        }
    }
];

test('problem diagram fixtures satisfy schema and semantic intent checks', () => {
    const schemaValidator = new SchemaValidator();
    const semanticValidator = new SemanticValidator();

    for (const fixture of fixtures) {
        const schemaResult = schemaValidator.validate(fixture.data);
        assert.equal(schemaResult.valid, true, `${fixture.name}: ${schemaResult.errors.join('; ')}`);

        const semanticResult = semanticValidator.validateProblemDiagramIntent(fixture.data, {
            prompt: fixture.prompt
        });
        assert.equal(semanticResult.valid, true, `${fixture.name}: ${semanticResult.errors.join('; ')}`);
    }
});
