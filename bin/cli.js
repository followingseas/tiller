#!/usr/bin/env node

// tiller 진입점 — 저장한 model/permission-mode/effort 를 얹어 claude 를 실행한다.
// 실제 오케스트레이션은 src/cli.js 의 main 에 있다(인자 파싱·config 분기·실행).

import { main } from '../src/cli.js';

const code = await main(process.argv.slice(2));
process.exit(code);
