import { Sidebar } from "@/components/layout/sidebar";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // TODO: Fetch project title from DB
  const projectTitle = "プロジェクト";

  return (
    <div className="flex h-screen">
      <div className="hidden md:block">
        <Sidebar projectId={projectId} projectTitle={projectTitle} />
      </div>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
