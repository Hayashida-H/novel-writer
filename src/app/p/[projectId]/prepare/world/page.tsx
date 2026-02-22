import { Header } from "@/components/layout/header";

export default async function WorldPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="世界観" />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">世界観設定</p>
          <p className="mt-1 text-sm">
            地理・文化・ルールなどの世界設定を管理します
          </p>
          <p className="mt-4 text-xs">Phase 2で実装予定</p>
        </div>
      </div>
    </div>
  );
}
