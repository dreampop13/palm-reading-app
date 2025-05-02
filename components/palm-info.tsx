"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Heart, Brain, Activity, HandMetal } from "lucide-react";

const palmLines = [
  {
    id: "life",
    icon: <Activity className="h-4 w-4" />,
    name: "생명선",
    description:
      "생명선은 엄지 손가락과 검지 사이에서 시작하여 손목 방향으로 이어지는 선입니다. 이 선은 건강, 체력, 활력 및 전반적인 웰빙을 나타냅니다.",
    details: [
      {
        title: "긴 생명선",
        description:
          "장수와 좋은 건강을 의미합니다. 활력이 넘치고 강한 체력을 지녔을 가능성이 높습니다.",
      },
      {
        title: "짧은 생명선",
        description:
          "꼭 짧은 수명을 의미하지는 않으며, 체력이나 건강 관리에 더 신경을 써야 함을 의미하는 경우가 많습니다.",
      },
      {
        title: "깊은 생명선",
        description: "활력과 건강함을 나타냅니다.",
      },
      {
        title: "얕은 생명선",
        description: "건강과 에너지 수준에 변동이 있을 수 있음을 시사합니다.",
      },
      {
        title: "끊어진 생명선",
        description:
          "건강의 중대한 변화나 삶의 중요한 사건을 나타낼 수 있습니다.",
      },
    ],
  },
  {
    id: "heart",
    icon: <Heart className="h-4 w-4" />,
    name: "감정선",
    description:
      "감정선은 새끼손가락 아래에서 시작하여 검지와 중지 방향으로 손바닥을 가로지르는 선입니다. 이 선은 감정적 상태, 관계에 대한 접근 방식, 그리고 사랑에 대한 성향을 나타냅니다.",
    details: [
      {
        title: "긴 감정선",
        description:
          "감정 표현이 풍부하고 깊은 감정을 경험하는 경향이 있음을 나타냅니다.",
      },
      {
        title: "짧은 감정선",
        description:
          "감정보다 논리와 실용성을 우선시하는 성향을 나타낼 수 있습니다.",
      },
      {
        title: "곡선이 강한 감정선",
        description: "낭만적이고 감정적으로 표현력이 풍부한 성향을 나타냅니다.",
      },
      {
        title: "직선적인 감정선",
        description:
          "감정을 더 통제하고 논리적인 방식으로 접근하는 성향을 나타냅니다.",
      },
      {
        title: "가지가 많은 감정선",
        description: "복잡한 감정적 경험과 다양한 관계를 의미할 수 있습니다.",
      },
    ],
  },
  {
    id: "head",
    icon: <Brain className="h-4 w-4" />,
    name: "지성선",
    description:
      "지성선은 엄지와 검지 사이에서 시작하여 손바닥을 가로질러 새끼손가락 쪽으로 이어지는 선입니다. 이 선은 지적 능력, 사고 방식, 의사소통 스타일을 나타냅니다.",
    details: [
      {
        title: "긴 지성선",
        description:
          "철저한 사고와 집중력이 뛰어남을 나타냅니다. 분석적 능력이 강한 경향이 있습니다.",
      },
      {
        title: "짧은 지성선",
        description:
          "빠른 사고와 신속한 결정을 내리는 성향을 나타낼 수 있습니다.",
      },
      {
        title: "곡선형 지성선",
        description: "창의적이고 예술적인 사고 성향을 나타냅니다.",
      },
      {
        title: "직선형 지성선",
        description: "논리적이고 실용적인 사고 성향을 나타냅니다.",
      },
      {
        title: "깊은 지성선",
        description: "집중력과 명확한 사고력을 나타냅니다.",
      },
    ],
  },
  {
    id: "other",
    icon: <HandMetal className="h-4 w-4" />,
    name: "기타 손금",
    description:
      "주요 손금 외에도 다양한 보조 손금들이 손의 특성과 운명에 대한 추가 정보를 제공합니다.",
    details: [
      {
        title: "운명선",
        description:
          "손목에서 중지 쪽으로 이어지는 수직선으로, 직업과 인생의 방향을 나타냅니다.",
      },
      {
        title: "태양선",
        description:
          "약지 아래에 위치하며, 명성, 성공, 재능, 창의성과 관련이 있습니다.",
      },
      {
        title: "결혼선",
        description: "새끼손가락 아래의 수평선으로, 중요한 관계를 나타냅니다.",
      },
      {
        title: "건강선",
        description:
          "소지 아래에서 시작하여 감정선 방향으로 이어지는 선으로, 건강과 웰빙에 관한 정보를 제공합니다.",
      },
      {
        title: "여행선",
        description: "손목 근처의 수평선으로, 여행과 이동을 나타냅니다.",
      },
    ],
  },
];

export default function PalmInfo() {
  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">손금 지식 백과</h2>
        <p className="text-sm text-muted-foreground">
          다양한 손금의 의미와 해석에 대한 정보를 알아보세요.
        </p>
      </div>

      <Tabs defaultValue="life" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {palmLines.map((line) => (
            <TabsTrigger
              key={line.id}
              value={line.id}
              className="flex items-center gap-1"
            >
              {line.icon}
              <span className="hidden sm:inline">{line.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {palmLines.map((line) => (
          <TabsContent key={line.id} value={line.id} className="mt-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2">
                  {line.icon}
                  {line.name}
                </h3>
                <p className="mt-2 text-sm">{line.description}</p>
              </div>

              <Separator />

              <div className="space-y-3">
                {line.details.map((detail, index) => (
                  <div key={index}>
                    <h4 className="font-medium text-sm">{detail.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {detail.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
