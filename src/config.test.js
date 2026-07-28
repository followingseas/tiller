import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  defaultConfig,
  load,
  mergeSelection,
  migrateLegacyPermissionMode,
  parseConfig,
  resolveConfigPath,
  resolveLegacyConfigPath,
  save,
  validateSelection,
} from './config.js';

// 구 permission mode 플래그(`default`)를 담은 설정 — 마이그레이션 테스트용 고정물.
function legacyModeConfig() {
  return {
    version: 1,
    options: {
      mode: [
        { label: 'Default', flag: 'default' },
        { label: 'Auto', flag: 'auto' },
      ],
      model: [{ label: 'Opus', flag: 'opus' }],
      effort: [{ label: 'high', flag: 'high' }],
    },
    selection: { mode: 'default', model: 'opus', effort: 'high' },
  };
}

// 격리된 임시 디렉토리에 config 경로(신규·레거시)를 만들어 fn 에 넘기고, 끝나면 정리한다.
// 레거시 경로를 함께 주입해 테스트가 실제 ~/.config/clauncher 를 읽는 일을 막는다.
async function withTmpConfig(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiller-test-'));
  try {
    return await fn(path.join(dir, 'config.json'), path.join(dir, 'legacy-config.json'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('defaultConfig 는 version 1 과 기본 selection 을 반환한다', () => {
  const config = defaultConfig();

  assert.equal(config.version, 1);
  assert.deepEqual(config.selection, {
    mode: 'manual',
    model: 'opus',
    effort: 'high',
  });
});

test('defaultConfig 의 options 는 설계 스키마와 일치한다', () => {
  const { options } = defaultConfig();

  assert.deepEqual(options.mode, [
    { label: '(claude 기본)', flag: null },
    { label: 'Manual', flag: 'manual' },
    { label: 'Auto', flag: 'auto' },
    { label: 'Plan', flag: 'plan' },
    { label: 'Accept Edits', flag: 'acceptEdits' },
    { label: 'Bypass Permissions', flag: 'bypassPermissions' },
    { label: "Don't Ask", flag: 'dontAsk' },
  ]);

  assert.deepEqual(options.model, [
    { label: '(claude 기본)', flag: null },
    { label: 'Opus', flag: 'opus' },
    { label: 'Sonnet', flag: 'sonnet' },
    { label: 'Haiku', flag: 'haiku' },
    { label: 'Fable', flag: 'fable' },
  ]);

  assert.deepEqual(options.effort, [
    { label: '(claude 기본)', flag: null },
    { label: 'low', flag: 'low' },
    { label: 'medium', flag: 'medium' },
    { label: 'high', flag: 'high' },
    { label: 'xhigh', flag: 'xhigh' },
    { label: 'max', flag: 'max' },
  ]);
});

test('defaultConfig 는 매번 새로운 객체를 반환한다', () => {
  const a = defaultConfig();
  const b = defaultConfig();

  a.selection.mode = 'auto';

  assert.equal(b.selection.mode, 'manual');
});

test('resolveConfigPath 는 XDG_CONFIG_HOME 가 있으면 그 아래 tiller/config.json 을 쓴다', () => {
  const p = resolveConfigPath({
    env: { XDG_CONFIG_HOME: '/custom/xdg' },
    homedir: '/home/u',
  });

  assert.equal(p, path.join('/custom/xdg', 'tiller', 'config.json'));
});

test('resolveConfigPath 는 XDG_CONFIG_HOME 가 없으면 ~/.config 로 폴백한다', () => {
  const p = resolveConfigPath({ env: {}, homedir: '/home/u' });

  assert.equal(p, path.join('/home/u', '.config', 'tiller', 'config.json'));
});

test('resolveConfigPath 는 XDG_CONFIG_HOME 가 빈 문자열이면 ~/.config 로 폴백한다', () => {
  const p = resolveConfigPath({ env: { XDG_CONFIG_HOME: '' }, homedir: '/home/u' });

  assert.equal(p, path.join('/home/u', '.config', 'tiller', 'config.json'));
});

test('resolveLegacyConfigPath 는 개명 전 clauncher/config.json 경로를 돌려준다', () => {
  const p = resolveLegacyConfigPath({ env: {}, homedir: '/home/u' });

  assert.equal(p, path.join('/home/u', '.config', 'clauncher', 'config.json'));
});

test('validateSelection 은 모든 값이 options 에 있으면 빈 배열을 반환한다', () => {
  const config = defaultConfig();

  assert.deepEqual(validateSelection(config), []);
});

test('validateSelection 은 options 에 없는 단계를 무효로 표시한다', () => {
  const config = defaultConfig();
  config.selection.model = 'gpt'; // options.model 에 없는 값

  assert.deepEqual(validateSelection(config), ['model']);
});

test('validateSelection 은 selection 이 통째로 없으면 모든 단계를 무효로 표시한다', () => {
  const config = defaultConfig();
  delete config.selection;

  assert.deepEqual(validateSelection(config), ['mode', 'model', 'effort']);
});

test('validateSelection 은 flag 가 null 인 선택값(claude 기본)을 유효로 인정한다', () => {
  const config = defaultConfig();
  config.selection.model = null; // (claude 기본) 의 flag 가 null
  config.selection.effort = null;

  assert.deepEqual(validateSelection(config), []);
});

test('parseConfig 는 유효한 JSON 을 객체로 파싱한다', () => {
  const text = JSON.stringify({ version: 1, selection: { mode: 'auto' } });

  assert.deepEqual(parseConfig(text), { version: 1, selection: { mode: 'auto' } });
});

test('parseConfig 는 JSON 파싱에 실패하면 null 을 반환한다', () => {
  assert.equal(parseConfig('{ broken json'), null);
});

test('parseConfig 는 객체가 아닌 JSON(숫자·문자열·배열·null)이면 null 을 반환한다', () => {
  assert.equal(parseConfig('123'), null);
  assert.equal(parseConfig('"hello"'), null);
  assert.equal(parseConfig('[1, 2]'), null);
  assert.equal(parseConfig('null'), null);
});

test('mergeSelection 은 selection 을 갱신한 새 config 를 반환한다', () => {
  const config = defaultConfig();

  const merged = mergeSelection(config, { mode: 'auto', model: 'sonnet', effort: 'low' });

  assert.deepEqual(merged.selection, { mode: 'auto', model: 'sonnet', effort: 'low' });
});

test('mergeSelection 은 사용자가 편집한 options 를 보존한다', () => {
  const config = defaultConfig();
  config.options.model.push({ label: 'Custom', flag: 'custom' });

  const merged = mergeSelection(config, { mode: 'auto', model: 'custom', effort: 'low' });

  assert.deepEqual(merged.options, config.options);
});

test('mergeSelection 은 원본 config 를 변형하지 않는다', () => {
  const config = defaultConfig();

  mergeSelection(config, { mode: 'auto' });

  assert.equal(config.selection.mode, 'manual');
});

test('mergeSelection 은 일부 단계만 주면 나머지 단계는 기존 값을 유지한다', () => {
  const config = defaultConfig(); // manual/opus/high

  const merged = mergeSelection(config, { model: 'sonnet' });

  assert.deepEqual(merged.selection, {
    mode: 'manual',
    model: 'sonnet',
    effort: 'high',
  });
});

test('load 는 파일이 없으면 기본 config 와 전체 invalidSteps 를 돌려준다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    const { config, invalidSteps } = await load({ configPath, legacyConfigPath });

    assert.equal(config.version, 1);
    assert.deepEqual(config.options, defaultConfig().options);
    assert.deepEqual(invalidSteps, ['mode', 'model', 'effort']);
  });
});

test('load 는 유효한 selection 이면 invalidSteps 가 비어있다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    await fs.writeFile(configPath, JSON.stringify(defaultConfig()));

    const { invalidSteps } = await load({ configPath, legacyConfigPath });

    assert.deepEqual(invalidSteps, []);
  });
});

