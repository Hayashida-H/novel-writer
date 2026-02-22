import { Header } from "@/components/layout/header";

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="エージェント" />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">エージェント設定</p>
          <p className="mt-1 text-sm">
            7つのAIエージェントの設定・カスタマイズを行います
          </p>
          <p className="mt-4 text-xs">Phase 3で実装予定</p>
        </div>
      </div>
    </div>
  );
}
