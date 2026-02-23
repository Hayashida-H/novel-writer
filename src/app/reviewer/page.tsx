export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BookOpen, Eye } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function ReviewerPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) redirect("/login");

  const user = await getSessionFromToken(token);
  if (!user) redirect("/login");

  const db = getDb();
  const projectList = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">レビュー</h1>
            <p className="text-sm text-muted-foreground">
              {user.username} さん
            </p>
          </div>
          <LogoutButton />
        </div>

        {projectList.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader className="text-center py-12">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <CardTitle className="text-base">
                まだプロジェクトがありません
              </CardTitle>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4">
            {projectList.map((project) => (
              <Link key={project.id} href={`/p/${project.id}/review`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader className="flex flex-row items-center gap-3">
                    <Eye className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">
                        {project.title}
                      </CardTitle>
                      {project.description && (
                        <CardDescription className="line-clamp-1">
                          {project.description}
                        </CardDescription>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
