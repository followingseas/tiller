// tiller 설정 모듈
// 설정파일 경로 해석, 로드/저장, 기본값 생성, 스키마 검증을 담당한다.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// selection 의 단계 순서. 메뉴 표시·플래그 조립·검증이 모두 이 순서를 공유한다.
export const SELECTION_STEPS = ['mode', 'model', 'effort'];

/**
 * 기본 옵션 목록과 선택값을 담은 config 를 생성한다.
 * 호출할 때마다 새 객체를 반환해 호출부의 변형이 서로 영향을 주지 않게 한다.
 */
export function defaultConfig() {
  return {
    version: 1,
    options: {
      mode: [
        { label: '(claude 기본)', flag: null },
        { label: 'Manual', flag: 'manual' },
        { label: 'Auto', flag: 'auto' },
        { label: 'Plan', flag: 'plan' },
        { label: 'Accept Edits', flag: 'acceptEdits' },
        { label: 'Bypass Permissions', flag: 'bypassPermissions' },
        { label: "Don't Ask", flag: 'dontAsk' },
      ],
      model: [
        { label: '(claude 기본)', flag: null },
        { label: 'Opus', flag: 'opus' },
        { label: 'Sonnet', flag: 'sonnet' },
        { label: 'Haiku', flag: 'haiku' },
        { label: 'Fable', flag: 'fable' },
      ],
      effort: [
        { label: '(claude 기본)', flag: null },
        { label: 'low', flag: 'low' },
        { label: 'medium', flag: 'medium' },
        { label: 'high', flag: 'high' },
        { label: 'xhigh', flag: 'xhigh' },
        { label: 'max', flag: 'max' },
      ],
    },
    selection: {
      mode: 'manual',
      model: 'opus',
      effort: 'high',
    },
  };
}

/**
 * 설정파일의 절대 경로를 해석한다 (XDG Base Directory 기준).
 * `$XDG_CONFIG_HOME` 가 비어있지 않으면 그쪽을, 아니면 `~/.config` 를 base 로 쓴다.
 * env·homedir 를 주입받아 순수하게 동작한다(테스트 용이).
 */
export function resolveConfigPath({ env = process.env, homedir = os.homedir() } = {}) {
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg ? xdg : path.join(homedir, '.config');
  return path.join(base, 'tiller', 'config.json');
}

/**
 * 개명 전(clauncher) 설정파일의 절대 경로를 해석한다.
 * tiller 설정이 없을 때 한 번만 읽어 마이그레이션하는 용도다.
 */
export function resolveLegacyConfigPath({ env = process.env, homedir = os.homedir() } = {}) {
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg ? xdg : path.join(homedir, '.config');
  return path.join(base, 'clauncher', 'config.json');
}

// 개명 전 claude 의 permission mode 플래그와 그 자리를 대신하는 현재 플래그.
const LEGACY_MODE_FLAG = 'default';
const CURRENT_MODE_FLAG = 'manual';

/**
 * 저장된 설정의 구 permission mode 플래그(`default`)를 `manual` 로 옮긴다.
 *
 * claude 2.1.x 의 `--permission-mode` 문서화된 선택지에서 `default` 가 빠지고
 * `manual` 이 그 자리를 대신한다(`default` 는 아직 통과하지만 안내에서 사라졌다).
 * 두 값은 같은 동작이므로 값만 갈아끼워 언젠가 제거돼도 깨지지 않게 한다.
 *
 * 플래그를 생략하는 `null` 이 아니라 `manual` 로 옮기는 이유: 생략은 claude 쪽
 * `permissions.defaultMode` 설정을 따르므로, 그 설정을 둔 사용자에게는 동작이
 * 조용히 달라진다. 마이그레이션은 의도를 추측하지 않고 동작을 보존한다.
 *
 * options 와 selection 중 해당하는 값만 바꾸고 나머지 사용자 편집은 건드리지 않는다.
 * label 은 기본값이던 'Default' 일 때만 교체해 직접 붙인 이름을 보존한다.
 * 바꿀 것이 없으면 원본을 그대로 반환한다 — 호출부는 참조 동일성으로 판별한다.
 */
export function migrateLegacyPermissionMode(config) {
  const options = config?.options ?? {};
  const selection = config?.selection ?? {};
  const modeOptions = options.mode;

  const hasLegacyOption =
    Array.isArray(modeOptions) && modeOptions.some((opt) => opt?.flag === LEGACY_MODE_FLAG);
  const hasLegacySelection = selection.mode === LEGACY_MODE_FLAG;

  if (!hasLegacyOption && !hasLegacySelection) return config;

  return {
    ...config,
    options: hasLegacyOption
      ? {
          ...options,
          mode: modeOptions.map((opt) =>
            opt?.flag === LEGACY_MODE_FLAG
              ? {
                  ...opt,
                  label: opt.label === 'Default' ? 'Manual' : opt.label,
                  flag: CURRENT_MODE_FLAG,
                }
              : opt,
          ),
        }
      : options,
    selection: hasLegacySelection ? { ...selection, mode: CURRENT_MODE_FLAG } : selection,
  };
}

