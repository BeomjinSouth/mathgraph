import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { SemanticValidator } from '../js/ai/SemanticValidator.js';

const samples = JSON.parse(
    readFileSync(new URL('./fixtures/pdf-ai-drawing-samples.json', import.meta.url), 'utf8')
);

test('PDF-derived AI drawing samples use non-overlapping categories', () => {
    const categories = samples.map(sample => sample.category);
    assert.equal(new Set(categories).size, categories.length);
});

test('PDF-derived AI drawing samples validate against GraphA operations schema', () => {
    const validator = new SchemaValidator();

    for (const sample of samples) {
        const payload = { operations: sample.operations };
        const validation = validator.validate(payload);
        assert.equal(validation.valid, true, `${sample.id}: ${validation.errors.join('; ')}`);

        const references = validator.validateReferences(payload, new Set());
        assert.equal(references.valid, true, `${sample.id}: ${references.errors.join('; ')}`);
    }
});

test('PDF-derived AI drawing samples pass category semantic checks', () => {
    const semanticValidator = new SemanticValidator();

    for (const sample of samples) {
        const semantic = semanticValidator.validatePdfSample(
            { operations: sample.operations },
            sample
        );
        assert.equal(semantic.valid, true, `${sample.id}: ${semantic.errors.join('; ')}`);
    }
});

test('PDF-derived AI drawing samples cover the requested textbook families', () => {
    const categories = new Set(samples.map(sample => sample.category));

    for (const expected of [
        'number_line_radical_construction',
        'parallel_lines_angle_relations',
        'circle_sector_arc',
        'solid_rectangular_prism_and_curved_solid_gap',
        'histogram_frequency_polygon_approximation',
        'linear_function_graph_intersection',
        'quadratic_function_vertex_intercepts',
        'right_triangle_trig_ratio',
        'distribution_curve_function_graphs',
        'scatter_plot_approximation'
    ]) {
        assert.equal(categories.has(expected), true, `missing category ${expected}`);
    }
});
