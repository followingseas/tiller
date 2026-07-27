// tiller 실행 모듈
// selection → claude 플래그 배열 조립(순수), claude 프로세스 spawn(부수효과)을 담당한다.

import { spawn } from 'node:child_process';

import { SELECTION_STEPS } from './config.js';

// 각 selection 단계가 매핑되는 claude 플래그 이름.
const FLAG_NAMES = {
  mode: '--permission-mode',
  model: '--model',
  effort: '--effort',
};

/**
 * selection 을 claude 인자 배열로 조립한다(순수 함수).
 * - selection[step] 에 대응하는 options 항목의 flag 를 찾는다.
 * - flag 가 null(= claude 기본)이면 그 플래그를 생략한다.
 * - 순서는 SELECTION_STEPS(mode→model→effort), 마지막에 passthrough 를 그대로 붙인다.
 */
export function buildArgs(selection, options, passthrough = []) {
  const flags = [];

  for (const step of SELECTION_STEPS) {
    const opts = options[step] ?? [];
    const found = opts.find((opt) => opt.flag === selection[step]);
    if (found && found.flag !== null) {
      flags.push(FLAG_NAMES[step], found.flag);
    }
  }

  return [...flags, ...passthrough];
}

/**
 * 조립한 인자로 claude 를 실행한다(부수효과).
 * stdio: 'inherit' 로 TTY 를 그대로 넘겨 대화형 세션이 정상 동작하게 한다.
 * 자식 종료코드를 그대로 반환하고, 실행파일을 못 찾으면(ENOENT) 안내 후 127 을 반환한다.
 * command·logError 를 주입받아 테스트할 수 있다(기본값: 'claude'·console.error).
 */
export function run(args, { command = 'claude', logError = console.error } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        logError(
          `tiller: '${command}' 명령을 찾을 수 없습니다. claude CLI 설치 여부와 PATH 를 확인하세요.`,
        );
        resolve(127);
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => resolve(code ?? 0));
  });
}
