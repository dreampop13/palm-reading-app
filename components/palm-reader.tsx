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
  Upload,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [selectedMode, setSelectedMode] = useState<
    "initial" | "camera" | "upload"
  >("initial");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

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

  // 손금 분석 함수
  const analyzePalm = useCallback(async () => {
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

      // 이미지 캡처 및 분석 로직 (1.5초 대기 후 결과 생성)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 손금 분석 결과 (랜덤 생성)
      const result: PalmAnalysisResult = {
        lifeLine: {
          length: ["짧은", "중간", "긴"][Math.floor(Math.random() * 3)],
          quality: ["약한", "일반적인", "강한"][Math.floor(Math.random() * 3)],
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
          depth: ["얕은", "중간 깊이의", "깊은"][Math.floor(Math.random() * 3)],
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
      setIsStreamActive(false);
      setAnalysisResult(null);
    }
  }, [isAnalyzing]);

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
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 2;
    const centerX = videoWidth / 2;
    const centerY = videoHeight / 2;
    const radius = Math.min(videoWidth, videoHeight) * 0.35;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 가이드 텍스트
    ctx.font = "20px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText(
      "손바닥을 가이드라인에 맞추고 촬영 버튼을 누르세요",
      centerX,
      centerY - radius - 20
    );

    // 다음 프레임
    if (isStreamActive && !isAnalyzing) {
      requestAnimationFrame(detectAndCapture);
    }
  }, [isStreamActive, isAnalyzing]);

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
                    // 간소화된 화면 표시 함수 사용
                    requestAnimationFrame(detectAndCapture);
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
  }, [detectAndCapture]);

  // 파일 업로드 처리
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 이미지 파일 확인
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedImage(result);

      // 업로드된 이미지가 있으면 스트림 중지
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
        setIsStreamActive(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // 업로드된 이미지 분석
  const analyzeUploadedImage = async () => {
    if (!uploadedImage) return;

    setIsAnalyzing(true);
    toast.info("손금을 분석 중입니다...");

    // 분석 로직 (1.5초 대기 후 결과 생성)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 손금 분석 결과 (랜덤 생성)
    const result: PalmAnalysisResult = {
      lifeLine: {
        length: ["짧은", "중간", "긴"][Math.floor(Math.random() * 3)],
        quality: ["약한", "일반적인", "강한"][Math.floor(Math.random() * 3)],
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
        depth: ["얕은", "중간 깊이의", "깊은"][Math.floor(Math.random() * 3)],
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
  };

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
    setUploadedImage(null);
    setAnalysisResult(null);
  };

  // 다시 시작
  const handleReset = useCallback(() => {
    setAnalysisResult(null);

    if (selectedMode === "camera") {
      startCamera();
    } else {
      setUploadedImage(null);
      setSelectedMode("upload");
    }
  }, [startCamera, selectedMode]);

  // 초기화 로직 변경
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

    return () => {
      // 언마운트 시 현재 비디오 스트림 정리
      const currentVideo = videoRef.current;
      if (currentVideo && currentVideo.srcObject) {
        const stream = currentVideo.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
        setIsStreamActive(false);
      }

      // TensorFlow 리소스 정리
      try {
        tf.engine().disposeVariables();
      } catch (err) {
        console.warn("리소스 정리 오류:", err);
      }
    };
  }, []);

  return (
    <div className="flex flex-col w-full">
      <div className="relative w-full aspect-[4/3] bg-black">
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
                onClick={backToModeSelection}
                className="bg-white text-black hover:bg-gray-200"
                size="sm"
              >
                <ArrowLeft className="h-3 w-3 mr-2" />
                다른 방법으로 시도하기
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
            <h3 className="text-white font-medium mb-6 text-xl">
              손금 읽기 방법 선택
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-md">
              <Button
                onClick={() => {
                  setSelectedMode("camera");
                  startCamera();
                }}
                size="lg"
                className="h-32 flex flex-col gap-2"
                disabled={!isCameraSupported}
              >
                <Camera className="h-8 w-8 mb-2" />
                <span className="text-base">사진 촬영하기</span>
                {!isCameraSupported && (
                  <span className="text-xs opacity-70">지원되지 않음</span>
                )}
              </Button>

              <Button
                onClick={() => {
                  setSelectedMode("upload");
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                variant="outline"
                size="lg"
                className="h-32 flex flex-col gap-2"
              >
                <Upload className="h-8 w-8 mb-2" />
                <span className="text-base">이미지 업로드</span>
              </Button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        ) : selectedMode === "camera" ? (
          // 카메라 모드
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
                <Button onClick={startCamera} size="lg" className="gap-2 mb-4">
                  <Camera className="h-4 w-4" />
                  카메라 시작
                </Button>
                <Button
                  onClick={backToModeSelection}
                  variant="outline"
                  size="sm"
                  className="bg-black/30 text-white border-white/20 hover:bg-black/50"
                >
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  다시 선택하기
                </Button>
              </div>
            )}

            {/* 촬영 버튼 및 뒤로가기 버튼 */}
            {isStreamActive && !isAnalyzing && !analysisResult && (
              <>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <Button
                    onClick={analyzePalm}
                    size="lg"
                    className="bg-white text-black hover:bg-gray-100 rounded-full w-16 h-16 shadow-lg"
                  >
                    <Camera className="h-6 w-6" />
                  </Button>
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
              </>
            )}
          </>
        ) : selectedMode === "upload" && !uploadedImage ? (
          // 업로드 모드 - 파일 선택 전
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="flex flex-col items-center justify-center w-full max-w-md">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="lg"
                className="gap-2 w-full max-w-xs h-32 flex flex-col"
              >
                <Upload className="h-8 w-8 mb-2" />
                <span className="text-base">손바닥 이미지 선택</span>
                <span className="text-xs opacity-70">JPG, PNG 파일</span>
              </Button>

              <Button
                onClick={backToModeSelection}
                variant="outline"
                size="sm"
                className="mt-4"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                다시 선택하기
              </Button>
            </div>
          </div>
        ) : uploadedImage && !analysisResult ? (
          // 업로드 모드 - 이미지 선택 후
          <div className="absolute inset-0 flex flex-col">
            <div className="relative flex-grow">
              <img
                src={uploadedImage}
                alt="업로드된 이미지"
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div className="absolute top-4 left-4 flex gap-2">
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
            </div>
            <div className="p-4 flex justify-center">
              <Button
                onClick={analyzeUploadedImage}
                className="gap-2"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <HandMetal className="h-4 w-4" />
                    손금 분석하기
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* 분석 결과 */}
      {analysisResult && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">손금 분석 결과</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                다시 시도
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={backToModeSelection}
                className="gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                다른 방법
              </Button>
            </div>
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
