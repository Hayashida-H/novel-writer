import { Header } from "@/components/layout/header";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="レビュー" />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">レビューハブ</p>
          <p className="mt-1 text-sm">
            モバイルで小説形式のレビュー・アノテーションを行います
          </p>
          <p className="mt-4 text-xs">Phase 4で実装予定</p>
        </div>
      </div>
    </div>
  );
}
