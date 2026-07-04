import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Define supported extensions
const SUPPORTED_EXTENSIONS = [".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 500MB limit" }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file format: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Prepare temp uploads directory in the project
    const uploadDir = path.join(process.cwd(), "public", "temp_uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique ID
    const fileId = crypto.randomUUID();
    const fileName = `${fileId}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Read file data and save
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      fileId,
      fileName: originalName,
      fileSize: file.size,
      filePath: `/temp_uploads/${fileName}`,
    });
  } catch (error: any) {
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { error: `Upload processing failed: ${error.message || error}` },
      { status: 500 }
    );
  }
}
