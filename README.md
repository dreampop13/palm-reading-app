# 손금 읽기 앱 (Palm Reading App)

Next.js, TensorFlow.js, React 및 TypeScript를 활용한 AI 손금 읽기 웹 애플리케이션입니다.

## 주요 기능

- 실시간 카메라를 통한 손바닥 인식
- TensorFlow.js 기반 손 인식 모델
- 손금 패턴 분석 및 결과 제공
- 모바일 및 데스크톱 브라우저 지원
- 다양한 브라우저 호환성 처리

## 기술 스택

- **프레임워크**: Next.js 15
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **UI 컴포넌트**: ShadCN UI
- **아이콘**: Lucide React
- **AI/ML**: TensorFlow.js, MediaPipe Hands

## 시작하기

### 설치

```bash
# 프로젝트 클론
git clone https://github.com/yourusername/palm-reading-app.git
cd palm-reading-app

# 의존성 설치
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 애플리케이션을 이용할 수 있습니다.

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 주의사항

- 카메라 API 사용을 위해 HTTPS 혹은 localhost 환경이 필요합니다.
- 모바일에서 최적의 경험을 위해 최신 브라우저(Chrome, Safari 등)를 사용해주세요.
- 백엔드 연동 기능은 제공되지 않으며, 모든 처리는 클라이언트 사이드에서 이루어집니다.

## 라이센스

MIT
