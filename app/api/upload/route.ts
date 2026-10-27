import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return NextResponse.json(
      { error: "Sign in to upload an avatar." },
      { status: 401 },
    );
  const type = req.headers.get("content-type") ?? "";
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (!extensions[type])
    return NextResponse.json(
      { error: "Choose a JPEG, PNG, or WebP image." },
      { status: 400 },
    );
  const reader = req.body?.getReader();
  if (!reader)
    return NextResponse.json({ error: "Image required" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2097152) {
      await reader.cancel();
      return NextResponse.json(
        { error: "Image exceeds 2 MB." },
        { status: 413 },
      );
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);
  const valid =
    type === "image/png"
      ? buffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : type === "image/jpeg"
        ? buffer[0] === 255 && buffer[1] === 216
        : buffer.toString("ascii", 0, 4) === "RIFF" &&
          buffer.toString("ascii", 8, 12) === "WEBP";
  if (!valid)
    return NextResponse.json(
      { error: "The file is not a valid image." },
      { status: 400 },
    );
  const path = `${user.id}/${crypto.randomUUID()}.${extensions[type]}`;
  const uploaded = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType: type });
  if (uploaded.error)
    return NextResponse.json(
      { error: uploaded.error.message },
      { status: 400 },
    );
  return NextResponse.json({ storageId: path });
}
