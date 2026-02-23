import { NextRequest, NextResponse } from "next/server";
import { getPipeline, getActivePipelineIds } from "@/lib/agents/pipeline";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: Get pipeline status
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const pipelineId = req.nextUrl.searchParams.get("pipelineId");

  if (pipelineId) {
    const pipeline = getPipeline(pipelineId);
    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }
    return NextResponse.json({
      pipelineId: pipeline.pipelineId,
      state: pipeline.state,
      progress: pipeline.progress,
    });
  }

  // Return all active pipeline IDs
  const ids = getActivePipelineIds();
  return NextResponse.json({ activePipelines: ids });
}

// POST: Control pipeline (pause/resume/cancel)
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { pipelineId, action } = body as {
      pipelineId: string;
      action: "pause" | "resume" | "cancel";
    };

    if (!pipelineId || !action) {
      return NextResponse.json(
        { error: "pipelineId and action are required" },
        { status: 400 }
      );
    }

    const pipeline = getPipeline(pipelineId);
    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    switch (action) {
      case "pause":
        pipeline.pause();
        break;
      case "resume":
        pipeline.resume();
        break;
      case "cancel":
        pipeline.cancel();
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action. Use: pause, resume, cancel" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      pipelineId: pipeline.pipelineId,
      state: pipeline.state,
      progress: pipeline.progress,
    });
  } catch (error) {
    console.error("Failed to control pipeline:", error);
    return NextResponse.json({ error: "Failed to control pipeline" }, { status: 500 });
  }
}
