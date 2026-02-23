import { Header } from "@/components/layout/header";
import { ReviewHub } from "@/components/review/review-hub";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="レビュー" />
      <div className="flex-1 overflow-hidden p-4 md:p-6">
        <ReviewHub projectId={projectId} />
      </div>
    </div>
  );
}
