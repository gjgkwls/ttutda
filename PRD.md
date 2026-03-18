# 📄 TTUTDA PRD

## 1. 프로젝트 개요

### 1.1 서비스 정의
TTUTDA는 사용자가 지정한 웹페이지 또는 API의 변화를 감지하여 특정 조건(키워드 등)이 만족되었을 때 Slack으로 알림을 제공하는 변화 추적 기반 알림 서비스이다.

### 1.2 문제 정의
- 품절 상품 재입고, 신규 상품 등록 등을 수동으로 확인해야 하는 불편함
- 특정 데이터 변화(API 응답 등)를 지속적으로 확인해야 하는 비효율
- 다양한 사이트/서비스를 하나의 알림 시스템으로 통합하기 어려움

### 1.3 목표
- 웹/앱 기반으로 간단하게 관찰 대상 설정
- 실시간 또는 주기 기반 변화 감지
- Slack 기반 알림으로 즉각적인 대응 가능
- 개인 맞춤형 모니터링 자동화 도구 제공

### 1.4 주요 타겟 유저
- 쇼핑 재입고 알림을 원하는 사용자
- 개발자/운영자(API 변화 감지 필요)
- 특정 콘텐츠 업데이트를 추적하는 사용자

## 2. 유저 플로우

### 2.1 최초 사용자 흐름
1. Slack 연동 (OAuth)
2. 대시보드 진입

### 2.2 알림 설정 플로우
1. "새 알림 추가" 클릭
2. 입력
   - 알림 이름
   - 관찰 대상 URL 또는 API endpoint 입력
   - 감지 키워드 입력 (ex. "재입고", "In Stock")
   - 관찰 주기 설정 (1초 ~ n분)
3. 저장
4. 백엔드 크롤러/워커에 등록
5. 상태: 활성화(ON)

### 2.3 알림 발생 플로우
1. 워커가 주기적으로 대상 요청
2. 응답 데이터/HTML 분석
3. 키워드 존재 여부 확인
4. 조건 충족 시 Slack Webhook/API로 메시지 전송

### 2.4 관리 플로우
대시보드에서:
- 알림 목록 조회
- 개별 항목 수정
- 삭제
- ON/OFF 토글

## 3. 핵심 기능

### 3.1 알림 대상 등록
- URL 또는 API endpoint 입력
- HTTP Method 지원 (GET 기본, 추후 확장 가능)
- 요청 헤더 옵션 (확장 고려)

### 3.2 키워드 기반 감지
- 단일/다중 키워드 입력
- 포함 여부 기준 (MVP)
- 향후:
  - Regex 지원
  - 조건식 (AND/OR)

### 3.3 주기 설정
- 최소: 1초
- 기본 옵션:
  - 1초 / 5초 / 10초 / 1분 / 5분
- 서버 부하 방지를 위한 제한 필요

### 3.4 알림 시스템 (Slack)
- Slack Incoming Webhook 또는 Bot API 사용
- 알림 메시지 포함 내용:
  - 제목
  - 감지된 키워드
  - 링크
  - 감지 시각

### 3.5 알림 관리 기능
- 목록 조회 (Pagination)
- 수정 (URL, 키워드, 주기)
- 삭제
- ON/OFF 토글

### 3.6 상태 관리
- 각 알림 항목 상태:
  - ACTIVE / INACTIVE
  - 마지막 실행 시간
  - 마지막 감지 여부 기록

### 3.7 변화 감지 엔진
- HTML 파싱 / JSON 파싱 지원
- 이전 상태 vs 현재 상태 비교 (옵션 기능)
- 키워드 매칭 기반 MVP

### 3.8 에러 처리
- 요청 실패 시 retry
- 실패 로그 저장
- Slack 알림 실패 fallback

## 4. 기술 스택

### 4.1 Frontend
- Next.js (App Router)
- TypeScript
- TailwindCSS
- Zustand 또는 React Query (상태 관리)

### 4.2 Backend
- Node.js (NestJS 또는 Express)
- Scheduler:
  - BullMQ + Redis (추천)
  - 또는 Node Cron (초기 MVP)

### 4.3 Database & Auth
- Supabase
- PostgreSQL (알림 데이터 저장)
- Auth (회원가입/로그인)
- Realtime (옵션)

### 4.4 Worker / Queue 시스템
- BullMQ + Redis
- 역할:
  - 주기적 작업 실행
  - 스케줄 관리
  - 분산 처리 가능

### 4.5 크롤링/요청 처리
- Axios (API 호출)
- Cheerio (HTML 파싱)
- Playwright (JS 렌더링 필요 시)

### 4.6 알림 시스템
- Slack Webhook
- Slack Bot API (확장)

### 4.7 배포
- Vercel (Frontend)
- Fly.io / AWS / Railway (Backend + Worker)
- Supabase (DB)

## 5. 데이터 모델 (간략)

### Alert
- id
- user_id
- url
- method
- keyword
- interval
- is_active
- last_checked_at
- last_triggered_at
- created_at

### User
- id
- email
- slack_webhook_url

## 6. 확장 아이디어 (Future Scope)
- Diff 기반 변화 감지 (HTML 비교)
- 특정 DOM selector 기반 감지
- 이미지 변화 감지
- Telegram / Email 알림 추가
- 팀 공유 기능
- SaaS 유료화 (고빈도 체크)

## 7. 핵심 성공 지표 (KPI)
- 알림 생성 수
- 활성 알림 비율
- Slack 알림 전송 성공률
- 사용자 리텐션
- 평균 알림 반응 시간

## 8. 리스크 및 고려사항
- 과도한 크롤링으로 인한 IP 차단
- 사이트별 bot 차단 정책
- 고빈도 polling 비용 증가
- Slack rate limit

## 9. MVP 범위 요약
- URL 입력
- 키워드 감지
- 주기 설정
- Slack 알림
- CRUD + ON/OFF