test('load 는 selection 일부가 options 에 없으면 그 단계만 invalidSteps 에 담는다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    const c = defaultConfig();
    c.selection.model = 'gpt';
    await fs.writeFile(configPath, JSON.stringify(c));

    const { invalidSteps } = await load({ configPath, legacyConfigPath });

    assert.deepEqual(invalidSteps, ['model']);
  });
});

test('load 는 selection 이 누락되면 전체 invalidSteps 를 돌려준다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    const c = defaultConfig();
    delete c.selection;
    await fs.writeFile(configPath, JSON.stringify(c));

    const { invalidSteps } = await load({ configPath, legacyConfigPath });

    assert.deepEqual(invalidSteps, ['mode', 'model', 'effort']);
  });
});

test('load 는 손상된 JSON 이면 기본값으로 재생성하고 전체 invalidSteps 를 돌려준다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    await fs.writeFile(configPath, '{ broken json');

    const { config, invalidSteps } = await load({ configPath, legacyConfigPath });

    assert.deepEqual(invalidSteps, ['mode', 'model', 'effort']);
    assert.equal(config.version, 1);

    // 손상 파일이 기본값으로 재생성됐는지 확인
    const reread = parseConfig(await fs.readFile(configPath, 'utf8'));
    assert.deepEqual(reread.options, defaultConfig().options);
    assert.deepEqual(reread.selection, defaultConfig().selection);
  });
});

