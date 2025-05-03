# TensorFlow.js를 활용한 손금 분석 머신러닝 모델 개발 방법

손금 분석에 머신러닝 모델을 적용하는 과정을 단계별로 안내해 드리겠습니다. 웹 애플리케이션에서는 TensorFlow.js를 사용하는 것이 가장 적합합니다.

## 1. 데이터 수집 및 준비

먼저 모델 학습을 위한 데이터셋이 필요합니다:

1. **데이터 수집**: 다양한 손바닥 이미지와 해당 손금 분석 결과(라벨)을 수집합니다.

   - 최소 수백 개 이상의 손바닥 이미지가 필요합니다
   - 다양한 조명 조건, 손 크기, 피부색을 포함해야 합니다
   - 각 이미지에 대해 손금 특성(생명선 길이, 감정선 곡률 등)을 라벨링합니다

2. **데이터 전처리**:
   - 이미지 크기 조정 (예: 224x224 픽셀)
   - 색상 정규화 (RGB 값을 0-1 범위로 변환)
   - 데이터 증강 (회전, 확대/축소, 대비 조정 등을 통해 데이터셋 확장)

## 2. 모델 설계 및 학습

TensorFlow.js를 사용하여 모델을 설계하고 학습시키는 두 가지 방법이 있습니다:

### A. 사전 학습된 모델을 전이 학습으로 활용

```javascript
// 사전 학습된 MobileNet 모델 로드
const mobilenet = await tf.loadLayersModel(
  "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json"
);

// 특성 추출 모델 생성 (마지막 분류 레이어 제외)
const feature = mobilenet.getLayer("conv_pw_13_relu");
const featureModel = tf.model({
  inputs: mobilenet.inputs,
  outputs: feature.output,
});

// 새로운 분류 모델 생성
const model = tf.sequential();
model.add(tf.layers.flatten({ inputShape: feature.outputShape.slice(1) }));
model.add(tf.layers.dense({ units: 100, activation: "relu" }));
model.add(tf.layers.dense({ units: 3, activation: "softmax" })); // 3개 클래스 예시 (짧은/중간/긴)

// 모델 컴파일
model.compile({
  optimizer: tf.train.adam(0.0001),
  loss: "categoricalCrossentropy",
  metrics: ["accuracy"],
});

// 전이 학습
await model.fit(xs, ys, {
  epochs: 20,
  batchSize: 32,
  validationSplit: 0.2,
  callbacks: {
    onEpochEnd: (epoch, logs) =>
      console.log(
        `Epoch ${epoch}: loss = ${logs.loss}, accuracy = ${logs.acc}`
      ),
  },
});
```

### B. 손금 인식을 위한 맞춤형 모델 구축

```javascript
// 맞춤형 CNN 모델 생성
const model = tf.sequential();

// 입력 레이어
model.add(
  tf.layers.conv2d({
    inputShape: [224, 224, 3],
    filters: 32,
    kernelSize: 3,
    activation: "relu",
  })
);
model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

// 추가 컨볼루션 레이어
model.add(tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: "relu" }));
model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
model.add(
  tf.layers.conv2d({ filters: 128, kernelSize: 3, activation: "relu" })
);
model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

// 완전 연결 레이어
model.add(tf.layers.flatten());
model.add(tf.layers.dense({ units: 128, activation: "relu" }));
model.add(tf.layers.dropout({ rate: 0.5 }));

// 다중 출력 (여러 손금 특성 예측)
// 생명선 길이
const lifeLineOutput = tf.layers.dense({
  units: 3,
  activation: "softmax",
  name: "lifeLine",
});
// 감정선 곡률
const heartLineOutput = tf.layers.dense({
  units: 3,
  activation: "softmax",
  name: "heartLine",
});
// 지성선 깊이
const headLineOutput = tf.layers.dense({
  units: 3,
  activation: "softmax",
  name: "headLine",
});

// 다중 출력 모델 생성
const combinedOutput = tf.layers
  .concatenate()
  .apply([
    lifeLineOutput.apply(model.output),
    heartLineOutput.apply(model.output),
    headLineOutput.apply(model.output),
  ]);

const multiOutputModel = tf.model({
  inputs: model.input,
  outputs: combinedOutput,
});

// 모델 컴파일
multiOutputModel.compile({
  optimizer: tf.train.adam(0.0001),
  loss: "categoricalCrossentropy",
  metrics: ["accuracy"],
});

// 학습
await multiOutputModel.fit(xs, ys, {
  epochs: 50,
  batchSize: 32,
  validationSplit: 0.2,
});

// 모델 저장
await multiOutputModel.save("localstorage://palm-reading-model");
```

