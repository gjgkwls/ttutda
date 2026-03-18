# TTUTDA

변화 추적 기반 Slack 알림 서비스 MVP를 위한 모노레포 프로젝트입니다.

## 구성

- `PRD.md`: 제품 요구사항 문서
- `apps/web`: Next.js(App Router) 기반 프론트엔드
- `apps/server`: Express + BullMQ 기반 백엔드/워커
- `packages/shared`: 공용 타입/상수

## 빠른 시작

```bash
npm install
npm run dev
```

기본 실행 포트:
- Web: `http://localhost:3000`
- Server: `http://localhost:4000`

## 환경 변수

`apps/server/.env.example` 를 참고하여 `.env` 파일을 구성하세요.

## MVP 범위

- URL/API 모니터링 알림 등록
- 키워드 포함 감지
- 주기 기반 체크
- Slack Webhook 전송
- 알림 CRUD + ON/OFF
