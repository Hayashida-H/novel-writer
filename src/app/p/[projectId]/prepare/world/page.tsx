import { Header } from "@/components/layout/header";
import { WorldSettingsList } from "@/components/world/world-settings-list";

export default async function WorldPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="世界観" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <WorldSettingsList projectId={projectId} />
      </div>
    </div>
  );
}