## 3. 웹 애플리케이션에 모델 통합

모델을 학습시킨 후 현재 애플리케이션에 통합하는 단계입니다:

```javascript
// components/palm-reader.tsx 수정

// 모델 로드 로직을 initializeApp 함수에 추가
const initializeApp = async () => {
  try {
    setIsModelLoading(true);
    setLoadingProgress(10);

    // 카메라 지원 여부 확인
    const userMediaFunc = getMediaPolyfill();
    if (!userMediaFunc) {
      console.warn("카메라를 지원하지 않는 환경입니다.");
      setIsCameraSupported(false);
    }

    setLoadingProgress(20);

    // TensorFlow.js 초기화
    await tf.ready();
    console.log("TensorFlow 기본 엔진 초기화 완료");
    setLoadingProgress(40);

    // 모델 로드
    try {
      const model = await tf.loadLayersModel(
        "localstorage://palm-reading-model"
      );
      console.log("손금 분석 모델 로드 완료");
      setModel(model); // 상태에 모델 저장
      setLoadingProgress(80);
    } catch (err) {
      console.warn("모델 로드 실패, 기본 모드로 진행:", err);
      setUseSimpleMode(true);
    }

    setLoadingProgress(90);

    // 로딩 완료
    setIsModelLoading(false);
    setLoadingProgress(100);
  } catch (error) {
    console.error("초기화 오류:", error);
    setUseSimpleMode(true);
    setIsCameraSupported(false);
    setIsModelLoading(false);
  }
};
```

## 4. 손금 분석 함수 수정

다음은 실제 모델을 사용해 손금을 분석하는 코드입니다:

```javascript
// analyzePalm 함수 수정
const analyzePalm = useCallback(async () => {
  try {
    if (isAnalyzing) return;
    setIsAnalyzing(true);

    if (!handDetected) {
      toast.error("손이 정확히 인식되지 않았습니다. 가이드라인에 맞추세요.");
      setIsAnalyzing(false);
      return;
    }

    toast.info("손금을 분석 중입니다...");

    // 현재 화면 캡처
    const capturedCanvas = document.createElement("canvas");
    if (videoRef.current && canvasRef.current) {
      capturedCanvas.width = videoRef.current.videoWidth;
      capturedCanvas.height = videoRef.current.videoHeight;
      const ctx = capturedCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
      }
    }

    // 이미지 전처리
    const image = tf.browser
      .fromPixels(capturedCanvas)
      .resizeBilinear([224, 224]) // 모델 입력 크기에 맞게 조정
      .toFloat()
      .div(tf.scalar(255)) // 0-1 범위로 정규화
      .expandDims(0); // 배치 차원 추가

    // 모델로 예측 수행
    let result;
    if (model && !useSimpleMode) {
      const prediction = await model.predict(image);

      // 예측 결과 처리
      const lifeLineIdx = tf
        .argMax(prediction.slice([0, 0], [1, 3]), 1)
        .dataSync()[0];
      const heartLineIdx = tf
        .argMax(prediction.slice([0, 3], [1, 3]), 1)
        .dataSync()[0];
      const headLineIdx = tf
        .argMax(prediction.slice([0, 6], [1, 3]), 1)
        .dataSync()[0];

      // 신뢰도 계산
      const confidence =
        (prediction.slice([0, 0], [1, 3]).max().dataSync()[0] +
          prediction.slice([0, 3], [1, 3]).max().dataSync()[0] +
          prediction.slice([0, 6], [1, 3]).max().dataSync()[0]) /
        3;

      // 결과 매핑
      const lifeLineLengths = ["짧은", "중간", "긴"];
      const lifeLineQualities = ["약한", "일반적인", "강한"];
      const heartLineLengths = ["짧은", "중간", "긴"];
      const heartLineCurves = ["직선적인", "적당한 곡선의", "뚜렷한 곡선의"];
      const headLineLengths = ["짧은", "중간", "긴"];
      const headLineDepths = ["얕은", "중간 깊이의", "깊은"];

      const overallOptions = [
        "직관적이고 창의적인 성향을 지녔습니다. 새로운 아이디어를 발견하는 능력이 뛰어납니다.",
        "안정적이고 현실적인 성향을 지녔습니다. 실용적인 문제 해결 능력이 뛰어납니다.",
        "열정적이고 모험을 즐기는 성향입니다. 도전을 두려워하지 않는 용기가 있습니다.",
      ];

      result = {
        lifeLine: {
          length: lifeLineLengths[lifeLineIdx],
          quality: lifeLineQualities[Math.floor((lifeLineIdx * 3) / 2)],
          description:
            "생명선은 건강과 활력을 나타냅니다. 생명선이 길고 깊을수록 건강한 삶을 의미합니다.",
        },
        heartLine: {
          length: heartLineLengths[heartLineIdx],
          curve: heartLineCurves[heartLineIdx],
          description:
            "감정과 사랑의 방식을 보여줍니다. 곡선이 강할수록 감정 표현이 풍부합니다.",
        },
        headLine: {
          length: headLineLengths[headLineIdx],
          depth: headLineDepths[headLineIdx],
          description:
            "사고방식과 지적 성향을 나타냅니다. 길고 깊은 머리선은 분석적 사고를 의미합니다.",
        },
        overall:
          overallOptions[
            Math.floor((lifeLineIdx + heartLineIdx + headLineIdx) / 3)
          ],
        confidence: parseFloat(confidence.toFixed(2)),
      };

      // 메모리 정리
      image.dispose();
      prediction.dispose();
    } else {
      // 기존 랜덤 로직은 유지 (모델이 없을 경우 대체)
      // ...기존 랜덤 로직...
    }

    setAnalysisResult(result);
    setIsAnalyzing(false);

    if (result.confidence > 0.8) {
      toast.success("손금 분석이 완료되었습니다 (높은 정확도)");
    } else if (result.confidence > 0.6) {
      toast.success("손금 분석이 완료되었습니다");
    } else {
      toast.success("손금 분석이 완료되었습니다 (낮은 정확도)");
    }
  } catch (error) {
    console.error("분석 오류:", error);
    setIsAnalyzing(false);
    toast.error("분석 중 오류가 발생했습니다");
  }
}, [isAnalyzing, handDetected, model, useSimpleMode]);
```

