import { Header } from "@/components/layout/header";

export default async function PlotPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="プロット" />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">プロット構造エディタ</p>
          <p className="mt-1 text-sm">
            起承転結タイムラインでストーリーを設計します
          </p>
          <p className="mt-4 text-xs">Phase 2で実装予定</p>
        </div>
      </div>
    </div>
  );
}
