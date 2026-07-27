import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildArgs, run } from './launch.js';
import { defaultConfig } from './config.js';

test('buildArgs 는 selection 을 claude 플래그 배열로 조립한다', () => {
  const { options } = defaultConfig();
  const selection = { mode: 'default', model: 'opus', effort: 'high' };

  assert.deepEqual(buildArgs(selection, options), [
    '--permission-mode', 'default',
    '--model', 'opus',
    '--effort', 'high',
  ]);
});

test('buildArgs 는 flag 가 null 인 선택값(claude 기본)의 플래그를 생략한다', () => {
  const { options } = defaultConfig();
  const selection = { mode: 'default', model: null, effort: null };

  assert.deepEqual(buildArgs(selection, options), ['--permission-mode', 'default']);
});

test('buildArgs 는 mode→model→effort 순서로 조립한다', () => {
  const { options } = defaultConfig();
  const selection = { mode: 'auto', model: 'sonnet', effort: 'low' };

  assert.deepEqual(buildArgs(selection, options), [
    '--permission-mode', 'auto',
    '--model', 'sonnet',
    '--effort', 'low',
  ]);
});

test('buildArgs 는 조립한 플래그 뒤에 passthrough 인자를 그대로 붙인다', () => {
  const { options } = defaultConfig();
  const selection = { mode: 'default', model: 'opus', effort: 'high' };

  assert.deepEqual(buildArgs(selection, options, ['--resume', '프롬프트']), [
    '--permission-mode', 'default',
    '--model', 'opus',
    '--effort', 'high',
    '--resume', '프롬프트',
  ]);
});

test('buildArgs 는 일부만 기본(null)일 때 나머지 플래그와 passthrough 를 남긴다', () => {
  const { options } = defaultConfig();
  const selection = { mode: 'plan', model: null, effort: null };

  assert.deepEqual(buildArgs(selection, options, ['hello']), [
    '--permission-mode', 'plan',
    'hello',
  ]);
});

test('buildArgs 는 passthrough 를 생략하면 플래그만 반환한다', () => {
  const { options } = defaultConfig();
  const selection = { mode: 'auto', model: 'haiku', effort: 'max' };

  assert.deepEqual(buildArgs(selection, options), [
    '--permission-mode', 'auto',
    '--model', 'haiku',
    '--effort', 'max',
  ]);
});

test('run 은 자식 프로세스의 종료코드를 그대로 반환한다', async () => {
  const code = await run(['-e', 'process.exit(3)'], { command: process.execPath });

  assert.equal(code, 3);
});

test('run 은 자식이 정상 종료하면 0 을 반환한다', async () => {
  const code = await run(['-e', ''], { command: process.execPath });

  assert.equal(code, 0);
});

test('run 은 명령을 찾지 못하면(ENOENT) 안내 후 127 을 반환한다', async () => {
  const messages = [];

  const code = await run([], {
    command: 'tiller-no-such-binary-xyz',
    logError: (m) => messages.push(m),
  });

  assert.equal(code, 127);
  assert.match(messages.join('\n'), /찾을 수 없/);
});
