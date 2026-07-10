import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getPhysicalExportPlan,
    TEACHER_EXPORT_PRESETS
} from '../js/utils/TeacherExport.js';

test('80 mm at 300 dpi produces a 945 pixel wide export', () => {
    const plan = getPhysicalExportPlan({
        widthMm: 80,
        dpi: 300,
        sourceWidth: 1600,
        sourceHeight: 900
    });

    assert.equal(plan.width, 945);
    assert.equal(plan.height, 532);
    assert.equal(plan.scale, 945 / 1600);
    assert.equal(TEACHER_EXPORT_PRESETS.hwpCompact.label, 'HWP용 · 80 mm · 300 dpi');
});

test('physical export rejects an unsafe pixel budget', () => {
    assert.throws(
        () => getPhysicalExportPlan({
            widthMm: 1000,
            dpi: 1200,
            sourceWidth: 1600,
            sourceHeight: 900,
            maxPixels: 20_000_000
        }),
        /내보내기 크기가 너무 큽니다/
    );
});

test('physical export rejects invalid values', () => {
    assert.throws(
        () => getPhysicalExportPlan({
            widthMm: 0,
            dpi: 300,
            sourceWidth: 1600,
            sourceHeight: 900
        }),
        /올바른 출력 크기와 DPI/
    );
});
