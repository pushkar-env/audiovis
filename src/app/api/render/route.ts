import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { createJob, getJob } from "@/utils/jobManager";
import { renderVideoServer } from "@/utils/serverRenderer";
import { VisualizerConfig } from "@/store/editorState";

export async function POST(req: NextRequest) {
  try {
    const { fileId, config } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId parameter" }, { status: 400 });
    }

    if (!config) {
      return NextResponse.json({ error: "Missing config parameter" }, { status: 400 });
    }

    // Locate the uploaded audio file in the temp uploads folder
    const tempDir = path.join(process.cwd(), "public", "temp_uploads");
    const files = fs.readdirSync(tempDir);
    const audioFileName = files.find((f) => f.startsWith(fileId));

    if (!audioFileName) {
      return NextResponse.json(
        { error: `Temporary audio file with ID ${fileId} not found. Please upload again.` },
        { status: 404 }
      );
    }

    const audioFilePath = path.join(tempDir, audioFileName);
    const jobId = crypto.randomUUID();

    // Create the job record in-memory
    createJob(jobId, audioFileName);

    // Trigger rendering in the background (DO NOT await it here!)
    // This allows the route to return immediately and the client to poll status.
    renderVideoServer(jobId, audioFilePath, config as VisualizerConfig)
      .catch((err) => {
        console.error(`[api/render] Background render job ${jobId} failed:`, err);
      });

    return NextResponse.json({
      success: true,
      jobId,
      status: "idle",
      progress: 0,
    });
  } catch (error: any) {
    console.error("API render request failed:", error);
    return NextResponse.json(
      { error: `Failed to queue render task: ${error.message || error}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId query parameter" }, { status: 400 });
    }

    const job = getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: `Job with ID ${jobId} not found` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      videoUrl: job.videoUrl,
      error: job.error,
    });
  } catch (error: any) {
    console.error("API render status check failed:", error);
    return NextResponse.json(
      { error: `Failed to fetch status: ${error.message || error}` },
      { status: 500 }
    );
  }
}
