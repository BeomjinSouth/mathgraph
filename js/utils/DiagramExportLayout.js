// Work in logical pixels. A summed-area table handles lines and curves alike.
export function createInkMap({ data, width, height }) {
    const stride = width + 1;
    const sums = new Uint32Array(stride * (height + 1));
    let left = width, top = height, right = 0, bottom = 0;
    for (let y = 0; y < height; y++) {
        let row = 0;
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const ink = data[i + 3] > 20 && Math.min(data[i], data[i + 1], data[i + 2]) < 235;
            if (ink) {
                row++;
                left = Math.min(left, x); top = Math.min(top, y);
                right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
            }
            sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row;
        }
    }
    return {
        bounds: right > left ? { x: left, y: top, width: right - left, height: bottom - top } : null,
        count(box) {
            const x1 = Math.max(0, Math.min(width, Math.floor(box.x)));
            const y1 = Math.max(0, Math.min(height, Math.floor(box.y)));
            const x2 = Math.max(0, Math.min(width, Math.ceil(box.x + box.width)));
            const y2 = Math.max(0, Math.min(height, Math.ceil(box.y + box.height)));
            if (x2 <= x1 || y2 <= y1) return 0;
            return sums[y2 * stride + x2] - sums[y1 * stride + x2] - sums[y2 * stride + x1] + sums[y1 * stride + x1];
        }
    };
}

const expand = (box, gap) => ({ x: box.x - gap, y: box.y - gap, width: box.width + gap * 2, height: box.height + gap * 2 });
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export function layoutDiagramLabels(ink, labels, { width, height }) {
    const placed = [];
    for (const label of labels) {
        // Native equation controls exceed the canvas glyph metrics.
        const boxWidth = Math.max(label.width * 1.25, label.fontSize * .75);
        const boxHeight = Math.max(label.height || 0, label.fontSize * 1.35);
        const gap = Math.max(3, label.fontSize * .3);
        const candidates = [{ x: label.x, y: label.y }];
        for (let ring = 1; ring <= 8; ring++) {
            const radius = ring * label.fontSize * .5;
            for (let direction = 0; direction < 16; direction++) {
                const angle = direction * Math.PI / 8;
                candidates.push({ x: label.x + Math.cos(angle) * radius, y: label.y + Math.sin(angle) * radius });
            }
        }
        let selected;
        for (const candidate of candidates) {
            const box = { x: candidate.x, y: candidate.y, width: boxWidth, height: boxHeight };
            const padded = expand(box, gap);
            if (box.x < 0 || box.y < 0 || box.x + box.width > width || box.y + box.height > height) continue;
            if (ink.count(padded) || placed.some(other => overlaps(padded, other.box))) continue;
            selected = { ...label, x: box.x, y: box.y, box };
            break;
        }
        if (!selected) throw new Error('그림의 글자가 너무 촘촘합니다. 겹친 라벨을 조금 옮긴 뒤 한글에 넣어 주세요.');
        placed.push(selected);
    }
    const boxes = [...(ink.bounds ? [ink.bounds] : []), ...placed.map(label => label.box)];
    if (!boxes.length) throw new Error('출력할 그림이 없습니다. 작업판에서 그림이 보이는지 확인해 주세요.');
    const margin = Math.max(5, ...labels.map(label => label.fontSize * .4));
    const x = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.x)) - margin));
    const y = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.y)) - margin));
    const right = Math.min(width, Math.ceil(Math.max(...boxes.map(box => box.x + box.width)) + margin));
    const bottom = Math.min(height, Math.ceil(Math.max(...boxes.map(box => box.y + box.height)) + margin));
    return { crop: { x, y, width: right - x, height: bottom - y }, labels: placed };
}
