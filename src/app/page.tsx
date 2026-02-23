export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { LogoutButton } from "@/components/auth/logout-button";

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  preparation: { label: "準備中", variant: "secondary" },
  writing: { label: "執筆中", variant: "default" },
  reviewing: { label: "レビュー中", variant: "outline" },
  completed: { label: "完了", variant: "default" },
};

export default async function HomePage() {
  const db = getDb();
  const projectList = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Novel Writer</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              AI小説自動生成アプリケーション
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                新規プロジェクト
              </Link>
            </Button>
            <LogoutButton />
          </div>
        </div>

        {projectList.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold">
                まだプロジェクトがありません
              </h2>
              <p className="mb-6 text-center text-muted-foreground">
                新しいプロジェクトを作成して、AIと一緒に小説を書き始めましょう
              </p>
              <Button asChild>
                <Link href="/projects/new">
                  <Plus className="mr-2 h-4 w-4" />
                  最初のプロジェクトを作成
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projectList.map((project) => {
              const statusInfo =
                STATUS_LABELS[project.status] || STATUS_LABELS.preparation;
              return (
                <Link key={project.id} href={`/p/${project.id}`}>
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">
                          {project.title}
                        </CardTitle>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      {project.genre && (
                        <CardDescription>{project.genre}</CardDescription>
                      )}
                    </CardHeader>
                    {project.description && (
                      <CardContent>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {project.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
