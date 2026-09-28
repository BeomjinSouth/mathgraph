import { CURRICULUM_TYPES, CHART_KINDS, NET_KINDS, CURRICULUM_FIELDS, validateCurriculumDiagram } from '../objects/CurriculumDiagram.js';
import { readConstant } from './FunctionAreaIntent.js';
import { parseSetExpression } from '../objects/VennGeometry.js';

const nullableNumber = { type: ['number', 'null'] };
const numberArray = { type: ['array', 'null'], items: { type: 'number' } };
export const CURRICULUM_SCHEMA_PROPERTIES = {
    chartKind: { type: ['string', 'null'], enum: [...CHART_KINDS, null] },
    netKind: { type: ['string', 'null'], enum: [...NET_KINDS, null] },
    dataValues: numberArray, dataX: numberArray, dataY: numberArray, binEdges: numberArray,
    dataLabels: { type: ['array', 'null'], items: { type: 'string' } },
    depth: nullableNumber, sideCount: nullableNumber, radius: nullableNumber,
    innerRadius: nullableNumber, startAngle: nullableNumber, sweepAngle: nullableNumber,
    showMeasurements: { type: ['boolean', 'null'] }, setCount: nullableNumber, setExpression: { type: ['string', 'null'] },
    mean: nullableNumber, standardDeviation: nullableNumber
};
export const CURRICULUM_PROMPT = `
Additional editable objects:
- vennDiagram: x,y,width,height,setCount (2 or 3), setExpression (empty = outlines only). Exact circular Boolean shading; expressions use A/B/C/U, ∩, ∪, -, !, complement apostrophe, and parentheses. Use only A/B for setCount=2.
- statisticalChart: x,y,width,height,chartKind. chartKind is bar/pie/histogram/frequencyPolygon/boxPlot/dotPlot/scatter/line.
  Use dataValues from the user's actual data; dataLabels for category labels; histogram/frequencyPolygon require increasing binEdges (one more than dataValues).
  Unequal-width histogram bins are plotted with frequency density automatically. boxPlot dataValues are exactly [minimum,Q1,median,Q3,maximum]; do not invent quartiles.
  scatter uses equal-length dataX and dataY. Never fabricate missing data. All chart labels and values remain editable.
  discrete plots a probability mass function with stems and markers, dataLabels giving the random-variable values.
  normal requires mean and standardDeviation > 0, no dataValues. Optional xMin and xMax shade a finite probability interval. Axes are independently scaled and show true numeric density ticks.
- annularSector: x,y,radius,innerRadius,startAngle,sweepAngle. Angles are DEGREES, counterclockwise from +x. 0 <= innerRadius < radius, 0 < sweepAngle <= 360. Has a real transparent inner hole.
- solidNet: x,y,netKind,width,height. cube uses width as side; cuboid also needs depth. cylinder/cone also need radius; cone height means slant height, NOT vertical height.
  prism/pyramid represent REGULAR bases and need sideCount (3..12), width (base edge), height (prism height / pyramid face slant height). Shared fold edges are dashed.
  Use solidNet only for a net request, not a solid projection. No arbitrary polyhedron nets, sphere net or animated folding.
  Set showMeasurements:true when the user asks to label the net's lengths; geometry alone does not fulfill a measurement-label request.
For compact scenes, use these same kinds; numbers=[x,y,width,height], and text is a JSON object containing the remaining fields above. For annularSector put its radius/innerRadius/startAngle/sweepAngle in text.
`;

