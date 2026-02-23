import { Header } from "@/components/layout/header";
import { PlotEditor } from "@/components/plot/plot-editor";

export default async function PlotPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="プロット" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <PlotEditor projectId={projectId} />
      </div>
    </div>
  );
}
