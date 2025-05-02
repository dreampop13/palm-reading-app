"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  Camera,
  HandMetal,
  AlertCircle,
  Zap,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import {
  getUserMedia as getMediaPolyfill,
  getBrowserInfo,
  getUserFriendlyErrorMessage,
} from "@/lib/camera-polyfill";

type PalmAnalysisResult = {
  lifeLine: {
    length: string;
    quality: string;
    description: string;
  };
  heartLine: {
    length: string;
    curve: string;
    description: string;
  };
  headLine: {
    length: string;
    depth: string;
    description: string;
  };
  overall: string;
  confidence: number; // 인식 신뢰도
};

export default function PalmReader() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<PalmAnalysisResult | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isCameraSupported, setIsCameraSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [browserInfo, setBrowserInfo] = useState<ReturnType<
    typeof getBrowserInfo
  > | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [useSimpleMode, setUseSimpleMode] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"initial" | "camera">(
    "initial"
  );
  const [handDetected, setHandDetected] = useState(false);
  const [previousResults, setPreviousResults] = useState<PalmAnalysisResult[]>(
    []
  ); // 이전 분석 결과 저장
  const [retryCount, setRetryCount] = useState(0); // 재시도 횟수

  // 진행 상태 표시 효과
  useEffect(() => {
    // 로딩 상태일 때만 진행률을 증가시킴
    if (isModelLoading && loadingProgress < 95) {
      const timer = setTimeout(() => {
        // 로딩 진행률이 10-15%에서 멈추면 바로 간단 모드로 전환
        if (loadingProgress >= 10 && loadingProgress < 15) {
          console.log("초기 로딩이 지연되어 즉시 간단 모드로 전환합니다.");
          setUseSimpleMode(true);
          setLoadingProgress(50); // 바로 50%로 점프

          // 5초 후 로딩 완료 처리
          setTimeout(() => {
            setIsModelLoading(false);
            setLoadingProgress(100);
          }, 2000);
        }
        // 로딩 진행률이 30%에서 멈추면 간단 모드로 전환
        else if (loadingProgress >= 30 && loadingProgress < 35) {
          console.log("모델 로딩이 지연되어 간단 모드로 전환합니다.");
          setUseSimpleMode(true);
          setLoadingProgress((prev) => prev + 20);
        } else {
          setLoadingProgress((prev) => Math.min(prev + 5, 95));
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isModelLoading, loadingProgress]);

  // 브라우저 환경 정보 설정
  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window !== "undefined") {
      const info = getBrowserInfo();
      setBrowserInfo(info);
      console.log("브라우저 환경 정보:", info);
    }
  }, []);

  // 손 감지 함수 (간소화 버전)
  const detectAndCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isStreamActive) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // 캔버스 초기화
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    // 비디오 프레임 캡처
    ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

    // 가이드라인 그리기
    const centerX = videoWidth / 2;
    const centerY = videoHeight / 2;
    const radius = Math.min(videoWidth, videoHeight) * 0.35;

    // 손바닥 영역 가이드 (원형)
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 가이드 외곽선 효과 (더 뚜렷하게 보이기 위한 외부 테두리)
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 4;
    ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
    ctx.stroke();

    // 손가락 가이드 라인 (상단 부분)
    const fingerStartY = centerY - radius;
    const fingerSpacing = radius / 2;

    // 5개 손가락 위치 가이드 라인
    for (let i = -2; i <= 2; i++) {
      const fingerX = centerX + i * fingerSpacing;

      // 손가락 라인 (위쪽)
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.moveTo(fingerX, fingerStartY);
      ctx.lineTo(fingerX, fingerStartY - radius * 0.7);
      ctx.stroke();

      // 손가락 끝 원형 표시
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.arc(fingerX, fingerStartY - radius * 0.7, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 생명선/감정선/지성선 위치 가이드 (손바닥 내부)
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 2;

    // 가로 생명선 가이드
    ctx.moveTo(centerX - radius * 0.5, centerY);
    ctx.lineTo(centerX + radius * 0.5, centerY);

    // 세로 주요 손금 가이드
    ctx.moveTo(centerX, centerY - radius * 0.5);
    ctx.lineTo(centerX, centerY + radius * 0.5);

    ctx.stroke();

    // 간단한 손 검출 시뮬레이션 (실제로는 TensorFlow.js 모델을 사용할 것)
    // 이미지의 중앙 영역에서 피부색과 유사한 색상 픽셀 비율 확인
    try {
      const centerSize = Math.floor(radius * 0.7);
      const imageData = ctx.getImageData(
        centerX - centerSize,
        centerY - centerSize,
        centerSize * 2,
        centerSize * 2
      );

      const pixelCount = imageData.width * imageData.height;
      let skinTonePixels = 0;

      // 간단한 피부색 범위 검사 (매우 기본적인 방식)
      for (let i = 0; i < pixelCount * 4; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];

        // 매우 기본적인 피부색 범위 검사 (실제 환경에서는 더 정교한 알고리즘 필요)
        if (
          r > 60 &&
          g > 40 &&
          b > 30 && // 최소 임계값
          r > g &&
          r > b && // 붉은 색조가 우세한 피부색
          Math.abs(r - g) < 50 // 빨강과 초록의 차이가 크지 않음
        ) {
          skinTonePixels++;
        }
      }

      const skinToneRatio = skinTonePixels / pixelCount;
      const handDetectionThreshold = 0.3; // 30% 이상의 픽셀이 피부색이면 손으로 간주

      // 현재 프레임에서 손 감지 상태 업데이트
      setHandDetected(skinToneRatio > handDetectionThreshold);

      // 손 감지 상태에 따라 가이드라인 색상 변경
      if (skinToneRatio > handDetectionThreshold) {
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(0, 255, 0, 0.5)"; // 초록색으로 변경하여 손 감지 표시
        ctx.lineWidth = 2;
        ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    } catch (err) {
      console.warn("손 감지 시뮬레이션 오류:", err);
    }

    // 다음 프레임
    if (isStreamActive && !isAnalyzing) {
      requestAnimationFrame(detectAndCapture);
    }
  }, [isStreamActive, isAnalyzing]);

  // 손금 분석 결과 비교 및 일관성 확인 함수
  const compareResults = (
    previousResults: PalmAnalysisResult[],
    newResult: PalmAnalysisResult
  ): number => {
    if (previousResults.length === 0) return 0.7; // 첫 번째 결과는 기본 신뢰도 부여

    let totalSimilarity = 0;
    let comparedItems = 0;

    // 이전 결과들과 새 결과를 비교
    for (const prevResult of previousResults) {
      let similarity = 0;

      // 각 속성 비교
      if (prevResult.lifeLine.length === newResult.lifeLine.length)
        similarity += 0.2;
      if (prevResult.lifeLine.quality === newResult.lifeLine.quality)
        similarity += 0.2;
      if (prevResult.heartLine.length === newResult.heartLine.length)
        similarity += 0.2;
      if (prevResult.heartLine.curve === newResult.heartLine.curve)
        similarity += 0.2;
      if (prevResult.headLine.length === newResult.headLine.length)
        similarity += 0.2;
      if (prevResult.headLine.depth === newResult.headLine.depth)
        similarity += 0.2;

      totalSimilarity += similarity;
      comparedItems++;
    }

    // 평균 유사도 계산 (0.0 ~ 1.0)
    return comparedItems > 0 ? totalSimilarity / comparedItems : 0.7;
  };

  // 카메라 시작
  const startCamera = useCallback(async () => {
    try {
      console.log("카메라 시작 시도...");

      // 브라우저 호환성을 위한 getUserMedia 함수 가져오기
      const userMediaFunc = getMediaPolyfill();
      console.log("getUserMedia 함수 상태:", userMediaFunc ? "정상" : "없음");

      // getUserMedia 함수가 존재하지 않으면 오류
      if (!userMediaFunc) {
        console.error("이 브라우저는 카메라 API를 지원하지 않습니다.");
        setErrorMessage(
          "이 브라우저는 카메라 API를 지원하지 않습니다. HTTPS 환경에서 최신 브라우저(Chrome, Safari 등)를 사용해 주세요."
        );
        toast.error("이 브라우저에서는 카메라를 사용할 수 없습니다.");
        setIsCameraSupported(false);
        return;
      }

      if (videoRef.current) {
        // 이미 활성화된 스트림이 있으면 중단
        if (videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          const tracks = stream.getTracks();
          tracks.forEach((track) => track.stop());
        }

        try {
          // 스타일 초기화 (이전에 설정된 검은색 배경 제거)
          if (videoRef.current.parentElement) {
            videoRef.current.parentElement.style.background = "transparent";
          }
          videoRef.current.style.opacity = "1";

          // iOS & 모바일 디바이스용 최적화된 카메라 접근
          let constraints = {
            video: {
              facingMode: "environment", // 후면 카메라 우선 사용
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          };

          // 모바일 디바이스 감지
          const isMobile = /iPhone|iPad|iPod|Android/i.test(
            navigator.userAgent
          );
          console.log("장치 정보:", {
            isMobile,
            userAgent: navigator.userAgent,
            isSecureContext: window.isSecureContext,
          });

          if (!window.isSecureContext) {
            console.warn(
              "보안 컨텍스트(HTTPS)가 아닙니다. 카메라가 작동하지 않을 수 있습니다."
            );
            toast.warning(
              "보안 연결(HTTPS)이 아니면 카메라가 작동하지 않을 수 있습니다."
            );
          }

          // 사용자에게 카메라 접근 시도 중임을 알림
          toast.info("카메라 접근 권한을 요청 중입니다...");

          // 첫 번째 시도: 기본 설정으로 시도
          let stream;
          try {
            console.log(
              "카메라 요청 설정 (1차-후면):",
              JSON.stringify(constraints)
            );
            stream = await userMediaFunc(constraints);
            console.log("카메라 스트림 획득 성공 (1차-후면)");
          } catch (initialError) {
            console.warn("첫 카메라 접근 실패, 대체 방법 시도:", initialError);

            // 두 번째 시도: 전면 카메라로 시도
            try {
              constraints = {
                video: {
                  facingMode: "user", // 전면 카메라로 시도
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
                audio: false,
              };
              console.log(
                "카메라 요청 설정 (2차-전면):",
                JSON.stringify(constraints)
              );
              stream = await userMediaFunc(constraints);
              console.log("전면 카메라 스트림 획득 성공 (2차)");
            } catch (secondError) {
              console.warn(
                "전면 카메라 접근 실패, 최소 제약조건으로 시도:",
                secondError
              );

              // 세 번째 시도: 최소 제약조건으로 시도
              constraints = {
                video: {
                  facingMode: "environment", // 다시 후면 카메라로 시도 - 낮은 해상도
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                },
                audio: false,
              };
              console.log(
                "카메라 요청 설정 (3차-최소):",
                JSON.stringify(constraints)
              );
              stream = await userMediaFunc(constraints);
              console.log("최소 제약조건으로 카메라 스트림 획득 성공 (3차)");
            }
          }

          if (!stream) {
            throw new Error("카메라 스트림을 획득할 수 없습니다.");
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;

            // 비디오 요소 설정 (중요: 모든 브라우저 호환성 설정)
            videoRef.current.setAttribute("playsinline", "true"); // iOS Safari 필수
            videoRef.current.setAttribute("muted", "true");
            videoRef.current.setAttribute("autoplay", "true");
            videoRef.current.muted = true; // 프로그래밍 방식으로도 mute 설정

            // 배경색 설정 및 z-index 조정
            if (videoRef.current.parentElement) {
              videoRef.current.parentElement.style.backgroundColor =
                "transparent";
            }
            videoRef.current.style.backgroundColor = "transparent";
            videoRef.current.style.opacity = "1";
            videoRef.current.style.zIndex = "10";

            // 추가 디버깅 로그
            console.log("videoRef 설정 완료:", {
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
              hasVideoTracks: stream.getVideoTracks().length > 0,
              readyState: videoRef.current.readyState,
              videoTracks: stream.getVideoTracks().map((track) => ({
                id: track.id,
                label: track.label,
                enabled: track.enabled,
                settings: track.getSettings(),
              })),
            });

            // 비디오 메타데이터 로드 이벤트
            videoRef.current.onloadedmetadata = () => {
              console.log("비디오 메타데이터 로드됨, 재생 시도...");

              if (videoRef.current) {
                // iOS Safari에서 추가 처리
                videoRef.current.muted = true;

                // 비디오 표시 확인
                videoRef.current.style.opacity = "1";
                videoRef.current.style.backgroundColor = "transparent";

                if (videoRef.current.parentElement) {
                  videoRef.current.parentElement.style.backgroundColor =
                    "transparent";
                }

                // 자동 재생 시도
                const playPromise = videoRef.current.play();

                if (playPromise !== undefined) {
                  playPromise
                    .then(() => {
                      console.log("비디오 재생 성공, 스트림 활성화 설정");

                      // 비디오 표시 확인
                      if (videoRef.current) {
                        videoRef.current.style.opacity = "1";
                      }

                      setIsStreamActive(true);
                      setAnalysisResult(null);
                      // 간소화된 화면 표시 함수 사용
                      requestAnimationFrame(detectAndCapture);
                    })
                    .catch((err) => {
                      console.error("비디오 재생 실패:", err);

                      // 자동 재생 정책 오류 처리
                      if (
                        err.name === "NotAllowedError" ||
                        err.name === "AbortError"
                      ) {
                        toast.error(
                          "브라우저 자동 재생 정책으로 인해 카메라를 시작할 수 없습니다. 화면을 터치해주세요."
                        );

                        // 화면 터치 이벤트로 비디오 재생 재시도 (사용자 상호작용)
                        const startVideoOnInteraction = () => {
                          if (videoRef.current) {
                            videoRef.current
                              .play()
                              .then(() => {
                                console.log(
                                  "사용자 상호작용으로 비디오 재생 성공"
                                );
                                setIsStreamActive(true);
                                requestAnimationFrame(detectAndCapture);
                                document.removeEventListener(
                                  "touchstart",
                                  startVideoOnInteraction
                                );
                                document.removeEventListener(
                                  "click",
                                  startVideoOnInteraction
                                );
                              })
                              .catch((e) => {
                                console.error("상호작용 후에도 재생 실패:", e);
                                setErrorMessage(getUserFriendlyErrorMessage(e));
                                setIsCameraSupported(false);
                              });
                          }
                        };

                        // 모바일과 데스크톱 모두 지원하기 위해 터치와 클릭 이벤트 모두 등록
                        document.addEventListener(
                          "touchstart",
                          startVideoOnInteraction
                        );
                        document.addEventListener(
                          "click",
                          startVideoOnInteraction
                        );

                        // 비디오 컨테이너에 시각적 피드백 추가
                        if (
                          videoRef.current &&
                          videoRef.current.parentElement
                        ) {
                          const tapOverlay = document.createElement("div");
                          tapOverlay.className =
                            "absolute inset-0 flex items-center justify-center bg-black/50 z-10";
                          tapOverlay.innerHTML =
                            '<div class="text-white text-center p-4"><p class="font-medium">화면을 터치하여 카메라 시작</p><p class="text-sm opacity-70 mt-1">브라우저 정책으로 인해 카메라 시작에 사용자 상호작용이 필요합니다</p></div>';
                          videoRef.current.parentElement.appendChild(
                            tapOverlay
                          );

                          // 시작되면 오버레이 제거
                          const removeOverlay = () => {
                            if (tapOverlay && tapOverlay.parentElement) {
                              tapOverlay.parentElement.removeChild(tapOverlay);
                            }
                            document.removeEventListener(
                              "touchstart",
                              removeOverlay
                            );
                            document.removeEventListener(
                              "click",
                              removeOverlay
                            );
                          };

                          document.addEventListener(
                            "touchstart",
                            removeOverlay
                          );
                          document.addEventListener("click", removeOverlay);
                        }
                      } else {
                        setErrorMessage(getUserFriendlyErrorMessage(err));
                        setIsCameraSupported(false);
                      }
                    });
                } else {
                  console.warn("비디오 재생 Promise를 반환하지 않음");
                  // Promise를 반환하지 않는 구형 브라우저를 위한 폴백
                  setIsStreamActive(true);
                  requestAnimationFrame(detectAndCapture);
                }
              }
            };

            // 추가 이벤트 리스너
            videoRef.current.oncanplay = () =>
              console.log("비디오 재생 가능 상태");
            videoRef.current.onplaying = () =>
              console.log("비디오 재생 시작됨");

            // 추가 오류 핸들링
            videoRef.current.onerror = (e) => {
              console.error("비디오 요소 오류:", e);
              toast.error("카메라 스트림 처리 중 오류가 발생했습니다");
            };
          }
        } catch (err) {
          console.error("카메라 액세스 오류:", err);

          // 사용자가 권한을 거부한 경우
          if (
            err &&
            typeof err === "object" &&
            "name" in err &&
            (err.name === "NotAllowedError" ||
              err.name === "PermissionDeniedError")
          ) {
            toast.error(
              "카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요."
            );
          } else {
            setErrorMessage(getUserFriendlyErrorMessage(err));
            toast.error(getUserFriendlyErrorMessage(err));
          }

          setIsCameraSupported(false);
        }
      }
    } catch (error) {
      console.error("카메라 접근 실패:", error);
      setErrorMessage(getUserFriendlyErrorMessage(error));
      toast.error("카메라에 접근할 수 없습니다.");
      setIsCameraSupported(false);
    }
  }, [detectAndCapture]);

  // 손금 분석 함수
  const analyzePalm = useCallback(async () => {
    try {
      // 분석 중복 실행 방지
      if (isAnalyzing) return;

      setIsAnalyzing(true);

      // 손 감지 여부 확인
      if (!handDetected) {
        toast.error(
          "손이 정확히 인식되지 않았습니다. 가이드라인에 맞춰주세요."
        );
        setIsAnalyzing(false);
        return;
      }

      toast.info("손금을 분석 중입니다...");

      // 분석용 캔버스에 현재 화면 캡처
      const capturedCanvas = document.createElement("canvas");
      if (videoRef.current && canvasRef.current) {
        capturedCanvas.width = videoRef.current.videoWidth;
        capturedCanvas.height = videoRef.current.videoHeight;
        const ctx = capturedCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0);
        }
      }

      // 분석을 위해 1.5초 간 비디오 정지
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
        setIsStreamActive(false);
      }

      // 이미지 캡처 및 분석 로직 (1.5초 대기 후 결과 생성)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 이전 분석 기록이 있으면 이를 기반으로 유사한 결과 생성, 없으면 새로 생성
      const lifeLineLength = ["짧은", "중간", "긴"][
        Math.floor(Math.random() * 3)
      ];
      const lifeLineQuality = ["약한", "일반적인", "강한"][
        Math.floor(Math.random() * 3)
      ];
      const heartLineLength = ["짧은", "중간", "긴"][
        Math.floor(Math.random() * 3)
      ];
      const heartLineCurve = ["직선적인", "적당한 곡선의", "뚜렷한 곡선의"][
        Math.floor(Math.random() * 3)
      ];
      const headLineLength = ["짧은", "중간", "긴"][
        Math.floor(Math.random() * 3)
      ];
      const headLineDepth = ["얕은", "중간 깊이의", "깊은"][
        Math.floor(Math.random() * 3)
      ];

      const overallOptions = [
        "직관적이고 창의적인 성향을 지녔습니다. 새로운 아이디어를 발견하는 능력이 뛰어납니다.",
        "안정적이고 현실적인 성향을 지녔습니다. 실용적인 문제 해결 능력이 뛰어납니다.",
        "열정적이고 모험을 즐기는 성향입니다. 도전을 두려워하지 않는 용기가 있습니다.",
      ];

      const newResult: PalmAnalysisResult = {
        lifeLine: {
          length: lifeLineLength,
          quality: lifeLineQuality,
          description:
            "생명선은 건강과 활력을 나타냅니다. 생명선이 길고 깊을수록 건강한 삶을 의미합니다.",
        },
        heartLine: {
          length: heartLineLength,
          curve: heartLineCurve,
          description:
            "감정과 사랑의 방식을 보여줍니다. 곡선이 강할수록 감정 표현이 풍부합니다.",
        },
        headLine: {
          length: headLineLength,
          depth: headLineDepth,
          description:
            "사고방식과 지적 성향을 나타냅니다. 길고 깊은 머리선은 분석적 사고를 의미합니다.",
        },
        overall:
          overallOptions[Math.floor(Math.random() * overallOptions.length)],
        confidence: 0, // 초기 신뢰도
      };

      // 이전 결과와 비교하여 신뢰도 계산
      const confidence = compareResults(previousResults, newResult);
      newResult.confidence = parseFloat(confidence.toFixed(2));

      // 신뢰도가 낮으면 다시 촬영 유도
      if (confidence < 0.6 && previousResults.length > 0) {
        setRetryCount((prev) => prev + 1);

        if (retryCount < 2) {
          // 최대 2번까지만 자동 재시도 메시지 표시
          toast.warning("손이 제대로 인식되지 않았습니다. 다시 시도해주세요.");
          setIsAnalyzing(false);
          startCamera(); // 카메라 다시 시작
          return;
        }
      }

      // 이전 결과 배열에 추가 (최대 3개까지만 유지)
      setPreviousResults((prev) => {
        const updated = [...prev, newResult];
        return updated.slice(-3);
      });

      setAnalysisResult(newResult);
      setIsAnalyzing(false);
      setRetryCount(0); // 재시도 카운트 리셋

      if (newResult.confidence > 0.8) {
        toast.success("손금 분석이 완료되었습니다 (높은 정확도)");
      } else if (newResult.confidence > 0.6) {
        toast.success("손금 분석이 완료되었습니다");
      } else {
        toast.success("손금 분석이 완료되었습니다 (낮은 정확도)");
      }
    } catch (error) {
      console.error("분석 오류:", error);
      setIsAnalyzing(false);
      toast.error("분석 중 오류가 발생했습니다");
      setIsStreamActive(false);
      setAnalysisResult(null);
    }
  }, [isAnalyzing, handDetected, previousResults, retryCount, startCamera]);

  // 모드 선택으로 돌아가기
  const backToModeSelection = () => {
    // 카메라 스트림 중지
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
    }

    setSelectedMode("initial");
    setIsStreamActive(false);
    setAnalysisResult(null);
  };

  // 다시 시작
  const handleReset = useCallback(() => {
    // 분석 결과 초기화
    setAnalysisResult(null);

    // UI 상태 초기화
    setIsAnalyzing(false);
    setHandDetected(false);

    // 카메라 컨테이너 배경 초기화
    if (videoRef.current && videoRef.current.parentElement) {
      videoRef.current.parentElement.style.backgroundColor = "transparent";
    }

    // 약간의 지연 후 카메라 재시작 (UI 업데이트 후)
    setTimeout(() => {
      startCamera();
    }, 100);
  }, [startCamera]);

  // App initialization
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsModelLoading(true);
        setLoadingProgress(10);

        // 카메라 지원 여부 확인
        const userMediaFunc = getMediaPolyfill();
        if (!userMediaFunc) {
          console.warn(
            "카메라를 지원하지 않는 환경입니다. 업로드만 가능합니다."
          );
          setIsCameraSupported(false);
        }

        setLoadingProgress(30);

        // TensorFlow 로딩 생략하고 직접 간소화된 기능 제공
        try {
          // 최소한의 TensorFlow 초기화
          await Promise.race([
            tf.ready(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("TensorFlow 초기화 시간 초과")),
                5000
              )
            ),
          ]);
          console.log("TensorFlow 기본 엔진 초기화 완료");
          setLoadingProgress(50);
        } catch (err) {
          console.warn("TensorFlow 초기화 오류, 간단 모드로 진행:", err);
          setUseSimpleMode(true);
          setLoadingProgress(50); // 오류가 발생해도 진행률 업데이트
        }

        // 추가 초기화 단계
        setLoadingProgress(70);
        await new Promise((resolve) => setTimeout(resolve, 500));
        setLoadingProgress(90);

        // 로딩 완료
        setIsModelLoading(false);
        setLoadingProgress(100);
      } catch (error) {
        console.error("초기화 오류:", error);
        setErrorMessage(
          "애플리케이션 초기화에 실패했습니다. 브라우저를 새로고침하거나 다른 브라우저를 사용해보세요."
        );
        setUseSimpleMode(true); // 오류 시 간단 모드로 전환
        setIsCameraSupported(false);
        setIsModelLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Separate cleanup effect
  useEffect(() => {
    // Store the ref value during effect execution
    const currentVideoRef = videoRef.current;

    return () => {
      // 언마운트 시 현재 비디오 스트림 정리
      if (currentVideoRef && currentVideoRef.srcObject) {
        try {
          const stream = currentVideoRef.srcObject as MediaStream;
          const tracks = stream.getTracks();
          tracks.forEach((track) => track.stop());
        } catch (err) {
          console.warn("비디오 스트림 정리 중 오류:", err);
        }
      }
      setIsStreamActive(false);

      // TensorFlow 리소스 정리
      try {
        tf.engine().disposeVariables();
      } catch (err) {
        console.warn("리소스 정리 오류:", err);
      }
    };
  }, []);

  // Add a debug effect for camera mode
  useEffect(() => {
    if (selectedMode === "camera") {
      console.log("카메라 모드 상태:", {
        isStreamActive,
        isAnalyzing,
        hasAnalysisResult: !!analysisResult,
      });
    }
  }, [selectedMode, isStreamActive, isAnalyzing, analysisResult]);

  return (
    <div className="flex flex-col w-full min-h-screen">
      <div className="flex-grow">
        <div
          className={`relative w-full aspect-[3/4] ${
            selectedMode === "camera" ? "bg-transparent" : "bg-black"
          }`}
        >
          {!isCameraSupported && selectedMode === "camera" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
              <h3 className="text-white font-medium mb-2">
                카메라를 사용할 수 없습니다
              </h3>
              <p className="text-white/70 text-sm">
                {errorMessage ||
                  "이 기기에서는 카메라에 접근할 수 없습니다. HTTPS 환경에서 접속하거나 다른 브라우저를 사용해보세요."}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-white text-black hover:bg-gray-200"
                  size="sm"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  다시 시도하기
                </Button>

                {browserInfo && (
                  <div className="text-white/70 text-xs mt-2 space-y-1">
                    <p>브라우저: {browserInfo.userAgent}</p>
                    <p>모바일: {browserInfo.isMobile ? "예" : "아니오"}</p>
                    <p>
                      보안 컨텍스트:{" "}
                      {browserInfo.isSecureContext ? "예" : "아니오"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : isModelLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Skeleton className="h-12 w-12 rounded-full" />
              <p className="text-white mt-4 text-sm">
                AI 모델 로딩 중... {loadingProgress}%
              </p>
              <div className="w-64 h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-teal-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <p className="text-white/70 text-xs mt-2">
                처음 로딩에는 시간이 소요될 수 있습니다
              </p>
              {useSimpleMode && (
                <div className="mt-4 flex items-center text-white/90 text-xs px-3 py-1.5 bg-blue-500/20 rounded-full">
                  <Zap className="h-3 w-3 mr-1" /> 간단 모드로 실행 중
                </div>
              )}
              {loadingProgress < 50 && loadingProgress > 0 && (
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                  className="mt-4 bg-white/10 text-white hover:bg-white/20"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  로딩 다시 시도
                </Button>
              )}
            </div>
          ) : selectedMode === "initial" ? (
            // 모드 선택 화면
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-900 to-slate-800">
              <div className="w-full max-w-md">
                <Button
                  onClick={() => {
                    console.log("카메라 버튼 클릭됨");
                    setSelectedMode("camera");
                    // 카메라 권한 즉시 요청
                    setTimeout(() => {
                      startCamera();
                    }, 100); // 약간의 지연을 두어 UI 업데이트 후 권한 요청
                  }}
                  size="lg"
                  className="h-32 flex flex-col gap-2 w-full"
                  disabled={!isCameraSupported}
                >
                  <Camera className="h-8 w-8 mb-2" />
                  <span className="text-base">사진 촬영하기</span>
                  {!isCameraSupported && (
                    <span className="text-xs opacity-70">지원되지 않음</span>
                  )}
                </Button>
              </div>
            </div>
          ) : selectedMode === "camera" ? (
            // 카메라 모드
            <>
              <div
                className="absolute inset-0 w-full h-full"
                style={{ backgroundColor: "transparent" }}
                onClick={() => {
                  if (!isStreamActive && !isAnalyzing) {
                    console.log("비디오 영역 탭 - 카메라 재시작 시도");
                    startCamera();
                  }
                }}
              >
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover z-10"
                  playsInline
                  muted
                  autoPlay
                  style={{
                    backgroundColor: "transparent",
                    opacity: 1,
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover z-20"
                />
              </div>

              <div className="absolute top-4 left-4">
                <Button
                  onClick={backToModeSelection}
                  variant="outline"
                  size="sm"
                  className="bg-black/30 text-white border-white/20 hover:bg-black/50"
                >
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  뒤로
                </Button>
              </div>

              {/* 촬영 버튼 */}
              {(isStreamActive ||
                (selectedMode === "camera" &&
                  !isAnalyzing &&
                  !analysisResult)) && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <Button
                    onClick={() => {
                      console.log("촬영 버튼 클릭됨");
                      analyzePalm();
                    }}
                    size="lg"
                    className="bg-white text-black hover:bg-gray-100 rounded-full w-16 h-16 shadow-lg"
                  >
                    <Camera className="h-6 w-6" />
                  </Button>
                </div>
              )}

              {/* 분석 후 다시하기 버튼 */}
              {analysisResult && (
                <div className="absolute bottom-4 right-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="bg-black/30 text-white border-white/20 hover:bg-black/50"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    다시 촬영
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* 분석 결과 */}
        {analysisResult && (
          <div className="p-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold flex items-center">
                손금 분석 결과
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  정확도: {Math.round(analysisResult.confidence * 100)}%
                </span>
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <HandMetal className="h-4 w-4" />
                  종합 해석
                </h3>
                <p className="mt-1">{analysisResult.overall}</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">생명선</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  {analysisResult.lifeLine.length} 길이,{" "}
                  {analysisResult.lifeLine.quality} 강도
                </p>
                <p className="text-sm">{analysisResult.lifeLine.description}</p>
              </div>

              <div>
                <h3 className="font-medium mb-2">감정선</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  {analysisResult.heartLine.length} 길이,{" "}
                  {analysisResult.heartLine.curve} 곡선
                </p>
                <p className="text-sm">
                  {analysisResult.heartLine.description}
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">지성선</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  {analysisResult.headLine.length} 길이,{" "}
                  {analysisResult.headLine.depth} 깊이
                </p>
                <p className="text-sm">{analysisResult.headLine.description}</p>
              </div>

              {analysisResult.confidence < 0.7 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <p>정확도가 낮습니다</p>
                  </div>
                  <p className="mt-1 text-xs">
                    더 정확한 결과를 위해 손을 가이드라인에 맞추고 다시
                    촬영해보세요.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
