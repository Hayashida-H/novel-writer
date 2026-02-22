import { Header } from "@/components/layout/header";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="チャット" />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">準備チャット</p>
          <p className="mt-1 text-sm">
            Claudeと会話してプロット・キャラクター・世界観を構築します
          </p>
          <p className="mt-4 text-xs">Phase 2で実装予定</p>
        </div>
      </div>
    </div>
  );
}
