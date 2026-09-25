import { ValidationResult } from './SchemaValidator.js';
import { readHorizontalAreaBoundary, readRequestedXBounds, readConstant } from './FunctionAreaIntent.js';
import { readPiecewiseFunctionIntent, validatePiecewiseFunctionIntent } from './PiecewiseFunctionIntent.js';

const SQRT2 = Math.SQRT2;

export class SemanticValidator {
    validateExamAnnotationIntent(data, options = {}) {
        const operations = data?.operations || (Array.isArray(data) ? data : []);
        if (!Array.isArray(operations))
            return ValidationResult.failure('exam annotation validation requires operations to be an array.');
        const prompt = String(options.prompt || options.userMessage || '');
        const creates = operations.filter(op => op?.op === 'create');
        const ofType = type => creates.filter(op => op.type === type);
        const result = ValidationResult.success();
        const pointById = new Map(ofType('point').map(op => [op.id, op]));
        const segmentById = new Map(ofType('segment').map(op => [op.id, op]));
        const sideName = id => {
            const segment = segmentById.get(id);
            const a = pointById.get(segment?.point1Id)?.label;
            const b = pointById.get(segment?.point2Id)?.label;
            return a && b ? [a, b].sort().join('') : null;
        };
        const normalizedSide = side => [...side].sort().join('');
        const sideEquals = [...prompt.matchAll(/\b([A-Z]{2})\s*=\s*([A-Z]{2})\b/g)];
        const lengthMarkers = ofType('equalLengthMarker');
        const namedLengthMarkers = lengthMarkers.map(op => ({
            pair: [sideName(op.segment1Id), sideName(op.segment2Id)], tickCount: op.tickCount || 1
        }));
        const angleMarkers = ofType('angleDimension').filter(op => (op.markerCount || 0) > 0);
        const anglesByVertex = label => angleMarkers.filter(op => pointById.get(op.vertexId)?.label === label);
        const requestedSideMarks = [];

        for (const [, first, second] of sideEquals) {
            const a = normalizedSide(first), b = normalizedSide(second);
            const matching = namedLengthMarkers.find(marker => marker.pair.includes(a) && marker.pair.includes(b));
            if (matching) requestedSideMarks.push({ sides: [a, b], tickCount: matching.tickCount });
            if (!matching && (namedLengthMarkers.some(marker => marker.pair.every(Boolean)) || lengthMarkers.length === 0))
                result.addError(`${first}=${second}에 대응하는 같은 길이 표식이 없습니다.`);
        }
        for (let i = 0; i < requestedSideMarks.length; i++) {
            for (let j = i + 1; j < requestedSideMarks.length; j++) {
                const a = requestedSideMarks[i], b = requestedSideMarks[j];
                if (!a.sides.some(side => b.sides.includes(side)) && a.tickCount === b.tickCount)
                    result.addError('서로 독립인 같은 길이 묶음은 서로 다른 눈금 개수로 표시해야 합니다.');
            }
        }
        for (const [, first, second] of prompt.matchAll(/∠\s*([A-Z])\s*=\s*∠\s*([A-Z])/g)) {
            const firstMarks = anglesByVertex(first), secondMarks = anglesByVertex(second);
            const matching = firstMarks.some(a => secondMarks.some(b => a.markerCount === b.markerCount));
            if (!matching && (angleMarkers.some(op => pointById.has(op.vertexId)) || angleMarkers.length < 2))
                result.addError(`∠${first}=∠${second}에 대응하는 같은 각 호·표식이 없습니다.`);
        }
        for (const [, side, value] of prompt.matchAll(/\b([A-Z]{2})\s*=\s*(\d+(?:\.\d+)?)\s*(?:cm|㎝)/gi)) {
            const wanted = normalizedSide(side.toUpperCase());
            const dimensions = ofType('lengthDimension');
            const matching = dimensions.some(op => {
                if (sideName(op.segmentId) !== wanted) return false;
                if (op.customText) return Math.abs(Number.parseFloat(op.customText) - Number(value)) < 1e-9;
                const segment = segmentById.get(op.segmentId);
                const a = pointById.get(segment?.point1Id), b = pointById.get(segment?.point2Id);
                return op.showValue !== false && a && b &&
                    Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - Number(value)) < 1e-6;
            });
            if (!matching && (dimensions.some(op => sideName(op.segmentId)) || dimensions.length === 0))
                result.addError(`${side}=${value}cm의 점선 길이 호가 해당 변에 없습니다.`);
        }
        for (const [, vertex, value] of prompt.matchAll(/∠\s*([A-Z])\s*=\s*(\d+(?:\.\d+)?)\s*°/g)) {
            const dimensions = ofType('angleDimension');
            const matching = dimensions.some(op => {
                if (pointById.get(op.vertexId)?.label !== vertex) return false;
                if (op.customText) return Math.abs(Number.parseFloat(op.customText) - Number(value)) < 1e-9;
                const center = pointById.get(op.vertexId);
                const a = pointById.get(op.point1Id), b = pointById.get(op.point2Id);
                if (!center || !a || !b || op.showValue === false) return false;
                const u = [a.x - center.x, a.y - center.y], v = [b.x - center.x, b.y - center.y];
                const magnitude = Math.hypot(...u) * Math.hypot(...v);
                if (magnitude < 1e-9) return false;
                const degrees = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / magnitude))) * 180 / Math.PI;
                return Math.abs(degrees - Number(value)) <= 0.5;
            });
            if (!matching && (dimensions.some(op => pointById.has(op.vertexId)) || dimensions.length === 0))
                result.addError(`∠${vertex}=${value}°의 각도 호·값이 해당 꼭짓점에 없습니다.`);
        }
        if (/(?:삼각기둥|정육면체)\s*[A-Z]{3,4}\s*[-–—]\s*[A-Z]{3,4}/.test(prompt)) {
            const names = prompt.match(/(?:삼각기둥|정육면체)\s*([A-Z]{3,4})\s*[-–—]\s*([A-Z]{3,4})/);
            const labels = new Set(ofType('point').map(op => op.label));
            if (names && [...names[1], ...names[2]].some(label => !labels.has(label)))
                result.addError('입체도형에서 요청한 꼭짓점 이름이 모두 표시되지 않았습니다.');
        }
        const pyramidNames = prompt.match(/사각뿔\s*([A-Z])\s*[-–—]\s*([A-Z]{4})/);
        const pyramidHeight = prompt.match(/높이\s*(?:는|가|이)?\s*(\d+(?:\.\d+)?)\s*(?:cm|㎝)/i);
        if (pyramidNames && pyramidHeight) {
            const [apexLabel, baseLabels] = [pyramidNames[1], [...pyramidNames[2]]];
            const pyramid = ofType('pyramid').find(op =>
                pointById.get(op.apexId)?.label === apexLabel &&
                JSON.stringify(op.baseVertexIds?.map(id => pointById.get(id)?.label)) === JSON.stringify(baseLabels));
            const base = pyramid?.baseVertexIds?.map(id => pointById.get(id)) || [];
            const apex = pointById.get(pyramid?.apexId);
            const height = Number(pyramidHeight[1]);
            const center = base.length === 4 && base.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))
                ? { x: base.reduce((sum, p) => sum + p.x, 0) / 4,
                    y: base.reduce((sum, p) => sum + p.y, 0) / 4 }
                : null;
            const upright = center && apex && Math.abs(apex.x - center.x) < 1e-6 &&
                Math.abs(apex.y - center.y - height) < 1e-6;
            const visibleNames = [...base, apex].every(p => p && p.visible !== false && p.showLabel !== false && p.pointSize === 0);
            if (!pyramid || !upright || !visibleNames)
                result.addError('사각뿔의 꼭짓점 이름 또는 밑면 중심 위의 수치 높이가 맞지 않습니다.');
            const heightLine = ofType('segment').find(op => {
                const a = pointById.get(op.point1Id), b = pointById.get(op.point2Id);
                const foot = a?.id === pyramid?.apexId ? b : b?.id === pyramid?.apexId ? a : null;
                return foot && foot.visible === false && center &&
                    Math.abs(foot.x - center.x) < 1e-6 && Math.abs(foot.y - center.y) < 1e-6 &&
                    op.visible !== false && op.dashed === true;
            });
            const marked = heightLine && ofType('lengthDimension').some(op =>
                op.segmentId === heightLine.id && op.showValue !== false &&
                (!op.customText || Math.abs(Number.parseFloat(op.customText) - height) < 1e-9));
            if (!marked) result.addError('사각뿔의 점선 높이선과 수치 치수 호가 연결되지 않았습니다.');
        }
        if (/원기둥/.test(prompt)) {
            const radius = prompt.match(/반지름(?:의\s*길이)?\s*(?:은|는|이|가)?\s*(\d+(?:\.\d+)?)\s*(?:cm|㎝)/i);
            const height = prompt.match(/높이\s*(?:는|가|이)?\s*(\d+(?:\.\d+)?)\s*(?:cm|㎝)/i);
            const cylinder = ofType('cylinder')[0];
            const dimensions = ofType('lengthDimension');
            const cx = Number(cylinder?.x), cy = Number(cylinder?.y);
            const radiusLength = Number(cylinder?.width) / 2;
            const ellipseRy = radiusLength * Number(cylinder?.ellipseRatio ?? 0.28);
            const faceY = [cy + Number(cylinder?.height) / 2 - ellipseRy,
                cy - Number(cylinder?.height) / 2 + ellipseRy];
            const endpoints = op => {
                const segment = segmentById.get(op.segmentId);
                return [pointById.get(segment?.point1Id), pointById.get(segment?.point2Id)];
            };
            const close = (a, b) => Math.abs(a - b) < 1e-6;
            const dimensionFor = value => dimensions.filter(op => {
                const [a, b] = endpoints(op);
                if (!a || !b || op.showValue === false) return false;
                const measured = Math.hypot(a.x - b.x, a.y - b.y);
                return Math.abs(measured - value) < 1e-6 &&
                    (!op.customText || Math.abs(Number.parseFloat(op.customText) - value) < 1e-9);
            });
            if (radius) {
                const value = Number(radius[1]);
                if (!cylinder || Math.abs(Number(cylinder.width) - 2 * value) > 1e-6 ||
                    !dimensionFor(value).some(op => {
                        const [a, b] = endpoints(op);
                        const onFace = faceY.some(y => close(a.y, y) && close(b.y, y));
                        const radial = (close(a.x, cx) && close(Math.abs(b.x - cx), value)) ||
                            (close(b.x, cx) && close(Math.abs(a.x - cx), value));
                        return segmentById.get(op.segmentId)?.visible !== false && onFace && radial;
                    }))
                    result.addError('원기둥의 반지름 값과 연결된 반지름 선분·치수 호가 일치하지 않습니다.');
            }
            if (height) {
                const value = Number(height[1]);
                const ratio = Number(cylinder?.ellipseRatio ?? 0.28);
                if (!cylinder || Math.abs(Number(cylinder.height) - Number(cylinder.width) * ratio - value) > 1e-6 ||
                    !dimensionFor(value).some(op => {
                        const [a, b] = endpoints(op);
                        const onRim = close(a.x, b.x) && close(Math.abs(a.x - cx), radiusLength);
                        const betweenFaces = (close(a.y, faceY[0]) && close(b.y, faceY[1])) ||
                            (close(b.y, faceY[0]) && close(a.y, faceY[1]));
                        return onRim && betweenFaces;
                    }))
                    result.addError('원기둥의 높이 값과 두 밑면 중심 사이의 높이 치수 호가 일치하지 않습니다.');
            }
            if (radius && height && Number(radius[1]) === Number(height[1]) &&
                new Set(dimensionFor(Number(radius[1])).map(op => op.segmentId)).size < 2)
                result.addError('반지름과 높이가 같은 수치여도 각각 다른 치수선에 표시해야 합니다.');
            if (/뒤쪽.{0,12}(?:원호|호).{0,12}점선|가려진.{0,12}호.{0,12}점선/.test(prompt) &&
                cylinder?.showHiddenLines === false)
                result.addError('원기둥의 가려진 뒤쪽 호를 점선으로 표시해야 합니다.');
        }
        if (/[a-z]\s*\(\s*x\s*\)\s*=/i.test(prompt) && /색칠|음영|넓이.{0,35}(?:구하|찾|계산|표시)|shad(?:e|ed)/i.test(prompt) &&
            ofType('functionRegion').length === 0)
            result.addError('함수의 넓이 요청에 색칠된 functionRegion이 없습니다.');
        if (/[a-z]\s*\(\s*x\s*\)\s*=/i.test(prompt) && /접선|tangent/i.test(prompt) &&
            ofType('tangentFunction').length === 0)
            result.addError('함수의 접선 요청에 tangentFunction이 없습니다.');
        this.validateHorizontalFunctionAreaIntent(prompt, creates, result);
        for (const error of validatePiecewiseFunctionIntent(prompt, creates)) result.addError(error);
        this.validateExamCircleIntent(prompt, creates, result);
        return result;
    }

    validateHorizontalFunctionAreaIntent(prompt, creates, result) {
        const source = prompt.replace(/[−–—]/g, '-');
        if (readPiecewiseFunctionIntent(source)) return;
        if (!/색칠|음영|넓이.{0,35}(?:구하|찾|계산|표시)|shad(?:e|ed)/i.test(source)) return;
        const assignments = [...source.matchAll(/([a-z])\s*\(\s*x\s*\)\s*=/gi)];
        if (assignments.length !== 1) return;
        const boundary = readHorizontalAreaBoundary(source);
        if (boundary.error) {
            result.addError(boundary.error);
            return;
        }
        if (boundary.baselineY === null) return;
        const bounds = readRequestedXBounds(source);
        if (!bounds) return;
        const name = assignments[0][1].toLowerCase();
        const functions = creates.filter(op => op.type === 'function');
        const graph = functions.find(op => op.id === name || op.label === name);
        const byId = new Map(functions.map(op => [op.id, op]));
        const areas = creates.filter(op => op.type === 'functionRegion');
        const isConstantBoundary = id => {
            const expression = String(byId.get(id)?.expression || '').trim();
            const value = readConstant(expression);
            return value !== null && Math.abs(value - boundary.baselineY) < 1e-9;
        };
        const matchesBoundary = op => {
            if (!graph) return false;
            if (op.function1Id === graph.id && !op.function2Id)
                return Math.abs(Number(op.baselineY ?? 0) - boundary.baselineY) < 1e-9;
            const otherId = op.function1Id === graph.id ? op.function2Id :
                op.function2Id === graph.id ? op.function1Id : null;
            return otherId && isConstantBoundary(otherId);
        };
        const validAreas = areas.filter(op => matchesBoundary(op) &&
            Number(op.fillOpacity ?? 0.2) > 0 &&
            Number.isFinite(op.xMin) && Number.isFinite(op.xMax) &&
            op.xMin < op.xMax && op.xMin >= bounds.xMin - 1e-9 &&
            op.xMax <= bounds.xMax + 1e-9);
        if (!graph || !areas.length || validAreas.length !== areas.length) {
            result.addError('함수의 색칠 경계·수평선 높이 또는 구간이 요청과 다릅니다.');
            return;
        }
        let coveredUntil = bounds.xMin;
        for (const area of validAreas.sort((a, b) => a.xMin - b.xMin)) {
            if (area.xMin > coveredUntil + 1e-9) break;
            coveredUntil = Math.max(coveredUntil, area.xMax);
        }
        if (coveredUntil < bounds.xMax - 1e-9)
            result.addError('색칠한 구간이 요청한 x 범위를 모두 덮지 않습니다.');
    }

    validateExamCircleIntent(prompt, creates, result) {
        if (/원기둥|원뿔/.test(prompt)) return;
        const angle = prompt.match(/∠\s*([A-Z])([A-Z])([A-Z])\s*=\s*(\d+(?:\.\d+)?)\s*°/);
        if (!angle || !/원|부채꼴|호/.test(prompt)) return;
        const [aName, oName, bName, degrees] = [angle[1], angle[2], angle[3], Number(angle[4])];
        const byId = new Map(creates.filter(op => op.id).map(op => [op.id, op]));
        const points = Object.fromEntries(creates.filter(op => op.type === 'point' && op.label)
            .map(op => [op.label, op]));
        const [a, o, b] = [points[aName], points[oName], points[bName]];
        if ([a, o, b].some(op => !op || op.visible === false || op.showLabel === false || op.pointSize !== 0 ||
            !Number.isFinite(op.x) || !Number.isFinite(op.y))) {
            result.addError('원 문항의 중심과 호 양 끝점 이름·위치·점 표식이 잘못되었습니다.');
            return;
        }
        const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
        const radiusText = prompt.match(/반지름\s*(?:은|는|이|가)?\s*(\d+(?:\.\d+)?)\s*(?:cm|㎝)/i);
        const equalRadius = prompt.match(/([A-Z]{2})\s*=\s*([A-Z]{2})\s*=\s*(\d+(?:\.\d+)?)\s*(?:cm|㎝)/i);
        const radius = Number(radiusText?.[1] ?? equalRadius?.[3]);
        const circle = creates.find(op => op.type === 'circle' && byId.get(op.centerId)?.label === oName &&
            [aName, bName].includes(byId.get(op.pointOnCircleId)?.label));
        const radiusValid = circle && Number.isFinite(radius) &&
            Math.abs(distance(o, a) - radius) < 1e-6 && Math.abs(distance(o, b) - radius) < 1e-6;
        if (!radiusValid) result.addError('원의 중심·반지름과 호 양 끝점의 거리가 요청한 값과 다릅니다.');
        const radiusDimension = creates.some(op => {
            if (op.type !== 'lengthDimension' || op.showValue === false) return false;
            const segment = byId.get(op.segmentId);
            const endpoints = [byId.get(segment?.point1Id)?.label, byId.get(segment?.point2Id)?.label];
            return endpoints.includes(oName) && (endpoints.includes(aName) || endpoints.includes(bName)) &&
                (!op.customText || Math.abs(Number.parseFloat(op.customText) - radius) < 1e-9);
        });
        if (!radiusDimension) result.addError('반지름 수치가 해당 반지름의 점선 길이 호에 없습니다.');
        if (equalRadius) {
            const expectedEnds = new Set([[oName, aName], [oName, bName]]
                .map(names => names.sort().join('')));
            const radiusSegments = creates.filter(op => op.type === 'segment' &&
                expectedEnds.has([byId.get(op.point1Id)?.label, byId.get(op.point2Id)?.label]
                    .sort().join('')));
            const segmentIds = new Set(radiusSegments.map(op => op.id));
            if (segmentIds.size !== 2 || !creates.some(op => op.type === 'equalLengthMarker' &&
                segmentIds.has(op.segment1Id) && segmentIds.has(op.segment2Id) &&
                op.segment1Id !== op.segment2Id))
                result.addError('같은 반지름 두 선분의 동일 길이 표식이 없습니다.');
        }
        const angleMark = creates.find(op => op.type === 'angleDimension' &&
            byId.get(op.vertexId)?.label === oName &&
            [byId.get(op.point1Id)?.label, byId.get(op.point2Id)?.label].sort().join('') === [aName, bName].sort().join(''));
        const u = [a.x - o.x, a.y - o.y], v = [b.x - o.x, b.y - o.y];
        const cosine = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
        const actualDegrees = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
        if (!angleMark || angleMark.showValue === false || Math.abs(actualDegrees - degrees) > 0.5 ||
            (angleMark.customText && Math.abs(Number.parseFloat(angleMark.customText) - degrees) > 1e-9))
            result.addError('중심각 호의 꼭짓점·양 끝점·수치가 요청과 다릅니다.');
        const wantsSector = /부채꼴/.test(prompt);
        const wantsFill = wantsSector && /색칠|음영|넓이.{0,20}(?:구하|찾|계산)/.test(prompt);
        const matchingBoundary = op => op.circleId === circle?.id &&
            [byId.get(op.startPointId)?.label, byId.get(op.endPointId)?.label].sort().join('') ===
                [aName, bName].sort().join('') && op.mode !== 'major';
        if (wantsSector && !creates.some(op => op.type === 'sector' && matchingBoundary(op) &&
            (!wantsFill || op.fillOpacity === undefined || Number(op.fillOpacity) > 0)))
            result.addError('요청한 두 반지름과 짧은 호 사이의 부채꼴 색칠이 없습니다.');
        if (/호\s*[A-Z]{2}/.test(prompt) &&
            !creates.some(op => op.type === 'arc' && matchingBoundary(op)))
            result.addError('요청한 호의 시작·끝점에 연결된 호 객체가 없습니다.');
    }

    validatePdfSample(data, sampleOrCategory) {
        const category = typeof sampleOrCategory === 'string'
            ? sampleOrCategory
            : sampleOrCategory?.category;
        const operations = data?.operations || (Array.isArray(data) ? data : []);

        if (!category) {
            return ValidationResult.failure('pdf semantic validation requires a sample category.');
        }

        if (!Array.isArray(operations)) {
            return ValidationResult.failure('operations must be an array before pdf semantic validation.');
        }

        const result = ValidationResult.success();
        const context = this.buildContext(operations);

        switch (category) {
            case 'number_line_radical_construction':
                this.validateRadicalNumberLine(context, result);
                break;
            case 'parallel_lines_angle_relations':
                this.validateParallelAngles(context, result);
                break;
            case 'circle_sector_arc':
                this.validateCircleSector(context, result);
                break;
            case 'solid_rectangular_prism_and_curved_solid_gap':
                this.validateRectangularPrism(context, result);
                break;
            case 'histogram_frequency_polygon_approximation':
                this.validateHistogram(context, result);
                break;
            case 'linear_function_graph_intersection':
                this.validateLinearGraphIntersection(context, result);
                break;
            case 'triangle_incircle_and_contact_points':
                this.validateTriangleIncircle(context, result);
                break;
            case 'similarity_triangle_pair':
                this.validateSimilarityTriangles(context, result);
                break;
            case 'quadratic_function_vertex_intercepts':
                this.validateQuadraticGraph(context, result);
                break;
            case 'right_triangle_trig_ratio':
                this.validateRightTriangleTrig(context, result);
                break;
            case 'distribution_curve_function_graphs':
                this.validateDistributionCurves(context, result);
                break;
            case 'scatter_plot_approximation':
                this.validateScatterPlot(context, result);
                break;
            default:
                result.addError(`no pdf semantic validator is registered for category "${category}".`);
        }

        return result;
    }

    validateProblemDiagramIntent(data, options = {}) {
        const operations = data?.operations || (Array.isArray(data) ? data : []);
        if (!Array.isArray(operations)) {
            return ValidationResult.failure('problem diagram validation requires operations to be an array.');
        }
        if (operations.length === 0) {
            return ValidationResult.failure('problem diagram must not be empty.');
        }

        const result = ValidationResult.success();
        const ctx = this.buildContext(operations);
        const creates = ctx.creates;
        const prompt = this.text(options.prompt || options.userMessage || '');
        const visibleCreates = creates.filter(op => this.isVisibleDiagramObject(op));

        if (visibleCreates.length === 0) {
            result.addError('problem diagram must contain at least one visible non-helper object.');
        }

        const copiedText = this.extractDiagramText(creates)
            .filter(text => this.looksLikeProblemProseOrAnswerChoice(text));
        if (copiedText.length > 0) {
            result.addError(`problem diagram must not copy problem prose, solution text, or answer choices into labels: ${copiedText.slice(0, 3).join(', ')}`);
        }

        const hasGraphPrompt = /함수|그래프|좌표|좌표평면|직선|타원|쌍곡선|포물선|이차|일차|방정식|부등식|교점|접선|graph|function|line|ellipse|hyperbola|parabola|quadratic|linear|inequality|intersection|tangent/.test(prompt);
        const hasGeometryPrompt = /삼각형|사각형|다각형|도형|원|접선|반지름|지름|호|부채꼴|각|닮음|평행|수직|길이|triangle|circle|polygon|angle|similar|parallel|perpendicular|radius|diameter/.test(prompt);
        const hasNumberLinePrompt = /수직선|실수|근호|제곱근|number line|numberline|radical/.test(prompt);
        const hasSolidPrompt = /입체|직육면체|정육면체|각기둥|각뿔|원기둥|원뿔|(?:^|[\s,(])구(?=$|[\s,.)]|(?:를|을|와|과|가|이|의|안|속|내부))|solid|prism|pyramid|cube|cylinder|cone|sphere/.test(prompt);
        const hasChartPrompt = /통계|도수|히스토그램|산점도|상자그림|분포|자료|chart|histogram|scatter|box plot|statistics|frequency|distribution/.test(prompt);
        const hasPlaneGeometryPrompt = /삼각형|사각형|다각형|평면도형|원(?!기둥|뿔)|접선|반지름|지름|호|부채꼴|각|닮음|평행|수직(?!선)|triangle|circle|polygon|angle|similar|parallel|perpendicular|radius|diameter/.test(prompt);
        const hasNonTangentPlaneGeometryPrompt = /삼각형|사각형|다각형|평면도형|원(?!기둥|뿔)|반지름|지름|호|부채꼴|각|닮음|평행|수직(?!선)|triangle|circle|polygon|angle|similar|parallel|perpendicular|radius|diameter/.test(prompt);
        const effectiveGeometryPrompt = hasGeometryPrompt && hasPlaneGeometryPrompt &&
            (hasNonTangentPlaneGeometryPrompt || !hasGraphPrompt) && !(
            hasNumberLinePrompt &&
            !/삼각형|사각형|다각형|도형|원\s|접선|반지름|지름|호|부채꼴|각|닮음|평행|triangle|circle|polygon|angle|similar|parallel/.test(prompt)
        );

        if (hasGraphPrompt && !this.hasAnyType(ctx, ['function', 'ellipse', 'hyperbola', 'parabola', 'line', 'ray', 'vector', 'numberLine', 'intersection'])) {
            result.addError('graph/function problem diagram needs a graph object such as function, conic, line, ray, vector, numberLine, or intersection.');
        }
        if (effectiveGeometryPrompt && !this.hasAnyType(ctx, ['polygon', 'circle', 'circleThreePoints', 'arc', 'sector', 'circularSegment', 'lensRegion', 'segment', 'angleDimension', 'lengthDimension'])) {
            result.addError('geometry problem diagram needs geometric objects such as polygon, circle, arc/sector, segment, or markers.');
        }
        if (hasNumberLinePrompt && !this.hasAnyType(ctx, ['numberLine'])) {
            result.addError('number-line problem diagram needs a numberLine object.');
        }
        if (hasSolidPrompt && !this.hasAnyType(ctx, ['prism', 'pyramid', 'cylinder', 'cone', 'sphere', 'polygon', 'segment'])) {
            result.addError('solid problem diagram needs a supported solid approximation such as prism, pyramid, polygon, or segment.');
        }
        if (hasChartPrompt && !this.hasAnyType(ctx, ['polygon', 'point', 'segment', 'numberLine', 'line'])) {
            result.addError('statistics/chart problem diagram needs supported chart approximation objects such as polygons, points, segments, or numberLine.');
        }

        const typedPrompt = hasGraphPrompt || effectiveGeometryPrompt || hasNumberLinePrompt || hasSolidPrompt || hasChartPrompt;
        if (!typedPrompt && visibleCreates.length < 2) {
            result.addError('problem diagram needs enough visible structure to represent the problem conditions.');
        }

        this.validateLabeledCoordinateLines(ctx, result);
        this.validateRepeatedPerpendicularFunctionIntersections(ctx, result);
        this.validateSupportedProblemIntersectionPairs(ctx, result);
        this.validateParameterizedLinePointSeparation(ctx, result);
        this.validateParameterizedSourceBindings(data, ctx, result);

        return result;
    }

    validateImageCoordinateRange(data, options = {}) {
        const operations = data?.operations || (Array.isArray(data) ? data : []);
        if (!Array.isArray(operations)) {
            return ValidationResult.failure('image coordinate validation requires operations to be an array.');
        }

        const maxAbsCoordinate = Number.isFinite(options.maxAbsCoordinate)
            ? Math.abs(options.maxAbsCoordinate)
            : 20;
        const outOfViewPoints = operations.filter(operation =>
            operation?.op === 'create' &&
            operation.type === 'point' &&
            Number.isFinite(operation.x) &&
            Number.isFinite(operation.y) &&
            (Math.abs(operation.x) > maxAbsCoordinate || Math.abs(operation.y) > maxAbsCoordinate)
        );
        if (outOfViewPoints.length > 0) {
            const ids = outOfViewPoints.slice(0, 4).map(point => point.id || '(no id)').join(', ');
            return ValidationResult.failure(
                `image recreate point coordinates must stay within +/-${maxAbsCoordinate} math units for the default view; out-of-range point(s): ${ids}.`
            );
        }

        return ValidationResult.success();
    }

    validateRequestedSolidIntent(data, options = {}) {
        const operations = data?.operations || (Array.isArray(data) ? data : []);
        if (!Array.isArray(operations)) {
            return ValidationResult.failure('solid intent validation requires operations to be an array.');
        }

        const result = ValidationResult.success();
        const prompt = this.text(options.prompt || options.userMessage || options.instruction || '');
        const creates = operations.filter(operation => operation?.op === 'create');
        const requestedTypes = [
            ['cylinder', /원기둥|cylinder/],
            ['cone', /원뿔|cone/],
            ['sphere', /(?:^|[\s,(])구(?=$|[\s,.)]|(?:를|을|와|과|가|이|의|안|속|내부))|sphere/]
        ].filter(([, pattern]) => pattern.test(prompt));

        for (const [type] of requestedTypes) {
            if (!creates.some(operation => operation.type === type)) {
                result.addError(`the user explicitly requested a ${type}, but no ${type} object was created.`);
            }
        }

        const requestsSphereInsideCone =
            /원뿔.{0,16}(?:안|속|내부).{0,16}구/.test(prompt) ||
            /sphere.{0,24}(?:inside|within).{0,24}cone/.test(prompt);
        if (!requestsSphereInsideCone) {
            return result;
        }

        const cone = creates.find(operation => operation.type === 'cone');
        const sphere = creates.find(operation => operation.type === 'sphere');
        if (!cone || !sphere) {
            return result;
        }

        if (!this.isSolidBoundingBoxInside(sphere, cone)) {
            result.addError('the requested sphere must be placed completely inside the cone, with a smaller size and contained bounds.');
        }

        return result;
    }

    isSolidBoundingBoxInside(inner, outer) {
        const innerX = Number(inner?.x);
        const innerY = Number(inner?.y);
        const innerWidth = Math.abs(Number(inner?.width));
        const innerHeight = Math.abs(Number(inner?.height));
        const outerX = Number(outer?.x);
        const outerY = Number(outer?.y);
        const outerWidth = Math.abs(Number(outer?.width));
        const outerHeight = Math.abs(Number(outer?.height));
        const values = [innerX, innerY, innerWidth, innerHeight, outerX, outerY, outerWidth, outerHeight];
        if (!values.every(Number.isFinite) || innerWidth <= 0 || innerHeight <= 0 || outerWidth <= 0 || outerHeight <= 0) {
            return false;
        }

        const epsilon = 1e-6;
        return innerWidth < outerWidth &&
            innerHeight < outerHeight &&
            innerX - innerWidth / 2 >= outerX - outerWidth / 2 - epsilon &&
            innerX + innerWidth / 2 <= outerX + outerWidth / 2 + epsilon &&
            innerY - innerHeight / 2 >= outerY - outerHeight / 2 - epsilon &&
            innerY + innerHeight / 2 <= outerY + outerHeight / 2 + epsilon;
    }

    validateLabeledCoordinateLines(ctx, result) {
        for (const line of ctx.byType('line')) {
            const axis = this.coordinateLineAxis(line.label);
            if (!axis) continue;

            const a = this.getPoint(ctx, line.point1Id);
            const b = this.getPoint(ctx, line.point2Id);
            if (!a || !b) continue;

            const isAligned = axis === 'horizontal'
                ? Math.abs(a.y - b.y) <= 1e-6
                : Math.abs(a.x - b.x) <= 1e-6;
            if (!isAligned) {
                const variable = axis === 'horizontal' ? 'y' : 'x';
                result.addError(
                    'line labeled ' + variable + '=' + this.coordinateLineParameter(line.label) +
                    ' must be ' + axis + '; its defining points are not aligned.'
                );
            }
        }
    }

    coordinateLineAxis(label) {
        const normalized = String(label || '')
            .replace(/\$/g, '')
            .replace(/\\,/g, '')
            .replace(/\s+/g, '')
            .toLowerCase();
        const match = normalized.match(/^([xy])=([\p{L}])$/u);
        if (!match || match[2] === 'x' || match[2] === 'y') return null;
        return match[1] === 'y' ? 'horizontal' : 'vertical';
    }

    coordinateLineParameter(label) {
        const normalized = String(label || '').replace(/\$/g, '').replace(/\s+/g, '');
        return normalized.split('=')[1] || '?';
    }

    validateRepeatedPerpendicularFunctionIntersections(ctx, result) {
        for (const candidate of ctx.byType('intersection')) {
            const first = ctx.byId.get(candidate.object1Id);
            const second = ctx.byId.get(candidate.object2Id);
            const perpendicular = first?.type === 'perpendicular'
                ? first
                : (second?.type === 'perpendicular' ? second : null);
            const otherObject = perpendicular === first ? second : first;
            if (!perpendicular || otherObject?.type !== 'function') continue;

            const throughPoint = ctx.byId.get(perpendicular.throughPointId);
            if (throughPoint?.type !== 'intersection') continue;

            const throughParents = [throughPoint.object1Id, throughPoint.object2Id];
            if (throughParents.includes(otherObject.id)) {
                result.addError(
                    'intersection "' + (candidate.label || candidate.id || '(unnamed)') +
                    '" repeats the perpendicular through-point on the same function; use the other stated curve for a non-degenerate vertical correspondence.'
                );
            }
        }
    }

    validateSupportedProblemIntersectionPairs(ctx, result) {
        for (const intersection of ctx.byType('intersection')) {
            const first = ctx.byId.get(intersection.object1Id);
            const second = ctx.byId.get(intersection.object2Id);
            if (first?.type === 'function' && second?.type === 'function') {
                result.addError(
                    'function-function intersections are not supported by the current runtime; represent a constant horizontal relation with a two-point line or use explicit computed points.'
                );
            }
        }
    }

    validateParameterizedLinePointSeparation(ctx, result) {
        for (const line of ctx.byType('line')) {
            if (this.coordinateLineAxis(line.label) !== 'horizontal') continue;
            const a = this.getPoint(ctx, line.point1Id);
            const b = this.getPoint(ctx, line.point2Id);
            if (!a || !b || Math.abs(a.y - b.y) > 1e-6) continue;

            const namedPoints = ctx.byType('point')
                .filter(point => point.visible !== false)
                .filter(point => /^[A-Z]$/.test(String(point.label || '').trim()))
                .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
                .filter(point => Math.abs(point.y - a.y) <= 1e-6);

            for (let i = 0; i < namedPoints.length; i += 1) {
                for (let j = i + 1; j < namedPoints.length; j += 1) {
                    if (Math.abs(namedPoints[i].x - namedPoints[j].x) < 0.25) {
                        result.addError(
                            'parameter-line named points are too close to distinguish; choose a non-degenerate representative that separates them by at least 0.25 math units.'
                        );
                        return;
                    }
                }
            }
        }
    }

    validateParameterizedSourceBindings(data, ctx, result) {
        const functions = ctx.byType('function')
            .filter(operation => /x/i.test(String(operation.expression || '')));
        if (functions.length !== 2) return;

        const parameterLines = ctx.byType('line')
            .filter(line => this.coordinateLineAxis(line.label) === 'horizontal');
        if (parameterLines.length !== 1) return;
        const parameterLine = parameterLines[0];

        const namedOnParameterLine = ctx.creates
            .filter(operation => /^[A-Z]$/.test(String(operation.label || '').trim()))
            .filter(operation => {
                if (operation.type === 'intersection') {
                    return [operation.object1Id, operation.object2Id].includes(parameterLine.id);
                }
                if (operation.type !== 'point') return false;
                const linePoint = this.getPoint(ctx, parameterLine.point1Id);
                return linePoint && Number.isFinite(operation.y) && Math.abs(operation.y - linePoint.y) <= 1e-6;
            })
            .map(operation => String(operation.label).trim());
        if (namedOnParameterLine.length < 2) return;

        const bindings = Array.isArray(data?.sourceBindings) ? data.sourceBindings : [];
        for (const pointLabel of namedOnParameterLine.slice(0, 2)) {
            const binding = bindings.find(item => String(item?.pointLabel || '').trim() === pointLabel);
            const hasParameterLine = Array.isArray(binding?.onObjectLabels) &&
                binding.onObjectLabels.some(label => this.coordinateLineAxis(label) === 'horizontal');
            const hasCurve = Array.isArray(binding?.onObjectLabels) && binding.onObjectLabels.length >= 2;
            const targetLabel = String(binding?.verticalTargetLabel || '').trim();
            const targetCurve = String(binding?.verticalTargetOnObjectLabel || '').trim();
            if (!binding || !hasParameterLine || !hasCurve || !targetLabel || /^[A-Z]$/.test(targetLabel) || !targetCurve) {
                result.addError(
                    'sourceBindings must preserve each named parameter-line point, its printed curve, and its printed vertical output label and destination curve.'
                );
                return;
            }
        }
    }

    buildContext(operations) {
        const creates = operations.filter(op => op?.op === 'create');
        const byId = new Map();
        for (const op of creates) {
            if (typeof op.id === 'string' && op.id) {
                byId.set(op.id, op);
            }
        }
        return {
            operations,
            creates,
            byId,
            byType(type) {
                return creates.filter(op => op.type === type);
            }
        };
    }

    hasAnyType(ctx, types) {
        return types.some(type => ctx.byType(type).length > 0);
    }

    isVisibleDiagramObject(op) {
        if (!op || op.op !== 'create') return false;
        if (op.visible === false) return false;
        if (op.type === 'point' && Number(op.pointSize) === 0 && !op.showLabel) return false;
        return true;
    }

    extractDiagramText(operations) {
        const texts = [];
        for (const op of operations) {
            for (const field of ['label', 'customText', 'text']) {
                const value = op?.[field];
                if (typeof value === 'string' && value.trim()) {
                    texts.push(value.trim());
                }
            }
            if (Array.isArray(op?.customMarks)) {
                for (const mark of op.customMarks) {
                    if (typeof mark?.label === 'string' && mark.label.trim()) {
                        texts.push(mark.label.trim());
                    }
                }
            }
        }
        return texts;
    }

    looksLikeProblemProseOrAnswerChoice(value) {
        const raw = String(value || '').trim();
        const normalized = this.text(raw);
        if (!raw) return false;
        if (raw.length > 28) return true;
        if (/[①②③④⑤]|(?:^|\s)[1-5][).](?!\d)/.test(raw)) return true;
        if (/[ㄱㄴㄷㄹ]\s*[).]/.test(raw)) return true;
        return /다음|보기|선택지|정답|풀이|해설|구하여라|구하시오|옳은|옳지|값은|답은|문제|조건|which of|answer|solution|explanation|choose|following/.test(normalized);
    }

    validateRadicalNumberLine(ctx, result) {
        const numberLine = ctx.byType('numberLine')[0];
        if (!numberLine) {
            result.addError('radical construction requires a real numberLine object.');
            return;
        }

        const coversSqrt2 = Number.isFinite(numberLine.start) &&
            Number.isFinite(numberLine.end) &&
            numberLine.start <= 0 &&
            numberLine.end >= SQRT2;
        const hasSqrtMark = (numberLine.customMarks || []).some(mark =>
            Math.abs(Number(mark.value) - SQRT2) <= 0.08 || this.text(mark.label).includes('sqrt')
        );
        const sqrtPoint = this.points(ctx).find(point =>
            Math.abs(point.x - SQRT2) <= 0.12 &&
            Math.abs(point.y - numberLine.y) <= 0.25 &&
            /sqrt|root|2/.test(this.text(point.op.label || point.op.id))
        );
        if (!coversSqrt2 || (!hasSqrtMark && !sqrtPoint)) {
            result.addError('radical construction must place sqrt(2) on a number line at x ~= 1.414.');
        }

        if (ctx.byType('rightAngleMarker').length === 0) {
            result.addError('radical construction must include a right-angle marker for the unit right triangle.');
        }

        const hasSqrtRadiusCircle = ctx.byType('circle').some(circle => {
            const center = this.getPoint(ctx, circle.centerId);
            const edge = this.getPoint(ctx, circle.pointOnCircleId);
            return center && edge && Math.abs(this.distance(center, edge) - SQRT2) <= 0.18;
        });
        if (!hasSqrtRadiusCircle) {
            result.addError('radical construction needs a circle/arc radius equal to sqrt(2), not a unit radius.');
        }
    }

    validateParallelAngles(ctx, result) {
        const lines = ctx.byType('line').filter(line => this.getPoint(ctx, line.point1Id) && this.getPoint(ctx, line.point2Id));
        if (lines.length < 3) {
            result.addError('parallel angle relation needs two parallel lines plus a transversal line.');
            return;
        }

        let hasParallelPair = false;
        for (let i = 0; i < lines.length; i += 1) {
            for (let j = i + 1; j < lines.length; j += 1) {
                const s1 = this.slope(ctx, lines[i]);
                const s2 = this.slope(ctx, lines[j]);
                if (Number.isFinite(s1) && Number.isFinite(s2) && Math.abs(s1 - s2) <= 0.08) {
                    hasParallelPair = true;
                }
            }
        }
        if (!hasParallelPair) {
            result.addError('parallel angle relation must contain a visibly parallel line pair.');
        }
        if (ctx.byType('angleDimension').length < 2) {
            result.addError('parallel angle relation needs at least two angle markers.');
        }
    }

    validateCircleSector(ctx, result) {
        if (ctx.byType('circle').length === 0) {
            result.addError('circle sector sample requires a circle.');
        }
        if (ctx.byType('arc').length === 0) {
            result.addError('circle sector sample requires an arc object.');
        }
        if (ctx.byType('sector').length === 0) {
            result.addError('circle sector sample requires a sector object.');
        }
        if (ctx.byType('angleDimension').length === 0) {
            result.addError('circle sector sample should mark the central angle.');
        }
    }

    validateRectangularPrism(ctx, result) {
        const prism = ctx.byType('prism')[0];
        if (!prism) {
            result.addError('solid sample requires a prism object for the rectangular prism.');
            return;
        }
        if (!Array.isArray(prism.baseVertexIds) || !Array.isArray(prism.topVertexIds) ||
            prism.baseVertexIds.length < 4 || prism.topVertexIds.length !== prism.baseVertexIds.length) {
            result.addError('rectangular prism must have matching base/top vertex id arrays.');
        }
        if (ctx.byType('lengthDimension').length < 2) {
            result.addError('rectangular prism should include edge length/dimension markers.');
        }
    }

    validateHistogram(ctx, result) {
        const rectangularBars = ctx.byType('polygon').filter(polygon => this.isAxisAlignedRectangle(ctx, polygon));
        if (rectangularBars.length < 4) {
            result.addError('histogram sample needs at least four axis-aligned rectangular polygon bars.');
        }

        const frequencySegments = ctx.byType('segment').filter(segment => {
            const a = this.getPoint(ctx, segment.point1Id);
            const b = this.getPoint(ctx, segment.point2Id);
            return a && b && Math.abs(a.y - b.y) > 0.01 && a.y > 0 && b.y > 0;
        });
        if (frequencySegments.length < 3) {
            result.addError('histogram sample needs connected frequency-polygon segments through bar midpoints.');
        }
    }

    validateLinearGraphIntersection(ctx, result) {
        const graphObjects = [...ctx.byType('line'), ...ctx.byType('function')];
        if (graphObjects.length < 2) {
            result.addError('linear graph sample requires two graph lines/functions.');
        }
        if (ctx.byType('intersection').length === 0) {
            result.addError('linear graph sample requires an explicit intersection object.');
        }
    }

    validateTriangleIncircle(ctx, result) {
        const circle = ctx.byType('circle')[0];
        if (!circle) {
            result.addError('incircle sample requires a circle.');
            return;
        }

        const center = this.getPoint(ctx, circle.centerId);
        const radiusPoint = this.getPoint(ctx, circle.pointOnCircleId);
        if (!center || !radiusPoint) {
            result.addError('incircle sample requires a circle center point and point-on-circle.');
            return;
        }

        const radius = this.distance(center, radiusPoint);
        const sides = this.triangleSides(ctx);
        if (sides.length < 3) {
            result.addError('incircle sample requires a triangle boundary.');
            return;
        }

        const tangentRadiusSegments = ctx.byType('segment').filter(segment => {
            const a = this.getPoint(ctx, segment.point1Id);
            const b = this.getPoint(ctx, segment.point2Id);
            if (!a || !b) return false;
            const contact = this.samePoint(a, center) ? b : (this.samePoint(b, center) ? a : null);
            if (!contact || Math.abs(this.distance(center, contact) - radius) > 0.18) return false;
            return sides.some(side =>
                this.pointNearSegment(contact, side.a, side.b, 0.18) &&
                this.isPerpendicular(center, contact, side.a, side.b, 0.2)
            );
        });

        if (tangentRadiusSegments.length < 3) {
            result.addError('incircle contact points must lie on triangle sides with perpendicular radius segments.');
        }
    }

    validateSimilarityTriangles(ctx, result) {
        const triangles = ctx.byType('polygon').filter(op => Array.isArray(op.vertexIds) && op.vertexIds.length === 3);
        if (triangles.length < 2) {
            result.addError('similarity sample needs two triangle polygons.');
        }
        if (ctx.byType('equalLengthMarker').length === 0 && ctx.byType('angleDimension').length < 2) {
            result.addError('similarity sample should include corresponding side or angle markers.');
        }
    }

    validateQuadraticGraph(ctx, result) {
        const quadratic = ctx.byType('function').find(op => /x\s*(\^2|\*\s*x)/i.test(String(op.expression || '')));
        if (!quadratic) {
            result.addError('quadratic sample requires a function expression containing x^2.');
        }

        const vertex = this.points(ctx).find(point =>
            /v|vertex/.test(this.text(point.op.label || point.op.id)) &&
            Math.abs(point.x - 1) <= 0.25 &&
            Math.abs(point.y + 4) <= 0.35
        );
        if (!vertex) {
            result.addError('quadratic sample must mark the vertex near (1, -4).');
        }

        const symmetryLine = ctx.byType('line').some(line => {
            const a = this.getPoint(ctx, line.point1Id);
            const b = this.getPoint(ctx, line.point2Id);
            return a && b && Math.abs(a.x - 1) <= 0.15 && Math.abs(b.x - 1) <= 0.15;
        });
        if (!symmetryLine) {
            result.addError('quadratic sample must include the symmetry axis x=1.');
        }

        const hasIntersection = ctx.byType('intersection').some(op =>
            op.object1Id === quadratic?.id || op.object2Id === quadratic?.id
        );
        const hasRootPoint = this.points(ctx).some(point =>
            Math.abs(point.y) <= 0.18 && (Math.abs(point.x + 1) <= 0.35 || Math.abs(point.x - 3) <= 0.35)
        );
        if (!hasIntersection && !hasRootPoint) {
            result.addError('quadratic sample must explicitly mark at least one x-axis intersection/root.');
        }
    }

    validateRightTriangleTrig(ctx, result) {
        if (ctx.byType('rightAngleMarker').length === 0) {
            result.addError('trig sample requires a right-angle marker.');
        }
        if (ctx.byType('angleDimension').length === 0) {
            result.addError('trig sample requires an acute-angle marker.');
        }
        if (ctx.byType('lengthDimension').length < 2) {
            result.addError('trig sample should label at least two relevant side lengths.');
        }
    }

    validateDistributionCurves(ctx, result) {
        const functions = ctx.byType('function');
        if (functions.length < 2) {
            result.addError('distribution sample needs two smooth function curves, not only polygon chains.');
        }
        if (!functions.some(op => /exp|x\s*(\^2|\*\s*x)/i.test(String(op.expression || '')))) {
            result.addError('distribution sample should use bell-shaped function expressions.');
        }
    }

    validateScatterPlot(ctx, result) {
        const points = this.points(ctx).filter(point => {
            if (point.op.visible === false) return false;
            const text = this.text(point.op.label || point.op.id);
            if (/^(o|x|y)$/.test(text)) return false;
            if (/^t\d+$/.test(text)) return false;
            return true;
        });
        if (points.length < 6) {
            result.addError('scatter plot sample needs at least six plotted data points.');
            return;
        }

        const stats = this.linearFitStats(points);
        if (!stats || stats.slope <= 0) {
            result.addError('scatter plot sample should show a positive association.');
            return;
        }
        if (stats.residualMse <= 0.005 || stats.r2 >= 0.995) {
            result.addError('scatter plot points are too collinear; they should read as a scatter plot, not a line graph.');
        }
        if (ctx.byType('line').length === 0 && ctx.byType('segment').length < 3) {
            result.addError('scatter plot sample should include an approximate trend line.');
        }
    }

    triangleSides(ctx) {
        const polygon = ctx.byType('polygon').find(op => Array.isArray(op.vertexIds) && op.vertexIds.length === 3);
        const ids = polygon?.vertexIds || ['A', 'B', 'C'];
        const points = ids.map(id => this.getPoint(ctx, id)).filter(Boolean);
        if (points.length < 3) return [];
        return [
            { a: points[0], b: points[1] },
            { a: points[1], b: points[2] },
            { a: points[2], b: points[0] }
        ];
    }

    isAxisAlignedRectangle(ctx, polygon) {
        if (!Array.isArray(polygon.vertexIds) || polygon.vertexIds.length !== 4) return false;
        const points = polygon.vertexIds.map(id => this.getPoint(ctx, id));
        if (points.some(point => !point)) return false;
        const xs = this.uniqueRounded(points.map(point => point.x), 0.05);
        const ys = this.uniqueRounded(points.map(point => point.y), 0.05);
        return xs.length === 2 && ys.length === 2 &&
            Math.abs(xs[0] - xs[1]) > 0.2 &&
            Math.abs(ys[0] - ys[1]) > 0.2 &&
            Math.min(...ys) <= 0.1;
    }

    points(ctx) {
        return ctx.byType('point')
            .map(op => this.getPoint(ctx, op.id))
            .filter(Boolean);
    }

    getPoint(ctx, id) {
        if (!id) return null;
        const op = ctx.byId.get(id);
        if (!op || op.type !== 'point') return null;
        if (!Number.isFinite(op.x) || !Number.isFinite(op.y)) return null;
        return { id: op.id, x: op.x, y: op.y, op };
    }

    samePoint(a, b) {
        return a && b && a.id && b.id && a.id === b.id;
    }

    slope(ctx, line) {
        const a = this.getPoint(ctx, line.point1Id);
        const b = this.getPoint(ctx, line.point2Id);
        if (!a || !b) return NaN;
        const dx = b.x - a.x;
        if (Math.abs(dx) < 1e-6) return Number.POSITIVE_INFINITY;
        return (b.y - a.y) / dx;
    }

    distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    pointNearSegment(p, a, b, tolerance) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return this.distance(p, a) <= tolerance;
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
        if (t < -0.05 || t > 1.05) return false;
        const projection = { x: a.x + t * dx, y: a.y + t * dy };
        return this.distance(p, projection) <= tolerance;
    }

    isPerpendicular(a1, a2, b1, b2, tolerance) {
        const ux = a2.x - a1.x;
        const uy = a2.y - a1.y;
        const vx = b2.x - b1.x;
        const vy = b2.y - b1.y;
        const denom = Math.hypot(ux, uy) * Math.hypot(vx, vy);
        if (denom === 0) return false;
        return Math.abs((ux * vx + uy * vy) / denom) <= tolerance;
    }

    uniqueRounded(values, tolerance) {
        const result = [];
        for (const value of values) {
            if (!Number.isFinite(value)) continue;
            if (!result.some(existing => Math.abs(existing - value) <= tolerance)) {
                result.push(value);
            }
        }
        return result.sort((a, b) => a - b);
    }

    linearFitStats(points) {
        if (points.length < 2) return null;
        const n = points.length;
        const meanX = points.reduce((sum, point) => sum + point.x, 0) / n;
        const meanY = points.reduce((sum, point) => sum + point.y, 0) / n;
        let sxx = 0;
        let sxy = 0;
        let syy = 0;
        for (const point of points) {
            sxx += (point.x - meanX) ** 2;
            sxy += (point.x - meanX) * (point.y - meanY);
            syy += (point.y - meanY) ** 2;
        }
        if (sxx === 0 || syy === 0) return null;
        const slope = sxy / sxx;
        const intercept = meanY - slope * meanX;
        let residual = 0;
        for (const point of points) {
            residual += (point.y - (slope * point.x + intercept)) ** 2;
        }
        return {
            slope,
            residualMse: residual / n,
            r2: 1 - residual / syy
        };
    }

    text(value) {
        return String(value || '').toLowerCase();
    }
}

export default SemanticValidator;
