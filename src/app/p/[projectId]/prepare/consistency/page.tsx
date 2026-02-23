import { Header } from "@/components/layout/header";
import { ConsistencyChecker } from "@/components/consistency/consistency-checker";

export default async function ConsistencyPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="整合性チェック" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <ConsistencyChecker projectId={projectId} />
      </div>
    </div>
  );
}
