import { Header } from "@/components/layout/header";
import { GlossaryList } from "@/components/glossary/glossary-list";

export default async function GlossaryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="用語集" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <GlossaryList projectId={projectId} />
      </div>
    </div>
  );
}
