import { ReaderView } from "@/components/review/reader-view";

export default async function ChapterReaderPage({
  params,
}: {
  params: Promise<{ projectId: string; chapterId: string }>;
}) {
  const { projectId, chapterId } = await params;

  return <ReaderView projectId={projectId} chapterId={chapterId} />;
}
