import { cookies } from "next/headers";
import { Sidebar } from "@/components/layout/sidebar";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromToken } from "@/lib/auth";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const db = getDb();
  const [project] = await db
    .select({ title: projects.title })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const projectTitle = project?.title || "プロジェクト";

  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  const user = token ? await getSessionFromToken(token) : null;
  const userRole = (user?.role as "manager" | "reviewer") ?? undefined;

  return (
    <div className="flex h-screen">
      <div className="hidden md:block">
        <Sidebar
          projectId={projectId}
          projectTitle={projectTitle}
          userRole={userRole}
        />
      </div>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