test('load 는 tiller 설정이 없고 레거시(clauncher) 설정이 있으면 마이그레이션해 이어 쓴다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    const legacy = defaultConfig();
    legacy.selection = { mode: 'plan', model: 'sonnet', effort: 'low' };
    await fs.writeFile(legacyConfigPath, JSON.stringify(legacy));

    const { config, invalidSteps } = await load({ configPath, legacyConfigPath });

    // 레거시 selection 이 그대로 이어지고, 재선택 신호가 없어야 한다
    assert.deepEqual(config.selection, { mode: 'plan', model: 'sonnet', effort: 'low' });
    assert.deepEqual(invalidSteps, []);

    // tiller 경로에 복사본이 생성됐는지 확인
    const migrated = parseConfig(await fs.readFile(configPath, 'utf8'));
    assert.deepEqual(migrated.selection, legacy.selection);

    // 레거시 파일은 지우지 않는다 (구버전 병행 사용 대비)
    await fs.access(legacyConfigPath);
  });
});

test('load 는 레거시 설정이 손상됐으면 마이그레이션하지 않고 기본값으로 시작한다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    await fs.writeFile(legacyConfigPath, '{ broken json');

    const { config, invalidSteps } = await load({ configPath, legacyConfigPath });

    assert.deepEqual(config.options, defaultConfig().options);
    assert.deepEqual(invalidSteps, ['mode', 'model', 'effort']);
  });
});

test('load 는 tiller 설정이 있으면 레거시 설정을 무시한다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    const current = defaultConfig(); // default/opus/high
    await fs.writeFile(configPath, JSON.stringify(current));

    const legacy = defaultConfig();
    legacy.selection = { mode: 'plan', model: 'sonnet', effort: 'low' };
    await fs.writeFile(legacyConfigPath, JSON.stringify(legacy));

    const { config } = await load({ configPath, legacyConfigPath });

    assert.deepEqual(config.selection, current.selection);
  });
});

test('migrateLegacyPermissionMode 는 options·selection 의 default 를 manual 로 옮긴다', () => {
  const migrated = migrateLegacyPermissionMode(legacyModeConfig());

  assert.deepEqual(migrated.options.mode, [
    { label: 'Manual', flag: 'manual' },
    { label: 'Auto', flag: 'auto' },
  ]);
  assert.equal(migrated.selection.mode, 'manual');
});

test('migrateLegacyPermissionMode 는 원본 config 를 변형하지 않는다', () => {
  const config = legacyModeConfig();

  migrateLegacyPermissionMode(config);

  assert.equal(config.options.mode[0].flag, 'default');
  assert.equal(config.selection.mode, 'default');
});

test('migrateLegacyPermissionMode 는 사용자가 붙인 label 은 보존한다', () => {
  const config = legacyModeConfig();
  config.options.mode[0].label = '내 기본값';

  const migrated = migrateLegacyPermissionMode(config);

  assert.deepEqual(migrated.options.mode[0], { label: '내 기본값', flag: 'manual' });
});

test('migrateLegacyPermissionMode 는 다른 단계의 사용자 편집을 건드리지 않는다', () => {
  const config = legacyModeConfig();
  config.options.model = [{ label: '내 모델', flag: 'fable' }];

  const migrated = migrateLegacyPermissionMode(config);

  assert.deepEqual(migrated.options.model, [{ label: '내 모델', flag: 'fable' }]);
  assert.equal(migrated.selection.model, 'opus');
});

