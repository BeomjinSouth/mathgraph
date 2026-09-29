/**
 * scripts/build-static.mjs 역할
 * Vercel 정적 배포 산출물(dist/)을 런타임 자산 화이트리스트만으로 구성합니다.
 *
 * 배경: outputDirectory가 저장소 루트("." )였을 때는 업로드된 모든 파일이 그대로
 * 공개 정적 자산이 되어, 원격 테스트 실행에 필요한 tests/·tools/·.agents/를
 * 업로드하면 함께 서빙되는 문제가 있었습니다. 이제 업로드(소스)와 공개(산출물)를
 * 분리해, 원격 빌드는 `node --test`로 전체 스위트를 돌린 뒤 이 스크립트로
 * 런타임 자산만 dist/에 복사합니다. api/·lib/는 Vercel Functions 소스로
 * 별도로 처리되므로 정적 산출물에 포함하지 않습니다.
 */

import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packageHancom } from './package-hancom.mjs';

export const STATIC_BUILD_TARGETS = ['index.html', 'favicon.svg', 'css', 'js', 'runtime'];

const repoRoot = new URL('..', import.meta.url);
const distRoot = new URL('dist/', repoRoot);

export async function buildStaticOutput() {
    await rm(distRoot, { recursive: true, force: true });
    await mkdir(distRoot, { recursive: true });

    for (const target of STATIC_BUILD_TARGETS) {
        const source = new URL(target, repoRoot);
        const sourceStat = await stat(source);
        const destination = new URL(sourceStat.isDirectory() ? `${target}/` : target, distRoot);
        await cp(source, destination, { recursive: true, filter: path => !/[\\/](__pycache__|\.venv)([\\/]|$)/.test(path) });
    }
    await packageHancom(new URL('downloads/mathgraph-hancom.zip', distRoot));

    return distRoot;
}

const invokedDirectly = process.argv[1]
    && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
    const dist = await buildStaticOutput();
    console.log(`static build complete: ${fileURLToPath(dist)} <- [${STATIC_BUILD_TARGETS.join(', ')}]`);
}