const N = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const chartPatterns = [
    ['histogram', /히스토그램|histogram/i], ['frequencyPolygon', /도수\s*분포\s*다각형|frequency\s*polygon/i],
    ['boxPlot', /상자\s*(?:수염\s*)?그림|box\s*plot/i], ['dotPlot', /점\s*도표|dot\s*plot/i],
    ['scatter', /산점도|scatter\s*plot/i], ['bar', /막대\s*(?:그래프|도표)|bar\s*chart/i],
    ['pie', /원\s*(?:그래프|도표)|파이\s*(?:차트|그래프)|pie\s*chart/i], ['line', /꺾은선\s*그래프|line\s*chart/i]
];
export function readChartKinds(text) { return chartPatterns.filter(([, pattern]) => pattern.test(text)).map(([kind]) => kind); }
function list(text, names) {
    const match = text.match(new RegExp(`(?:${names})\\s*(?:은|는|이|가)?\\s*[:=]?\\s*\\[([^\\]]*)\\]`, 'i')) ||
        text.match(new RegExp(`(?:${names})\\s*(?:은|는|이|가)?\\s*[:=]?\\s*(${N}(?:\\s*,\\s*${N})+)`, 'i'));
    if (!match) return undefined;
    const tokens = match[1].trim().split(/[,;\s]+/).filter(Boolean);
    return tokens.map(token => readConstant(token) ?? NaN);
}
function scalar(text, names) {
    const match = text.match(new RegExp(`(?:${names})(?:의)?\\s*(?:길이)?\\s*(?:은|는|이|가)?\\s*[:=]?\\s*(${N}(?:\\s*/\\s*${N})?)(?![\\d./eE])`, 'i'));
    return match ? (readConstant(match[1]) ?? NaN) : undefined;
}
const fail = message => ({ error: `수학 그림 요청: ${message}` });
const sideCounts = { 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9, 십: 10, 십일: 11, 십이: 12 };

