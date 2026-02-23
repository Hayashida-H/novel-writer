import { Header } from "@/components/layout/header";
import { StructureEditor } from "@/components/structure/structure-editor";

export default async function StructurePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="構成" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <StructureEditor projectId={projectId} />
      </div>
    </div>
  );
}