/**
 * selection 의 각 단계 값이 해당 options 의 flag 중에 존재하는지 검증한다.
 * 무효한 단계(재선택이 필요한 단계)의 배열을 반환한다 — 전부 유효하면 빈 배열.
 * selection 통째 누락은 모든 단계가 무효가 되어 "최초 실행"과 같은 신호가 된다.
 * flag 가 null 인 항목(claude 기본)은 selection 값이 null 일 때 유효로 인정한다.
 */
export function validateSelection(config) {
  const options = config?.options ?? {};
  const selection = config?.selection ?? {};

  return SELECTION_STEPS.filter((step) => {
    const opts = options[step];
    if (!Array.isArray(opts)) return true;
    return !opts.some((opt) => opt.flag === selection[step]);
  });
}

/**
 * JSON 텍스트를 config 객체로 파싱한다.
 * 파싱 실패(손상)나 객체가 아닌 값(숫자·문자열·배열·null)이면 null 을 반환해
 * 호출부(load)가 "손상 → 기본값 재생성" 으로 분기하게 한다.
 */
export function parseConfig(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * 기존 config 의 selection 만 newSelection 으로 머지한 새 config 를 반환한다.
 * 사용자가 손으로 편집한 options 는 그대로 보존하고, 원본 config 는 변형하지 않는다.
 * 부분 selection 을 주면 나머지 단계는 기존 값을 유지한다(일부 단계만 재선택 케이스).
 */
export function mergeSelection(config, newSelection) {
  return {
    ...config,
    selection: { ...config.selection, ...newSelection },
  };
}

// config 를 파일에 쓸 문자열로 직렬화한다(사람이 편집하기 좋게 2칸 들여쓰기 + 후행 개행).
function serialize(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * 레거시(clauncher) 설정을 tiller 경로로 복사한다(개명 마이그레이션).
 * 성공하면 마이그레이션된 config 를, 레거시가 없거나 손상됐으면 null 을 반환한다.
 * 레거시 파일은 지우지 않는다 — 구버전 clauncher 를 병행 사용해도 깨지지 않게 한다.
 * ENOENT 외 읽기 오류는 호출부(load)의 규칙과 같이 그대로 던진다.
 */
async function migrateLegacyConfig(configPath, legacyConfigPath) {
  let raw;
  try {
    raw = await fs.readFile(legacyConfigPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }

  const parsed = parseConfig(raw);
  if (parsed === null) return null;

  // 레거시 설정은 구 permission mode 플래그를 담고 있으므로 옮겨 담아 기록한다.
  const config = migrateLegacyPermissionMode(parsed);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, serialize(config));
  return config;
}

/**
 * 설정파일을 읽어 { config, invalidSteps } 를 반환한다.
 * - 파일 없음: 레거시(clauncher) 설정이 있으면 tiller 경로로 마이그레이션해 이어 쓰고,
 *   없으면 최초 실행으로 간주 — 기본 config 와 전체 단계 재선택 신호.
 * - 손상(JSON 파싱 실패): 기본값으로 재생성하고 전체 단계 재선택 신호.
 * - 정상: 파싱한 config 와 validateSelection 결과(누락=전체, 일부 무효=해당 단계).
 * 어느 경로로 읽었든 구 permission mode 플래그는 migrateLegacyPermissionMode 로 옮겨 담는다.
 * config.options 는 항상 메뉴를 띄울 수 있도록 채워서 반환한다.
 * ENOENT 외 I/O 오류는 호출부가 처리하도록 그대로 던진다.
 */
export async function load({
  configPath = resolveConfigPath(),
  legacyConfigPath = resolveLegacyConfigPath(),
} = {}) {
  let raw;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      const migrated = await migrateLegacyConfig(configPath, legacyConfigPath);
      if (migrated) {
        return { config: migrated, invalidSteps: validateSelection(migrated) };
      }
      return { config: defaultConfig(), invalidSteps: [...SELECTION_STEPS] };
    }
    throw err;
  }

  const parsed = parseConfig(raw);
  if (parsed === null) {
    const config = defaultConfig();
    await fs.writeFile(configPath, serialize(config));
    return { config, invalidSteps: [...SELECTION_STEPS] };
  }

  // 구 permission mode 플래그가 남아 있으면 옮겨 담고 즉시 기록한다(다음 실행부터는 no-op).
  const config = migrateLegacyPermissionMode(parsed);
  if (config !== parsed) {
    await fs.writeFile(configPath, serialize(config));
  }

  return { config, invalidSteps: validateSelection(config) };
}

/**
 * selection 만 갱신해 설정파일에 저장한다(사용자가 편집한 options 는 보존).
 * 기존 파일이 없거나 손상됐으면 기본 config 를 base 로 삼아 머지한다.
 * 설정 디렉토리가 없으면 생성한다(최초 실행 대비). 저장한 config 를 반환한다.
 */
export async function save(selection, { configPath = resolveConfigPath() } = {}) {
  let base;
  try {
    base = parseConfig(await fs.readFile(configPath, 'utf8')) ?? defaultConfig();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    base = defaultConfig();
  }

  const config = mergeSelection(base, selection);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, serialize(config));
  return config;
}
