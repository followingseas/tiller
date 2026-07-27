# Tiller

[![npm version](https://img.shields.io/npm/v/%40followingseas%2Ftiller.svg)](https://www.npmjs.com/package/@followingseas/tiller)
[![license](https://img.shields.io/npm/l/%40followingseas%2Ftiller.svg)](LICENSE)

**Tiller is a thin launcher that steers the `claude` CLI — save your model, permission mode, and effort once, and every launch carries them.**

`claude` CLI 를 감싸는 얇은 런처다. 저장해 둔 model · permission mode · effort 를 플래그로 얹어 `claude` 를 실행하고, 나머지 인자는 그대로 전달한다. 틸러(tiller)는 배의 방향타를 손으로 잡는 키 손잡이다 — 항로(작업)는 그대로 두고 실행 방향(옵션)만 가볍게 잡아 준다.

> 이 패키지의 이전 이름은 [`clauncher`](https://www.npmjs.com/package/clauncher)다. Followingseas 조직 편입과 함께 개명했다.

## Why

`claude` 를 실행할 때마다 `--model`, `--permission-mode`, `--effort` 를 직접 붙이는 일은 번거롭다. Tiller 는 자주 쓰는 조합을 한 번 저장해 두고, 이후에는 명령 하나로 그 조합을 얹어 실행한다.

## 설치

```sh
npm install -g @followingseas/tiller
```

GitHub 저장소에서 직접 설치할 수도 있다.

```sh
npm install -g github:followingseas/tiller
```

## 사용법

```sh
tiller              # 저장한 설정으로 claude 실행 (최초 실행 시 메뉴 표시)
tiller "프롬프트"    # 프롬프트를 claude 에 전달
tiller --resume     # claude 인자를 그대로 전달
tiller config       # 메뉴를 다시 열어 설정 변경
```

최초 실행 시 `mode → model → effort` 를 방향키(↑↓)와 Enter 로 선택한다. 한 번 선택하면 이후에는 메뉴 없이 저장한 설정으로 실행되며, 설정을 바꾸려면 `tiller config` 를 사용한다.

## 설정 파일

설정은 XDG Base Directory 규칙에 따라 `~/.config/tiller/config.json` 에 저장된다. 메뉴에 표시되는 후보 목록(`options`)을 직접 편집해 항목을 추가하거나 제거할 수 있다.

기존 clauncher 사용자의 설정(`~/.config/clauncher/config.json`)은 최초 실행 시 tiller 경로로 자동 복사돼 그대로 이어진다.

## 요구사항

- Node.js 18 이상
- `PATH` 에 `claude` CLI 가 설치되어 있어야 한다

## 라이선스

[MIT](LICENSE)
