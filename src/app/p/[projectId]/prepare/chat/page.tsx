import { Header } from "@/components/layout/header";
import { ChatContainer } from "@/components/chat/chat-container";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="チャット" />
      <div className="flex-1 overflow-hidden">
        <ChatContainer projectId={projectId} />
      </div>
    </div>
  );
}
