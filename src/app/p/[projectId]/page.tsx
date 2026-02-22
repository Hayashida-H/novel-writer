import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Map,
  Users,
  Globe,
  PenTool,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

export default async function ProjectDashboard({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // TODO: Fetch project data
  const project = {
    title: "プロジェクト",
    status: "preparation",
    genre: "",
    description: "",
  };

  const quickLinks = [
    {
      href: `/p/${projectId}/prepare/chat`,
      icon: MessageSquare,
      label: "チャット",
      description: "Claudeと会話して設定を構築",
    },
    {
      href: `/p/${projectId}/prepare/plot`,
      icon: Map,
      label: "プロット",
      description: "物語の構造を設計",
    },
    {
      href: `/p/${projectId}/prepare/characters`,
      icon: Users,
      label: "キャラクター",
      description: "登場人物の管理",
    },
    {
      href: `/p/${projectId}/prepare/world`,
      icon: Globe,
      label: "世界観",
      description: "世界設定の管理",
    },
    {
      href: `/p/${projectId}/write`,
      icon: PenTool,
      label: "執筆",
      description: "エージェントによる自動執筆",
    },
    {
      href: `/p/${projectId}/review`,
      icon: BookOpen,
      label: "レビュー",
      description: "書籍形式で閲読・指摘",
    },
  ];

  return (
    <div>
      <Header
        projectId={projectId}
        projectTitle={project.title}
        title="ダッシュボード"
      />
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">{project.title}</h2>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">準備中</Badge>
            {project.genre && (
              <span className="text-sm text-muted-foreground">
                {project.genre}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-center gap-3">
                  <link.icon className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{link.label}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
