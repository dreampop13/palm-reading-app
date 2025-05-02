"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Camera, HandMetal, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-converter";
import {
  getUserMedia as getMediaPolyfill,
  getBrowserInfo,
  getCameraConstraints,
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
};

export default function PalmReader() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detector, setDetector] =
    useState<handPoseDetection.HandDetector | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<PalmAnalysisResult | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isCameraSupported, setIsCameraSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [browserInfo, setBrowserInfo] = useState<ReturnType<
    typeof getBrowserInfo
  > | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // 브라우저 환경 정보 설정
  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window !== "undefined") {
      const info = getBrowserInfo();
      setBrowserInfo(info);
      console.log("브라우저 환경 정보:", info);
    }
  }, []);

  // 손금 분석 함수 - 먼저 정의하여 의존성 문제 해결
  const analyzePalm = useCallback(
    async (hand: handPoseDetection.Hand) => {
      try {
        // 분석 중복 실행 방지
        if (isAnalyzing) return;

        setIsAnalyzing(true);
        toast.info("손금을 분석 중입니다...");

        // 분석을 위해 1.5초 간 비디오 정지
        if (videoRef.current?.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          const tracks = stream.getTracks();
          tracks.forEach((track) => track.stop());
          setIsStreamActive(false);
        }

        // 감지된 손 좌표 활용
        console.log("감지된 손 키포인트:", hand.keypoints.length);

        // 이미지 캡처 및 분석 로직 (1.5초 대기 후 결과 생성)
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // 손금 분석 결과 (실제로는 TensorFlow 모델로 분석해야 함)
        // 여기서는 예시 결과 생성
        const result: PalmAnalysisResult = {
          lifeLine: {
            length: ["짧은", "중간", "긴"][Math.floor(Math.random() * 3)],
            quality: ["약한", "일반적인", "강한"][
              Math.floor(Math.random() * 3)
            ],
            description:
              "당신의 생명선은 건강과 활력을 나타냅니다. 생명선이 길고 깊을수록 건강한 삶을 의미합니다.",
          },
          heartLine: {
            length: ["짧은", "중간", "긴"][Math.floor(Math.random() * 3)],
            curve: ["직선적인", "적당한 곡선의", "뚜렷한 곡선의"][
              Math.floor(Math.random() * 3)
            ],
            description:
              "당신의 감정과 사랑의 방식을 보여줍니다. 곡선이 강할수록 감정 표현이 풍부합니다.",
          },
          headLine: {
            length: ["짧은", "중간", "긴"][Math.floor(Math.random() * 3)],
            depth: ["얕은", "중간 깊이의", "깊은"][
              Math.floor(Math.random() * 3)
            ],
            description:
              "당신의 사고방식과 지적 성향을 나타냅니다. 길고 깊은 머리선은 분석적 사고를 의미합니다.",
          },
          overall: [
            "당신은 직관적이고 창의적인 성향을 지녔습니다. 새로운 아이디어를 발견하는 능력이 뛰어납니다.",
            "안정적이고 현실적인 성향을 지녔습니다. 실용적인 문제 해결 능력이 뛰어납니다.",
            "열정적이고 모험을 즐기는 성향입니다. 도전을 두려워하지 않는 용기가 있습니다.",
          ][Math.floor(Math.random() * 3)],
        };

        setAnalysisResult(result);
        setIsAnalyzing(false);
        toast.success("손금 분석이 완료되었습니다");
      } catch (error) {
        console.error("분석 오류:", error);
        setIsAnalyzing(false);
        toast.error("분석 중 오류가 발생했습니다");
        // 오류 발생 시 상태 초기화만 수행
        setIsStreamActive(false);
        setAnalysisResult(null);
      }
    },
    [isAnalyzing]
  ); // 의존성 배열 최소화

  // 손 인식 루프
  const detectHands = useCallback(async () => {
    if (!detector || !videoRef.current || !canvasRef.current || !isStreamActive)
      return;

    try {
      // 분석 중일 때는 검출 중단
      if (isAnalyzing) return;

      // 손 인식 실행
      const hands = await detector.estimateHands(videoRef.current);

      // 결과 그리기
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      // 캔버스 초기화
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      // 비디오 사이즈에 맞게 캔버스 조절
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      // 손바닥 가이드라인 그리기 (점선 원)
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 2;
      const centerX = videoWidth / 2;
      const centerY = videoHeight / 2;
      const radius = Math.min(videoWidth, videoHeight) * 0.35;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 손 위치 가이드 텍스트
      if (hands.length === 0) {
        ctx.font = "20px Arial";
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.textAlign = "center";
        ctx.fillText(
          "손바닥을 가이드라인에 맞추세요",
          centerX,
          centerY - radius - 20
        );
      } else {
        // 손이 감지되면 자동으로 분석 시작
        const hand = hands[0];

        // 손바닥 중심 계산 (엄지 밑 부분과 새끼손가락 밑 부분의 중간점)
        const palm = {
          x: (hand.keypoints[0].x + hand.keypoints[17].x) / 2,
          y: (hand.keypoints[0].y + hand.keypoints[17].y) / 2,
        };

        // 손이 가이드라인 중앙에 있는지 확인
        const distanceFromCenter = Math.sqrt(
          Math.pow(palm.x - centerX, 2) + Math.pow(palm.y - centerY, 2)
        );

        // 손이 가이드라인 안에 있을 때 자동으로 캡처
        if (distanceFromCenter < radius * 0.5) {
          // 손금 분석 시작
          analyzePalm(hand);
        }
      }

      // 다음 프레임 계속 처리
      if (isStreamActive && !isAnalyzing) {
        requestAnimationFrame(detectHands);
      }
    } catch (error) {
      console.error("손 인식 오류:", error);
      // 오류가 있어도 계속 실행
      if (isStreamActive && !isAnalyzing) {
        requestAnimationFrame(detectHands);
      }
    }
  }, [detector, isAnalyzing, isStreamActive, analyzePalm]);

  // 카메라 시작
  const startCamera = useCallback(async () => {
    try {
      console.log("카메라 시작 시도...");

      // 브라우저 호환성을 위한 getUserMedia 함수 가져오기
      const userMediaFunc = getMediaPolyfill();

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
          // 환경에 맞는 제약 조건 가져오기
          const constraints = getCameraConstraints();
          console.log("카메라 요청 설정:", JSON.stringify(constraints));

          // 호환성을 고려한 getUserMedia 호출
          const stream = await userMediaFunc(constraints);
          console.log("카메라 스트림 획득 성공");

          if (videoRef.current) {
            videoRef.current.srcObject = stream;

            // iOS Safari에서 autoplay 정책 대응
            videoRef.current.setAttribute("playsinline", "true");
            videoRef.current.setAttribute("muted", "true");
            videoRef.current.setAttribute("autoplay", "true");

            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                console.log("비디오 메타데이터 로드됨, 재생 시도...");
                videoRef.current
                  .play()
                  .then(() => {
                    console.log("비디오 재생 성공");
                    setIsStreamActive(true);
                    setAnalysisResult(null);
                    requestAnimationFrame(detectHands);
                  })
                  .catch((err) => {
                    console.error("비디오 재생 실패:", err);
                    setErrorMessage(getUserFriendlyErrorMessage(err));
                    setIsCameraSupported(false);
                  });
              }
            };
          }
        } catch (err) {
          console.error("카메라 액세스 오류:", err);
          setErrorMessage(getUserFriendlyErrorMessage(err));
          toast.error(getUserFriendlyErrorMessage(err));
          setIsCameraSupported(false);
        }
      }
    } catch (error) {
      console.error("카메라 접근 실패:", error);
      setErrorMessage(getUserFriendlyErrorMessage(error));
      toast.error("카메라에 접근할 수 없습니다.");
      setIsCameraSupported(false);
    }
  }, [detectHands]);

  // 모델 초기화
  useEffect(() => {
    let loadingTimeoutId: NodeJS.Timeout;

    const checkMediaDevicesSupport = () => {
      const userMediaFunc = getMediaPolyfill();
      if (!userMediaFunc) {
        console.error("이 브라우저는 카메라 API를 지원하지 않습니다.");
        setErrorMessage(
          "이 브라우저는 카메라 API를 지원하지 않습니다. 최신 버전의 Chrome, Safari, Firefox 등의 브라우저를 사용해 주세요."
        );
        setIsCameraSupported(false);
        setIsModelLoading(false);
        return false;
      }
      return true;
    };

    // 로딩이 오래 걸릴 경우 대체 방안 제공
    const setupLoadingTimeout = () => {
      // 10초 후에도 로딩이 완료되지 않으면 사용자에게 알림
      loadingTimeoutId = setTimeout(() => {
        if (isModelLoading && loadingProgress <= 70) {
          console.log("모델 로딩이 오래 걸리고 있습니다. 대체 로직 시도...");

          // 진행률 표시 업데이트
          setLoadingProgress(75);
          toast.info(
            "모델 로딩에 시간이 걸리고 있습니다. 대체 모델로 전환합니다."
          );

          // 더 간단한 모델로 재시도
          tryAlternativeModel();
        }
      }, 10000);
    };

    // 대체 모델 사용
    const tryAlternativeModel = async () => {
      try {
        console.log("대체 모델 로딩 시도...");

        // 기존 진행 중인 모델 로딩 정리
        try {
          tf.engine().endScope();
          tf.engine().disposeVariables();
        } catch (e) {
          console.warn("TensorFlow.js 엔진 정리 오류:", e);
        }

        // 더 가벼운 대체 모델 설정
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const simpleConfig = {
          runtime: "tfjs",
          modelType: "lite",
          maxHands: 1,
          // 더 가볍고 간단한 검출 모델만 사용
          detectorModelUrl:
            "https://tfhub.dev/mediapipe/tfjs-model/handpose_3d/detector/lite/1",
        } as handPoseDetection.MediaPipeHandsTfjsModelConfig;

        setLoadingProgress(80);

        // 대체 모델 로드 시도
        const handDetector = await handPoseDetection.createDetector(
          model,
          simpleConfig
        );

        if (handDetector) {
          console.log("대체 모델 로드 성공");
          setLoadingProgress(95);
          setDetector(handDetector);
          setIsModelLoading(false);
          setLoadingProgress(100);
          startCamera();
        } else {
          throw new Error("대체 모델 로드 실패");
        }
      } catch (error) {
        console.error("대체 모델 로드 실패:", error);
        setErrorMessage(
          "모델 로드에 실패했습니다. 브라우저를 새로고침하거나 다른 브라우저를 사용해보세요."
        );
        setLoadingProgress(0);
        setIsCameraSupported(false);
        setIsModelLoading(false);
      }
    };

    const loadModel = async () => {
      try {
        setIsModelLoading(true);
        setLoadingProgress(5);

        // 카메라 지원 여부 확인
        if (!checkMediaDevicesSupport()) {
          return;
        }

        setLoadingProgress(10);

        // 로딩 타임아웃 설정
        setupLoadingTimeout();

        // TensorFlow.js 초기화 - Vercel 배포에서 로딩 문제 해결을 위한 백오프 재시도 로직 추가
        let tfReady = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!tfReady && retryCount < maxRetries) {
          try {
            console.log(
              `TensorFlow.js 초기화 시도 ${retryCount + 1}/${maxRetries}`
            );
            await tf.ready();

            // 모델 캐시 정리 시도
            try {
              console.log("TensorFlow.js 엔진 상태 확인");
              tf.engine().startScope(); // 새 스코프 시작
            } catch (e) {
              console.warn("TensorFlow.js 엔진 스코프 시작 오류:", e);
            }

            tfReady = true;
            console.log("TensorFlow.js 초기화 완료");
            setLoadingProgress(30);
          } catch (err) {
            console.error(
              `TensorFlow.js 초기화 실패 (시도 ${retryCount + 1}):`,
              err
            );
            retryCount++;
            // 지수 백오프 (500ms, 1000ms, 2000ms)
            await new Promise((resolve) =>
              setTimeout(resolve, 500 * Math.pow(2, retryCount - 1))
            );
          }
        }

        if (!tfReady) {
          throw new Error("TensorFlow.js 초기화 실패");
        }

        setLoadingProgress(50);

        // 손 인식 모델 로드 - 백오프 재시도 로직 추가
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig = {
          runtime: "tfjs",
          modelType: "lite", // 'full' 대신 'lite' 사용하여 모델 크기 감소
          maxHands: 1,
          solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands", // CDN 경로 명시적 지정
          detectorModelUrl:
            "https://tfhub.dev/mediapipe/tfjs-model/handpose_3d/detector/lite/1", // 명시적으로 더 가벼운 detector 모델 지정
          // landmarkModelUrl 제거하여 불필요한 모델 로딩 방지
        } as handPoseDetection.MediaPipeHandsTfjsModelConfig;

        console.log("손 인식 모델 로드 중...");

        let handDetector = null;
        retryCount = 0;

        while (!handDetector && retryCount < maxRetries) {
          try {
            console.log(
              `손 인식 모델 로드 시도 ${retryCount + 1}/${maxRetries}`
            );
            // 진행률 업데이트 (50% ~ 90% 사이에서 진행)
            setLoadingProgress(
              50 + Math.floor(((retryCount + 1) * 40) / maxRetries)
            );

            // 모델 로드 타임아웃 설정 (각 시도마다 8초)
            const modelLoadPromise = handPoseDetection.createDetector(
              model,
              detectorConfig
            );
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("모델 로드 시간 초과")), 8000);
            });

            // 타임아웃과 모델 로드 중 먼저 완료되는 것 사용
            handDetector = (await Promise.race([
              modelLoadPromise,
              timeoutPromise,
            ])) as handPoseDetection.HandDetector;
            console.log("손 인식 모델 로드 완료");
          } catch (err) {
            console.error(
              `손 인식 모델 로드 실패 (시도 ${retryCount + 1}):`,
              err
            );
            retryCount++;
            // 지수 백오프
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1))
            );
          }
        }

        if (!handDetector) {
          throw new Error("손 인식 모델 로드 실패");
        }

        setLoadingProgress(95);
        setDetector(handDetector);
        setIsModelLoading(false);
        setLoadingProgress(100);

        // 카메라 스트림 시작
        startCamera();
      } catch (error) {
        console.error("모델 로드 실패:", error);
        // 일반적인 모델 로드 실패 시 대체 모델 시도
        console.log("기본 모델 로드 실패, 대체 모델 시도...");
        tryAlternativeModel();
      }
    };

    loadModel();

    // 컴포넌트 언마운트 시 정리
    return () => {
      // 타임아웃 정리
      if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
      }

      // 언마운트 시 현재 비디오 스트림 저장
      const currentVideo = videoRef.current;
      if (currentVideo && currentVideo.srcObject) {
        const stream = currentVideo.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
        setIsStreamActive(false);
      }

      // TensorFlow.js 리소스 정리
      try {
        console.log("TensorFlow.js 리소스 정리");
        tf.engine().endScope();
        tf.engine().disposeVariables();
      } catch (err) {
        console.error("TensorFlow.js 리소스 정리 중 오류:", err);
      }
    };
  }, [startCamera, isModelLoading, loadingProgress]); // 의존성 추가

  // 다시 시작
  const handleReset = useCallback(() => {
    setAnalysisResult(null);
    startCamera();
  }, [startCamera]);

  return (
    <div className="flex flex-col w-full">
      <div className="relative w-full aspect-[4/3] bg-black">
        {!isCameraSupported ? (
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
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {!isStreamActive && !isAnalyzing && !analysisResult && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Button onClick={startCamera} size="lg" className="gap-2">
                  <Camera className="h-4 w-4" />
                  카메라 시작
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 분석 결과 */}
      {analysisResult && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">손금 분석 결과</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              다시 찍기
            </Button>
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
              <p className="text-sm">{analysisResult.heartLine.description}</p>
            </div>

            <div>
              <h3 className="font-medium mb-2">지성선</h3>
              <p className="text-sm text-muted-foreground mb-1">
                {analysisResult.headLine.length} 길이,{" "}
                {analysisResult.headLine.depth} 깊이
              </p>
              <p className="text-sm">{analysisResult.headLine.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
