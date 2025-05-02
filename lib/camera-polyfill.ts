// 레거시 getUserMedia 인터페이스를 위한 타입 정의
interface LegacyNavigator extends Navigator {
  getUserMedia?: (
    constraints: MediaStreamConstraints,
    onSuccess: (stream: MediaStream) => void,
    onError: (error: Error) => void
  ) => void;
  webkitGetUserMedia?: (
    constraints: MediaStreamConstraints,
    onSuccess: (stream: MediaStream) => void,
    onError: (error: Error) => void
  ) => void;
  mozGetUserMedia?: (
    constraints: MediaStreamConstraints,
    onSuccess: (stream: MediaStream) => void,
    onError: (error: Error) => void
  ) => void;
  msGetUserMedia?: (
    constraints: MediaStreamConstraints,
    onSuccess: (stream: MediaStream) => void,
    onError: (error: Error) => void
  ) => void;
}

/**
 * 브라우저 환경 확인
 * @returns 브라우저 환경 정보 객체
 */
export const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;

  return {
    isIOS: /iPhone|iPad|iPod/i.test(userAgent),
    isAndroid: /Android/i.test(userAgent),
    isMobile: /iPhone|iPad|iPod|Android/i.test(userAgent),
    isSafari: /^((?!chrome|android).)*safari/i.test(userAgent),
    isSecureContext: window.isSecureContext,
    userAgent,
  };
};

/**
 * 브라우저 호환성을 위한 getUserMedia 폴리필
 * @returns getUserMedia 호출 함수 또는 null (지원하지 않는 경우)
 */
export const getUserMedia = ():
  | ((constraints: MediaStreamConstraints) => Promise<MediaStream>)
  | null => {
  // Secure context 확인 (getUserMedia는 HTTPS 또는 localhost에서만 동작)
  if (!window.isSecureContext) {
    console.error("보안 컨텍스트가 아닙니다. HTTPS 환경이 필요합니다.");
    return null;
  }

  // 표준 API 확인
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    console.log("표준 mediaDevices API 사용");
    return navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  }

  // 레거시 API 지원 (iOS Safari 등)
  const legacyNavigator = navigator as LegacyNavigator;
  const legacyAPI =
    legacyNavigator.getUserMedia ||
    legacyNavigator.webkitGetUserMedia ||
    legacyNavigator.mozGetUserMedia ||
    legacyNavigator.msGetUserMedia;

  if (legacyAPI) {
    console.log(
      "레거시 API 사용:",
      legacyNavigator.getUserMedia
        ? "getUserMedia"
        : legacyNavigator.webkitGetUserMedia
        ? "webkitGetUserMedia"
        : legacyNavigator.mozGetUserMedia
        ? "mozGetUserMedia"
        : "msGetUserMedia"
    );

    return function (
      constraints: MediaStreamConstraints
    ): Promise<MediaStream> {
      return new Promise((resolve, reject) => {
        legacyAPI.call(navigator, constraints, resolve, reject);
      });
    };
  }

  console.error("지원되는 getUserMedia API를 찾을 수 없습니다.");
  return null;
};

/**
 * 모바일 환경에 최적화된 카메라 제약조건 생성
 * @returns 카메라 접근을 위한 MediaStreamConstraints 객체
 */
export const getCameraConstraints = (): MediaStreamConstraints => {
  const { isMobile } = getBrowserInfo();

  if (isMobile) {
    return {
      video: {
        facingMode: { ideal: "environment" }, // 후면 카메라
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
  }

  // 데스크톱 환경
  return {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  };
};

/**
 * 인식된 에러 메시지를 사용자 친화적인 메시지로 변환
 * @param error 원본 에러 객체 또는 문자열
 * @returns 사용자 친화적인 에러 메시지
 */
export const getUserFriendlyErrorMessage = (error: unknown): string => {
  const errMsg = error instanceof Error ? error.message : String(error);

  if (errMsg.includes("permission") || errMsg.includes("Permission")) {
    return "카메라 사용 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.";
  }

  if (errMsg.includes("not found") || errMsg.includes("NotFoundError")) {
    return "카메라를 찾을 수 없습니다. 기기에 카메라가 연결되어 있는지 확인해주세요.";
  }

  if (errMsg.includes("secure context") || errMsg.includes("SecurityError")) {
    return "보안 연결이 필요합니다. HTTPS 환경에서 접속해주세요.";
  }

  if (errMsg.includes("NotAllowedError") || errMsg.includes("denied")) {
    return "카메라 사용이 거부되었습니다. 브라우저 설정에서 권한을 확인해주세요.";
  }

  if (
    errMsg.includes("NotReadableError") ||
    errMsg.includes("TrackStartError")
  ) {
    return "카메라를 사용할 수 없습니다. 다른 앱에서 카메라를 사용 중인지 확인해주세요.";
  }

  if (errMsg.includes("OverconstrainedError")) {
    return "요청한 카메라 설정이 지원되지 않습니다. 다른 설정으로 시도해보세요.";
  }

  return `카메라에 접근할 수 없습니다: ${errMsg}`;
};
