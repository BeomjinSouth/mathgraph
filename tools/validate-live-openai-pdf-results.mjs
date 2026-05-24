import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { IMAGE_RECREATE_OPERATION_BUDGET } from '../js/ai/AIService.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { SemanticValidator } from '../js/ai/SemanticValidator.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInput = path.join(repoRoot, 'tmp', 'live-openai-pdf-ai-samples', 'live-openai-results.json');
const inputPath = path.resolve(process.argv[2] || defaultInput);
const outputDir = path.join(repoRoot, 'tmp', 'live-openai-pdf-ai-samples');
const outputPath = path.join(outputDir, 'semantic-validation-report.json');

const validator = new SchemaValidator();
const semanticValidator = new SemanticValidator();

function payloadFor(result) {
    const payload = result.response?.payload || result.payload || null;
    if (payload?.operations) return payload;
    if (Array.isArray(result.operations)) return { operations: result.operations };
    return { operations: [] };
}

function sampleFor(result) {
    return result.sample || {
        id: result.id,
        category: result.category
    };
}

async function main() {
    const raw = JSON.parse(await readFile(inputPath, 'utf8'));
    const results = Array.isArray(raw.results) ? raw.results : raw;
    const rows = results.map(result => {
        const sample = sampleFor(result);
        const payload = payloadFor(result);
        const schema = validator.validate(payload);
        const references = validator.validateReferences(payload, new Set());
        const intent = validator.validateIntent(payload, {
            mode: 'recreate',
            maxOperations: IMAGE_RECREATE_OPERATION_BUDGET
        });
        const semantic = semanticValidator.validatePdfSample(payload, sample);
        const errors = [
            ...schema.errors,
            ...references.errors,
            ...intent.errors,
            ...semantic.errors
        ];
        return {
            id: sample.id,
            category: sample.category,
            operationCount: payload.operations.length,
            schemaValid: schema.valid,
            referencesValid: references.valid,
            intentValid: intent.valid,
            semanticValid: semantic.valid,
            valid: schema.valid && references.valid && intent.valid && semantic.valid,
            errors
        };
    });

    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, JSON.stringify({
        inputPath,
        generatedAt: new Date().toISOString(),
        operationBudget: IMAGE_RECREATE_OPERATION_BUDGET,
        total: rows.length,
        failures: rows.filter(row => !row.valid).length,
        rows
    }, null, 2), 'utf8');

    console.log(JSON.stringify({
        inputPath,
        outputPath,
        total: rows.length,
        failures: rows.filter(row => !row.valid).map(row => row.id)
    }, null, 2));

    if (rows.some(row => !row.valid)) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