test('migrateLegacyPermissionMode 는 옮길 것이 없으면 원본을 그대로 반환한다', () => {
  const config = defaultConfig();

  assert.equal(migrateLegacyPermissionMode(config), config);
});

test('migrateLegacyPermissionMode 는 원본에 없던 키를 만들어내지 않는다', () => {
  const migrated = migrateLegacyPermissionMode({ selection: { mode: 'default' } });

  assert.equal(migrated.selection.mode, 'manual');
  assert.ok(!('options' in migrated));
});

test('load 는 저장된 default 모드를 manual 로 옮기고 파일에 기록한다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    await fs.writeFile(configPath, JSON.stringify(legacyModeConfig()));

    const { config, invalidSteps } = await load({ configPath, legacyConfigPath });

    assert.equal(config.selection.mode, 'manual');
    assert.deepEqual(invalidSteps, []); // 옮긴 값이 options 에 있으므로 재선택 불필요

    // 다음 실행부터는 no-op 이 되도록 파일에도 반영돼야 한다
    const written = parseConfig(await fs.readFile(configPath, 'utf8'));
    assert.equal(written.selection.mode, 'manual');
    assert.equal(written.options.mode[0].flag, 'manual');
  });
});

test('load 는 레거시(clauncher) 설정의 default 모드도 manual 로 옮겨 이어 쓴다', async () => {
  await withTmpConfig(async (configPath, legacyConfigPath) => {
    await fs.writeFile(legacyConfigPath, JSON.stringify(legacyModeConfig()));

    const { config } = await load({ configPath, legacyConfigPath });

    assert.equal(config.selection.mode, 'manual');

    const written = parseConfig(await fs.readFile(configPath, 'utf8'));
    assert.equal(written.selection.mode, 'manual');
  });
});

test('save 는 selection 을 갱신해 파일에 쓴다', async () => {
  await withTmpConfig(async (configPath) => {
    await save({ mode: 'auto', model: 'sonnet', effort: 'low' }, { configPath });

    const written = parseConfig(await fs.readFile(configPath, 'utf8'));
    assert.deepEqual(written.selection, { mode: 'auto', model: 'sonnet', effort: 'low' });
  });
});

test('save 는 사용자가 편집한 기존 options 를 보존한다', async () => {
  await withTmpConfig(async (configPath) => {
    const c = defaultConfig();
    c.options.model.push({ label: 'Custom', flag: 'custom' });
    await fs.writeFile(configPath, JSON.stringify(c));

    await save({ mode: 'auto', model: 'custom', effort: 'low' }, { configPath });

    const written = parseConfig(await fs.readFile(configPath, 'utf8'));
    assert.deepEqual(written.options, c.options);
    assert.equal(written.selection.model, 'custom');
  });
});

test('save 는 디렉토리가 없으면 생성한 뒤 파일을 쓴다', async () => {
  await withTmpConfig(async (configPath) => {
    const nested = path.join(path.dirname(configPath), 'sub', 'tiller', 'config.json');

    await save({ mode: 'auto', model: 'sonnet', effort: 'low' }, { configPath: nested });

    const written = parseConfig(await fs.readFile(nested, 'utf8'));
    assert.equal(written.selection.mode, 'auto');
  });
});

test('save 는 기존 파일이 손상됐으면 기본값 기반으로 머지해 정상화한다', async () => {
  await withTmpConfig(async (configPath) => {
    await fs.writeFile(configPath, '{ broken');

    await save({ mode: 'plan', model: 'haiku', effort: 'max' }, { configPath });

    const written = parseConfig(await fs.readFile(configPath, 'utf8'));
    assert.deepEqual(written.options, defaultConfig().options);
    assert.deepEqual(written.selection, { mode: 'plan', model: 'haiku', effort: 'max' });
  });
});

test('save 는 저장한 config 를 반환한다', async () => {
  await withTmpConfig(async (configPath) => {
    const result = await save({ mode: 'auto', model: 'sonnet', effort: 'low' }, { configPath });

    assert.deepEqual(result.selection, { mode: 'auto', model: 'sonnet', effort: 'low' });
  });
});
