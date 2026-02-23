import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClaudeClient } from "@/lib/claude/client";
import { SIMILARITY_CHECK_PROMPT } from "@/lib/generation/prompts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const { synopsis, genre, themes, plotPoints } = await req.json();

    if (!synopsis) {
      return NextResponse.json({ error: "synopsis is required" }, { status: 400 });
    }

    // Build the user message with all available context
    let userMessage = `以下のプロットについて、類似する既存作品を調べてください。\n\n`;

    if (genre) {
      userMessage += `## ジャンル\n${genre}\n\n`;
    }

    userMessage += `## あらすじ\n${synopsis}\n\n`;

    if (themes && themes.length > 0) {
      userMessage += `## テーマ\n${themes.join("、")}\n\n`;
    }

    if (plotPoints && plotPoints.length > 0) {
      userMessage += `## プロットポイント\n`;
      for (const point of plotPoints) {
        userMessage += `- 【${point.act}】${point.title}: ${point.description}\n`;
      }
      userMessage += `\n`;
    }

    const client = getClaudeClient();
    const response = await client.chat({
      model: "claude-sonnet-4-20250514",
      systemPrompt: SIMILARITY_CHECK_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0.3,
      maxTokens: 4096,
    });

    // Parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Similarity check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
