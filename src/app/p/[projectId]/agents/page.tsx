import { Header } from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentConfigList } from "@/components/agents/agent-config-list";
import { StyleReferenceList } from "@/components/agents/style-reference-list";

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="エージェント" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <Tabs defaultValue="agents">
          <TabsList>
            <TabsTrigger value="agents">エージェント設定</TabsTrigger>
            <TabsTrigger value="style">文体参照</TabsTrigger>
          </TabsList>
          <TabsContent value="agents" className="mt-4">
            <AgentConfigList projectId={projectId} />
          </TabsContent>
          <TabsContent value="style" className="mt-4">
            <StyleReferenceList projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
