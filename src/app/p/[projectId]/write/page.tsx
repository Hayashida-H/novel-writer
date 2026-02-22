import { Header } from "@/components/layout/header";

export default async function WritePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="執筆" />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">執筆ダッシュボード</p>
          <p className="mt-1 text-sm">
            エージェントパイプラインで自動執筆を制御します
          </p>
          <p className="mt-4 text-xs">Phase 3で実装予定</p>
        </div>
      </div>
    </div>
  );
}
