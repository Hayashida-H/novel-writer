import { Header } from "@/components/layout/header";
import { ForeshadowingList } from "@/components/foreshadowing/foreshadowing-list";

export default async function ForeshadowingPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="伏線管理" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <ForeshadowingList projectId={projectId} />
      </div>
    </div>
  );
}