export function buildCurriculumOperations(input) {
    const text = String(input || '').replace(/ᶜ/g, '^c').normalize('NFKC');
    // A selected object edit belongs to the patch path, not to a fresh diagram.
    if (/바꿔|변경|수정|옮겨|이동|지워|삭제/.test(text)) return null;
    const kinds = readChartKinds(text);
    const netMatches = [...text.matchAll(/정육면체|직육면체|원기둥|원뿔|(?:정?[가-힣]*각기둥)|(?:정?[가-힣]*각뿔)/g)];
    if ((kinds.length || /전개도|고리\s*(?:모양\s*)?부채꼴|환형\s*부채꼴/.test(text)) &&
        (/\by\s*=|\bf\s*\(x\)|\bg\s*\(x\)/i.test(text) || (/전개도/.test(text) && netMatches.length > 1)))
        return fail('서로 다른 그림을 함께 요청했습니다. 종류별로 요청을 나누어 입력하세요.');
    let op;
    if (/벤\s*(?:다이어그램|다이아그램)|venn/i.test(text)) {
        if (/네\s*집합|[4-9]\s*집합|\bD\b/.test(text)) return fail('이 벤 다이어그램은 두 집합 또는 세 집합을 지원합니다.');
        if (/⊂|⊆|부분집합|포함\s*관계|서로소|겹치지|[ABC]\s*=\s*[ABC]|[ABC].{0,5}[ABC].{0,5}포함/.test(text)) return fail('이 벤 다이어그램은 서로 겹치는 두 집합 또는 세 집합의 연산을 지원합니다. 포함관계나 서로소 배치는 별도로 구성해야 합니다.');
        const setCount = /세\s*집합|3\s*집합|\bC\b/.test(text) ? 3 : 2;
        const explicit = text.match(/(?:음영식|집합식)\s*[:=]\s*([ABC U!()∩∪&|\-^c'\\]+)/);
        const inline = text.match(/([ABC!(][ABC U!()∩∪&|\-^c'\\]*[∩∪&|\-^c'\\][ABC U!()∩∪&|\-^c'\\]*)/);
        let setExpression = (explicit?.[1] || inline?.[1] || '').trim();
        if (!setExpression && [...text.matchAll(/교집합|합집합|차집합|여집합/g)].length > 1)
            return fail('여러 집합 연산은 음영식: A∩(!B)처럼 식으로 적어 주세요.');
        const complement = text.match(/([ABC])\s*(?:의)?\s*여집합/);
        if (!setExpression && complement) setExpression = complement[1];
        if (!setExpression && /교집합/.test(text)) setExpression = setCount === 3 ? 'A&B&C' : 'A&B';
        if (!setExpression && /합집합/.test(text)) setExpression = setCount === 3 ? 'A|B|C' : 'A|B';
        if (!setExpression && /차집합/.test(text)) {
            const operands = text.match(/([ABC])\s*에서\s*([ABC])/) || text.match(/([ABC])\s*(?:와|과|,)\s*([ABC])/);
            if (!operands) return fail('차집합의 순서를 A-B 또는 B-A로 지정하세요.');
            setExpression = `${operands[1]}-${operands[2]}`;
        }
        if (setExpression && /여집합/.test(text) && !/[!'^]/.test(setExpression)) setExpression = `!(${setExpression})`;
        if (!setExpression && /음영|색칠|칠해|여집합/.test(text)) return fail('색칠할 집합식을 A∩B 또는 A-B처럼 적어 주세요.');
        op = { type: 'vennDiagram', x: -5, y: -3, width: 10, height: 6, setCount, setExpression };
    } else if (kinds.length) {
        if (kinds.length > 1) return fail('그림 종류별로 자료를 나누어 요청해 주세요.');
        const kind = kinds[0];
        op = { type: 'statisticalChart', x: -5, y: -3, width: 10, height: 6, chartKind: kind };
        if (kind === 'pie') { op.x = 0; op.y = 0; }
        op.dataValues = list(text, '자료|값|도수|비율|빈도|다섯\\s*수치|요약|data|values');
        op.binEdges = list(text, '계급\\s*경계|경계|bins');
        const labelMatch = text.match(/(?:항목|이름|labels)\s*[:=]?\s*\[([^\]]*)\]/i);
        if (labelMatch) op.dataLabels = labelMatch[1].split(/[,;]/).map(v => v.trim().replace(/^['"]|['"]$/g, ''));
        if (kind === 'scatter') {
            op.dataX = list(text, '\\bx(?:자료)?'); op.dataY = list(text, '\\by(?:자료)?');
            if (!op.dataX || !op.dataY) {
                const pairs = [...text.matchAll(new RegExp(`\\(\\s*(${N})\\s*,\\s*(${N})\\s*\\)`, 'g'))];
                if (pairs.length) { op.dataX = pairs.map(p => Number(p[1])); op.dataY = pairs.map(p => Number(p[2])); }
            }
        } else if (!op.dataValues) {
            const pairs = [...text.matchAll(new RegExp(`([가-힣A-Za-z][가-힣A-Za-z0-9]*)\\s*[:=]\\s*(${N})(?![\\d.])`, 'g'))];
            if (['bar', 'pie', 'line'].includes(kind) && pairs.length) {
                op.dataLabels = pairs.map(p => p[1]); op.dataValues = pairs.map(p => Number(p[2]));
            } else if (kind === 'boxPlot') {
                op.dataValues = [scalar(text, '최솟값|최소'), scalar(text, '제?1사분위수|Q1'), scalar(text, '중앙값|중앙'), scalar(text, '제?3사분위수|Q3'), scalar(text, '최댓값|최대')];
            }
        }
        if (!op.dataValues && kind !== 'scatter') return fail('자료를 [2, 4, 6]처럼 입력하세요. 히스토그램에는 계급 경계도 필요합니다.');
    } else if (/고리\s*(?:모양\s*)?부채꼴|환형\s*부채꼴|annular\s*sector|고리\s*영역/.test(text)) {
        const radius = scalar(text, '바깥(?:쪽)?\\s*반지름|외반지름|외경\\s*반지름');
        const innerRadius = scalar(text, '안(?:쪽)?\\s*반지름|내반지름');
        const sweepAngle = scalar(text, '중심각|각도');
        op = { type: 'annularSector', x: 0, y: 0, radius, innerRadius, startAngle: scalar(text, '시작각') ?? 0, sweepAngle: sweepAngle ?? (/고리\s*영역/.test(text) ? 360 : undefined) };
    } else if (/전개도|\bnet\b/i.test(text)) {
        let netKind;
        if (/정육면체|cube/i.test(text)) netKind = 'cube';
        else if (/직육면체|cuboid/i.test(text)) netKind = 'cuboid';
        else if (/원기둥|cylinder/i.test(text)) netKind = 'cylinder';
        else if (/원뿔|cone/i.test(text)) netKind = 'cone';
        else if (/각기둥|prism/i.test(text)) netKind = 'prism';
        else if (/각뿔|pyramid/i.test(text)) netKind = 'pyramid';
        else return fail('정육면체·직육면체·원기둥·원뿔·정각기둥·정각뿔의 전개도를 지원합니다. 구의 정확한 평면 전개도는 만들 수 없습니다.');
        const width = scalar(text, '한\\s*변|밑면(?:의)?\\s*변|가로|밑변|변의\\s*길이');
        let height = scalar(text, '높이');
        const radius = scalar(text, '반지름');
        if (netKind === 'cone') {
            const slant = scalar(text, '모선(?:의)?\\s*길이|모선');
            if (slant !== undefined && height !== undefined && Number.isFinite(radius) &&
                Math.abs(slant * slant - radius * radius - height * height) > 1e-7)
                return fail('원뿔의 반지름·높이·모선이 서로 맞지 않습니다. 모선²=반지름²+높이²인지 확인하세요.');
            height = slant ?? (Number.isFinite(radius) && height > 0 ? Math.hypot(radius, height) : undefined);
        }
        if (netKind === 'pyramid') height = scalar(text, '옆면(?:의)?\\s*높이|빗높이');
        const namedSides = text.match(/정?(십이|십일|십|삼|사|오|육|칠|팔|구)각(?:기둥|뿔)/);
        op = { type: 'solidNet', x: 0, y: 0, netKind, width: width ?? (['cone', 'cylinder'].includes(netKind) ? 2 * radius : undefined),
            height: netKind === 'cube' ? width : height, radius, depth: scalar(text, '세로|깊이'),
            sideCount: namedSides ? sideCounts[namedSides[1]] : scalar(text, '변\\s*수') };
        if (['prism', 'pyramid'].includes(netKind) && !/정|regular/i.test(text)) return fail('이 전개도에는 정다각형 밑면의 한 변 길이와 입체 또는 옆면의 높이가 필요합니다.');
    } else return null;
    const center = text.match(new RegExp(`(?:중심|위치|원점)\\s*(?:은|는|이|가)?\\s*\\(\\s*(${N})\\s*,\\s*(${N})\\s*\\)`));
    if (center) { op.x = Number(center[1]); op.y = Number(center[2]); }
    if (/치수|길이.{0,8}표시/.test(text) && op.type === 'solidNet') op.showMeasurements = true;
    op = Object.fromEntries(Object.entries(op).filter(([, value]) => value !== undefined));
    const errors = validateCurriculumDiagram(op);
    if (errors.length) return fail(errors.join(' '));
    return { operations: [{ op: 'create', id: 'curriculum_1', ...op }] };
}

export function validateCurriculumIntent(data, prompt = '') {
    const expected = buildCurriculumOperations(prompt);
    if (!expected) return [];
    if (expected.error) return [expected.error];
    const operations = data?.operations || [];
    const want = expected.operations[0];
    const found = operations.filter(op => op.op === 'create' && op.type === want.type);
    const keys = want.type === 'vennDiagram' ? ['setCount', 'setExpression'] : want.type === 'statisticalChart' ? ['chartKind', 'dataValues', 'dataLabels', 'dataX', 'dataY', 'binEdges']
        : want.type === 'solidNet' ? ['netKind', 'width', 'height', 'depth', 'sideCount', 'radius', 'showMeasurements']
            : ['radius', 'innerRadius', 'startAngle', 'sweepAngle'];
    if (/(?:중심|위치|원점)\s*(?:은|는|이|가)?\s*\(/.test(prompt)) keys.push('x', 'y');
    const equal = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a)) : JSON.stringify(a) === JSON.stringify(b);
    return found.some(op => keys.every(key => {
        if (key === 'setExpression') {
            try {
                const a = parseSetExpression(want[key], want.setCount), b = parseSetExpression(op[key], want.setCount);
                return Array.from({ length: 1 << want.setCount }, (_, i) => [Boolean(i & 1), Boolean(i & 2), Boolean(i & 4)])
                    .every(bits => a(bits) === b(bits));
            } catch { return false; }
        }
        return want[key] === undefined || equal(want[key], op[key]);
    })) ? [] : ['요청한 그림의 종류·자료·치수가 결과와 다릅니다.'];
}

export function compileCurriculumNode(node, type) {
    let parameters = {};
    if (node.text?.trim()) {
        try { parameters = JSON.parse(node.text); } catch { throw new Error('통계·전개도 장면의 text에는 자료 JSON이 필요합니다.'); }
    }
    const allowed = [...CURRICULUM_FIELDS, 'width', 'height', 'x', 'y'];
    parameters = Object.fromEntries(Object.entries(parameters).filter(([key]) => allowed.includes(key)));
    const op = { type, x: node.numbers?.[0] ?? 0, y: node.numbers?.[1] ?? 0,
        width: node.numbers?.[2] ?? 10, height: node.numbers?.[3] ?? 6, ...parameters };
    for (const key of allowed) if (node[key] !== undefined) op[key] = node[key];
    return op;
}

export { CURRICULUM_TYPES };
