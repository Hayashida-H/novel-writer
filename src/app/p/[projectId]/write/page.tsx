import { Header } from "@/components/layout/header";
import { WritingDashboard } from "@/components/write/writing-dashboard";

export default async function WritePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="執筆" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <WritingDashboard projectId={projectId} />
      </div>
    </div>
  );
}
