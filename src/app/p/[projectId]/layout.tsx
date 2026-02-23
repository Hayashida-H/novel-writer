import { Sidebar } from "@/components/layout/sidebar";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

  return (
    <div className="flex h-screen">
      <div className="hidden md:block">
        <Sidebar projectId={projectId} projectTitle={projectTitle} />
      </div>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
