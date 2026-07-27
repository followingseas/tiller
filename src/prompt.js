// tiller 메뉴 모듈
// @inquirer/prompts 의 select 로 mode→model→effort 3단계를 표시한다.
// 로직은 config/launch 에 두고 이 파일은 얇게 유지한다.

import { select } from '@inquirer/prompts';

// 각 단계에 표시할 메뉴 메시지.
const MESSAGES = {
  mode: 'permission mode 를 선택하세요',
  model: 'model 을 선택하세요',
  effort: 'effort 를 선택하세요',
};

/**
 * options[step] 배열을 inquirer select 의 choices(name/value) 로 변환한다.
 * label 은 화면에 표시되는 name, flag 는 선택 시 반환되는 value 가 된다
 * (flag 가 null 인 '(claude 기본)' 항목도 그대로 보존).
 */
export function toChoices(stepOptions) {
  return stepOptions.map((opt) => ({ name: opt.label, value: opt.flag }));
}

/**
 * 주어진 steps 에 대해 select 메뉴를 순서대로 띄워 선택값을 모은다.
 * current[step] 을 select 의 default(커서 위치)로 넘겨 재설정 시 현재값을 가리킨다.
 * select 는 주입 가능하게 하여(기본 @inquirer/prompts) 흐름 로직을 테스트한다.
 */
export async function promptSelections(options, current, steps, deps = {}) {
  const ask = deps.select ?? select;
  const result = {};

  for (const step of steps) {
    result[step] = await ask({
      message: MESSAGES[step],
      choices: toChoices(options[step]),
      default: current?.[step],
    });
  }

  return result;
}
