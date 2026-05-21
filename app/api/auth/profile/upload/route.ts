// app/api/auth/profile/upload/route.ts
// POST: Safely upload and reprocess user profile pictures.
// Incorporates server-side size caps, binary header signature validations, and binary metadata stripping.

import { NextResponse } from 'next/server';
import { createSupabaseServer, supabaseAdmin } from '@/lib/supabase';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // Strict 2MB ceiling

// File type magic number header signatures
const SIGNATURES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  gif: [0x47, 0x49, 0x46, 0x38] // "GIF8"
};

/**
 * Strips metadata and comment blocks from JPEG buffers to prevent polyglot XSS/exif execution attacks.
 * Discards optional APP1-APP15 segments, keeping only SOF, DHT, DQT, SOS, and image data.
 */
function stripJpegMetadata(buffer: Buffer): Buffer {
  const result: number[] = [];
  let i = 0;

  // Verify SOI (Start of Image) header
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    result.push(0xFF, 0xD8);
    i = 2;
  } else {
    return buffer; // Fallback to original if invalid JPEG
  }

  while (i < buffer.length) {
    if (buffer[i] === 0xFF) {
      const marker = buffer[i + 1];
      if (marker === 0xD9) {
        // EOI (End of Image)
        result.push(0xFF, 0xD9);
        break;
      }

      // Check if it is an APP marker (0xE0 - 0xEF) or COM marker (0xFE) to discard EXIF and scripts
      if ((marker >= 0xE1 && marker <= 0xEF) || marker === 0xFE) {
        const length = (buffer[i + 2] << 8) + buffer[i + 3];
        i += 2 + length; // Skip this metadata segment entirely
        continue;
      }
    }
    result.push(buffer[i]);
    i++;
  }

  return Buffer.from(result);
}

/**
 * Filters PNG chunks, stripping tEXt, zTXt, iTXt, or pHYs ancillary chunks which might harbor executable scripts.
 * Retains only critical chunks: IHDR, PLTE, IDAT, and IEND.
 */
function stripPngMetadata(buffer: Buffer): Buffer {
  const result = Buffer.alloc(buffer.length);
  buffer.copy(result, 0, 0, 8); // Copy signature
  
  let writeOffset = 8;
  let readOffset = 8;

  while (readOffset < buffer.length) {
    if (readOffset + 12 > buffer.length) break;

    const length = buffer.readUInt32BE(readOffset);
    const type = buffer.toString('ascii', readOffset + 4, readOffset + 8);

    // Keep only vital rendering chunks
    if (type === 'IHDR' || type === 'PLTE' || type === 'IDAT' || type === 'IEND') {
      buffer.copy(result, writeOffset, readOffset, readOffset + 12 + length);
      writeOffset += 12 + length;
    }
    readOffset += 12 + length;
  }

  return result.subarray(0, writeOffset);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized user context' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
    }

    // 1. File Size Verification (Max 2MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds strict 2MB security ceiling.' }, { status: 400 });
    }

    // Convert file to buffer for magic byte validation
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(new Uint8Array(arrayBuffer));

    // 2. Binary Magic Number Signature Verification
    let verifiedType: 'jpeg' | 'png' | 'gif' | null = null;

    const isJpeg = SIGNATURES.jpeg.every((byte, idx) => originalBuffer[idx] === byte);
    const isPng = SIGNATURES.png.every((byte, idx) => originalBuffer[idx] === byte);
    const isGif = SIGNATURES.gif.every((byte, idx) => originalBuffer[idx] === byte);

    if (isJpeg) verifiedType = 'jpeg';
    else if (isPng) verifiedType = 'png';
    else if (isGif) verifiedType = 'gif';

    if (!verifiedType) {
      return NextResponse.json({
        error: 'Security Refusal: Upload is not a verified JPEG, PNG, or GIF binary stream.'
      }, { status: 400 });
    }

    // 3. Resize / Metadata Reprocessing (Sanitizing the raw upload)
    let sanitizedBuffer = originalBuffer;
    let mimeType = '';

    if (verifiedType === 'jpeg') {
      sanitizedBuffer = Buffer.from(stripJpegMetadata(originalBuffer));
      mimeType = 'image/jpeg';
    } else if (verifiedType === 'png') {
      sanitizedBuffer = Buffer.from(stripPngMetadata(originalBuffer));
      mimeType = 'image/png';
    } else if (verifiedType === 'gif') {
      mimeType = 'image/gif';
    }

    // 4. Store in Supabase Storage with Safe Content Headers
    const db = supabaseAdmin || supabase;
    const filename = `avatar_${user.id}_${Date.now()}.${verifiedType === 'jpeg' ? 'jpg' : verifiedType}`;

    // Upload reprocessed image to 'avatars' bucket
    const { data: uploadData, error: uploadErr } = await db.storage
      .from('avatars')
      .upload(filename, sanitizedBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadErr) {
      console.error('[Upload API] Supabase storage upload failed:', uploadErr);
      const hint =
        uploadErr.message?.toLowerCase().includes('bucket') ||
        uploadErr.message?.toLowerCase().includes('not found')
          ? ' Create the bucket by running db/storage_avatars_bucket.sql in the Supabase SQL Editor (or Storage → New bucket → id "avatars", public).'
          : '';
      return NextResponse.json(
        {
          error: `Failed to save avatar: ${uploadErr.message}.${hint}`,
        },
        { status: 500 }
      );
    }

    // Retrieve public URL
    const { data: { publicUrl } } = db.storage.from('avatars').getPublicUrl(filename);

    // 5. Save public photo link to user profile table and auth metadata
    await db.from('profiles').upsert({
      id: user.id,
      profile_photo: publicUrl,
      display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
    });

    await supabase.auth.updateUser({
      data: { profile_photo: publicUrl }
    });

    return NextResponse.json({
      success: true,
      profilePhotoUrl: publicUrl
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Image upload processing failed' }, { status: 500 });
  }
}
