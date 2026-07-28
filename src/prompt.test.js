import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toChoices, promptSelections } from './prompt.js';
import { defaultConfig } from './config.js';

test('toChoices 는 options 를 inquirer select choices(name/value)로 변환한다', () => {
  const stepOptions = [
    { label: 'Manual', flag: 'manual' },
    { label: '(claude 기본)', flag: null },
  ];

  assert.deepEqual(toChoices(stepOptions), [
    { name: 'Manual', value: 'manual' },
    { name: '(claude 기본)', value: null },
  ]);
});

test('promptSelections 는 steps 순서대로 select 를 호출해 결과를 모은다', async () => {
  const { options } = defaultConfig();
  const calls = [];
  const fakeSelect = async ({ choices, default: def }) => {
    calls.push({ choicesLen: choices.length, def });
    return choices[0].value; // 각 단계의 첫 항목을 고른 것처럼
  };

  const result = await promptSelections(
    options,
    { mode: 'auto', model: 'sonnet', effort: 'low' },
    ['mode', 'model', 'effort'],
    { select: fakeSelect },
  );

  // 각 단계 첫 항목은 모두 '(claude 기본)' = null
  assert.deepEqual(result, { mode: null, model: null, effort: null });
  assert.equal(calls.length, 3);
  // 현재 저장값이 select 의 default(커서 위치)로 전달됐는지
  assert.deepEqual(calls.map((c) => c.def), ['auto', 'sonnet', 'low']);
});

test('promptSelections 는 주어진 steps 만 처리한다', async () => {
  const { options } = defaultConfig();
  const fakeSelect = async ({ choices }) => choices[1].value; // 둘째 항목

  const result = await promptSelections(options, {}, ['model'], { select: fakeSelect });

  assert.deepEqual(result, { model: 'opus' }); // model 둘째 = opus
});
