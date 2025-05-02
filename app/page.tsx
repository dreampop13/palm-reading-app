"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Camera, Book } from "lucide-react";
import PalmReader from "@/components/palm-reader";
import PalmInfo from "@/components/palm-info";

export default function Home() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <header className="mb-6 text-center py-4">
        <h1 className="text-2xl font-bold">손금 읽기 앱</h1>
        <p className="text-muted-foreground mt-2">
          당신의 손바닥을 카메라에 비추면 AI가 손금을 분석해 드립니다
        </p>
      </header>

      <PalmReader />

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        <p>© 2024 손금 읽기 앱</p>
        <p className="mt-1">
          TensorFlow.js와 Next.js로 구현된 AI 손금 분석 애플리케이션
        </p>
      </footer>
    </div>
  );
}
