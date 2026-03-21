import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, err } from "@/lib/validations";
import { rateLimitUpload } from "@/lib/rate-limit";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;

  // Rate limit uploads per user
  const rl = await rateLimitUpload(user.id);
  if (!rl.success) return err("Too many upload requests. Please wait.", 429);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) ?? "general";

  if (!file) return err("No file provided", 400);
  if (!ALLOWED_TYPES.includes(file.type)) {
    return err("Only JPEG, PNG, WebP, and GIF images are allowed.", 400);
  }
  if (file.size > MAX_SIZE_BYTES) {
    return err("File size must be under 5MB.", 400);
  }

  // Convert to buffer for Cloudinary upload
  const bytes  = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Allowed folders — prevent arbitrary path injection
  const allowedFolders = ["events", "payments", "expenses", "avatars"];
  const safeFolder = allowedFolders.includes(folder) ? folder : "general";

  return new Promise<NextResponse>((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:         `nexcell/${safeFolder}`,
        resource_type:  "image",
        allowed_formats: ["jpg", "png", "webp", "gif"],
        transformation: [{ quality: "auto", fetch_format: "auto" }],
        // Tag with user ID for audit trail
        tags: [`user:${user.id}`, `folder:${safeFolder}`],
      },
      (error, result) => {
        if (error || !result) {
          resolve(err("Upload failed. Please try again.", 500));
          return;
        }
        resolve(ok({
          url:       result.secure_url,
          publicId:  result.public_id,
          width:     result.width,
          height:    result.height,
          format:    result.format,
          sizeBytes: result.bytes,
        }));
      }
    );
    uploadStream.end(buffer);
  });
}
