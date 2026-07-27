// tiller 오케스트레이션
// 인자 파싱 → config 분기 → 로드/메뉴/저장/플래그조립/실행을 엮는다.
// 부수효과 의존성을 주입 가능하게 하여 흐름을 단위 테스트한다.

import { load, save, SELECTION_STEPS } from './config.js';
import { buildArgs, run } from './launch.js';
import { promptSelections } from './prompt.js';

/**
 * argv(= process.argv.slice(2)) 를 받아 런처를 오케스트레이션한다.
 * - 'config' 서브커맨드: 전체 단계 메뉴를 띄워 selection 저장만 하고 종료(실행 안 함).
 * - 그 외: load → 무효 단계가 있으면 그 단계만 메뉴 → 저장 → 플래그 조립 → claude 실행.
 *   argv 전체를 claude 패스스루 인자로 넘기고, 자식 종료코드를 그대로 반환한다.
 */
export async function main(argv, deps = {}) {
  const loadConfig = deps.load ?? load;
  const saveConfig = deps.save ?? save;
  const prompt = deps.promptSelections ?? promptSelections;
  const assemble = deps.buildArgs ?? buildArgs;
  const runClaude = deps.run ?? run;

  if (argv[0] === 'config') {
    const { config } = await loadConfig();
    const selection = await prompt(config.options, config.selection, SELECTION_STEPS);
    await saveConfig(selection);
    return 0;
  }

  let { config, invalidSteps } = await loadConfig();

  if (invalidSteps.length > 0) {
    const picked = await prompt(config.options, config.selection, invalidSteps);
    config = await saveConfig({ ...config.selection, ...picked });
  }

  const args = assemble(config.selection, config.options, argv);
  return runClaude(args);
}