## 5. 손 인식을 위한 추가 모델 구현

손금 분석 외에도 정확한 손 감지를 위해 MediaPipe Hands 모델을 활용할 수 있습니다:

```bash
npm install @tensorflow-models/hand-pose-detection @mediapipe/hands
```

```javascript
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import "@mediapipe/hands";

// 손 감지 모델 초기화 추가
const initHandModel = async () => {
  const detectorConfig = {
    runtime: "mediapipe",
    solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
    modelType: "lite",
  };

  const handDetector = await handPoseDetection.createDetector(
    handPoseDetection.SupportedModels.MediaPipeHands,
    detectorConfig
  );

  return handDetector;
};

// detectAndCapture 함수 수정
const detectAndCapture = useCallback(async () => {
  if (!videoRef.current || !canvasRef.current || !handDetector) return;

  const ctx = canvasRef.current.getContext("2d");
  if (!ctx) return;

  // 캔버스 초기화
  const width = videoRef.current.videoWidth || 640;
  const height = videoRef.current.videoHeight || 480;

  canvasRef.current.width = width;
  canvasRef.current.height = height;

  // 비디오 프레임 그리기
  if (videoRef.current.readyState >= 2) {
    ctx.drawImage(videoRef.current, 0, 0, width, height);
  }

  // 손 감지 (MediaPipe 사용)
  try {
    const hands = await handDetector.estimateHands(videoRef.current);

    if (hands.length > 0) {
      setHandDetected(true);

      // 손 랜드마크 그리기
      const palm = hands[0].keypoints;

      // 손바닥 중심 계산
      let centerX = 0;
      let centerY = 0;
      let palmPoints = 0;

      // 손바닥 중심 계산 (손바닥 랜드마크 평균)
      for (let i = 0; i < palm.length; i++) {
        if (palm[i].name && palm[i].name.includes("palm")) {
          centerX += palm[i].x;
          centerY += palm[i].y;
          palmPoints++;
        }
      }

      centerX /= palmPoints || 1;
      centerY /= palmPoints || 1;

      // 가이드라인 그리기
      const radius = width * 0.35;

      // 손바닥 감지 시 녹색으로 표시
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(0, 255, 0, 0.7)";
      ctx.lineWidth = 4;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 손금 랜드마크 연결 (손금 시각화)
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;

      // 손금 연결 (실제 손금 랜드마크는 MediaPipe에서 제공하지 않으므로
      // 여기서는 단순 예시로 특정 랜드마크를 연결)
      // 실제 구현시 손금 랜드마크를 감지하는 별도 모델 개발이 필요

      ctx.stroke();

      // "손 감지됨" 메시지 표시
      ctx.font = "bold 16px Arial";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.textAlign = "center";
      ctx.fillText("손 감지됨", width / 2, height - 30);
    } else {
      setHandDetected(false);
    }
  } catch (err) {
    console.warn("손 감지 오류:", err);
  }

  // 다음 프레임
  if (selectedMode === "camera" && !isAnalyzing) {
    requestAnimationFrame(detectAndCapture);
  }
}, [selectedMode, isAnalyzing, handDetector]);
```

