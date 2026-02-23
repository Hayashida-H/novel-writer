import { NextRequest, NextResponse } from "next/server";
import { exportProjectAsMarkdown } from "@/lib/export/markdown";
import { exportProjectAsPlaintext } from "@/lib/export/plaintext";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const format = req.nextUrl.searchParams.get("format") || "markdown";

    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let content: string;
    let filename: string;
    let contentType: string;

    if (format === "plaintext") {
      content = await exportProjectAsPlaintext(projectId);
      filename = "novel.txt";
      contentType = "text/plain; charset=utf-8";
    } else {
      const includeMetadata = req.nextUrl.searchParams.get("metadata") !== "false";
      content = await exportProjectAsMarkdown(projectId, { includeMetadata });
      filename = "novel.md";
      contentType = "text/markdown; charset=utf-8";
    }

    return new Response(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Export failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
