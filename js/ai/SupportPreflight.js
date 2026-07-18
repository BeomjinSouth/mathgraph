const SUPPORTED_FAMILIES = [
    ['cylinder', /원기둥|cylinder/i],
    ['cone', /원뿔|cone/i],
    ['sphere', /(?:^|\s)구(?:$|\s|와|과|를|을)|sphere/i],
    ['textLabel', /설명문|주석|텍스트|조건|annotation|text\s*label/i],
    ['numberLine', /수직선|number\s*line/i],
    ['function', /함수|그래프|function|graph/i],
    ['prism', /각기둥|직육면체|정육면체|prism|cuboid|cube/i],
    ['pyramid', /각뿔|pyramid/i]
];

const APPROXIMATED_FAMILIES = [
    ['annularSector', /고리\s*부채꼴|환형\s*부채꼴|annular\s*sector/i]
];

const EXCLUDED_FAMILIES = [
    ['barChart', /막대\s*(?:그래프|도표)|bar\s*chart/i],
    ['pieChart', /원\s*(?:그래프|도표)|파이\s*(?:그래프|차트)|pie\s*chart/i],
    ['boxPlot', /상자\s*(?:수염\s*)?그림|상자그림|box\s*plot/i],
    ['scatterPlot', /산점도|scatter\s*plot/i],
    ['histogram', /히스토그램|histogram/i],
    ['frequencyPolygon', /도수분포다각형|frequency\s*polygon/i],
    ['dotPlot', /점도표|dot\s*plot/i]
];

const FAMILY_LABELS = Object.freeze({
    annularSector: '고리 부채꼴',
    barChart: '막대그래프',
    boxPlot: '상자그림',
    dotPlot: '점도표',
    frequencyPolygon: '도수분포다각형',
    histogram: '히스토그램',
    pieChart: '원그래프',
    scatterPlot: '산점도'
});

function formatFamilyLabels(ids = []) {
    return ids
        .map((id) => FAMILY_LABELS[id] || id)
        .join(', ');
}

function collectMatches(text, definitions) {
    return definitions
        .filter(([, pattern]) => pattern.test(text))
        .map(([id]) => id);
}

export function analyzeDrawingSupport(input = '') {
    const text = String(input || '').trim();
    const supported = collectMatches(text, SUPPORTED_FAMILIES);
    const approximated = collectMatches(text, APPROXIMATED_FAMILIES);
    const excluded = collectMatches(text, EXCLUDED_FAMILIES);

    if (excluded.length > 0) {
        return {
            status: 'excluded',
            supported,
            approximated,
            excluded,
            message: `현재 전용 기능으로 지원하지 않는 항목이 있습니다: ${formatFamilyLabels(excluded)}.`
        };
    }

    if (approximated.length > 0) {
        return {
            status: 'approximated',
            supported,
            approximated,
            excluded,
            message: `일부 항목은 현재 도형 조합으로 근사해 생성합니다: ${formatFamilyLabels(approximated)}.`
        };
    }

    if (supported.length > 0) {
        return {
            status: 'supported',
            supported,
            approximated,
            excluded,
            message: '요청한 그림을 전용 도형으로 생성할 수 있습니다.'
        };
    }

    return {
        status: 'unknown',
        supported,
        approximated,
        excluded,
        message: '요청을 분석한 뒤 지원 가능한 도형으로 생성합니다.'
    };
}

export default analyzeDrawingSupport;