## 6. 모델 학습을 위한 별도 스크립트 작성

모델 학습은 브라우저에서 직접 하기엔 시간이 오래 걸립니다. 별도의 Node.js 스크립트로 작성하는 것이 좋습니다:

```javascript
// model-training/train.js
const tf = require("@tensorflow/tfjs-node");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function loadImagesFromFolder(folder) {
  const images = [];
  const labels = [];

  const files = fs.readdirSync(folder);

  for (const file of files) {
    if (file.endsWith(".json")) {
      // 라벨 파일 읽기
      const labelPath = path.join(folder, file);
      const labelData = JSON.parse(fs.readFileSync(labelPath, "utf8"));

      // 이미지 파일 읽기
      const imagePath = path.join(folder, file.replace(".json", ".jpg"));
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const resizedImage = await sharp(imageBuffer)
          .resize(224, 224)
          .toBuffer();

        const tensor = tf.node
          .decodeImage(resizedImage, 3)
          .toFloat()
          .div(tf.scalar(255));

        images.push(tensor);
        labels.push([
          labelData.lifeLine.length === "short" ? 1 : 0,
          labelData.lifeLine.length === "medium" ? 1 : 0,
          labelData.lifeLine.length === "long" ? 1 : 0,
          // ... 기타 라벨 값
        ]);
      }
    }
  }

  return {
    images: tf.stack(images),
    labels: tf.tensor(labels),
  };
}

async function trainModel() {
  // 데이터 로드
  const trainData = await loadImagesFromFolder("./training-data");
  const validationData = await loadImagesFromFolder("./validation-data");

  // 모델 정의
  const model = tf.sequential();

  // 모델 레이어 추가 (위 예제와 동일)
  // ...

  // 모델 컴파일
  model.compile({
    optimizer: tf.train.adam(0.0001),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  // 학습
  await model.fit(trainData.images, trainData.labels, {
    epochs: 50,
    batchSize: 32,
    validationData: [validationData.images, validationData.labels],
    callbacks: tf.callbacks.earlyStopping({ patience: 5 }),
  });

  // 모델 저장
  await model.save("file://./palm-reading-model");
  console.log("모델 학습 및 저장 완료");
}

trainModel().catch(console.error);
```

## 7. TensorFlow.js 활용 시 주의사항

1. **성능 최적화**: 모바일 기기에서도 잘 작동하도록 최적화해야 합니다.

   - 가벼운 모델 사용 (MobileNet 등)
   - WebGL 백엔드 활용 (`tf.setBackend('webgl')`)
   - 불필요한 텐서는 즉시 `dispose()` 호출하여 메모리 관리

2. **학습 데이터 품질**: 손금 인식의 정확도는 학습 데이터의 품질에 크게 좌우됩니다.

   - 다양한 조명 조건
   - 다양한 손 크기와 모양
   - 다양한 피부색
   - 정확한 라벨링

3. **사용자 피드백**: 인식이 잘 되지 않을 때 사용자에게 어떻게 자세를 조정해야 하는지 알려주는 피드백이 중요합니다.

## 8. 실제 구현 계획

1. **1단계**: 손 감지 모델 통합 (MediaPipe)
2. **2단계**: 손금 인식을 위한 데이터 수집 및 라벨링
3. **3단계**: 별도 환경에서 모델 학습
4. **4단계**: 학습된 모델을 웹 앱에 통합
5. **5단계**: 성능 최적화 및 사용자 피드백 개선

이 방법으로 구현하면 실제로 사용자의 손금을 인식하고 분석할 수 있는 애플리케이션을 만들 수 있습니다. 다만, 정확한 손금 분석을 위해서는 많은 학습 데이터와 전문적인 라벨링이 필요하다는 점을 염두에 두시기 바랍니다.
