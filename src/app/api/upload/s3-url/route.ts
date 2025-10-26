export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Head the object
    const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    const size = Number(head.ContentLength || 0);
    const ok = size > 0 && size <= UPLOAD_MAX_MB * 1024 * 1024;

    // If present and sane size, increment the session counter ONCE
    if (ok) {
      // Parse sessionId from key: uploads/<sessionId>/...
      const m = key.match(/^uploads\/([^/]+)\//);
      const sessionId = m?.[1];

      if (sessionId) {
        const countedKey = `uploads:counted:${key}`;        // marks this key as already counted
        const countKey   = `uploads:count:${sessionId}`;

        // SETNX-like behavior using Upstash REST client:
        // Try to set a marker; if it returns null/false you already counted this key.
        let already = false;
        try {
          // If you use @upstash/redis v1/v2 you can emulate SETNX with set({ nx: true })
          // @ts-ignore: optional in-memory fallback object
          const res = await (redis as any).set
            ? await (redis as any).set(countedKey, "1", { nx: true, ex: 60 * 60 * 24 * 30 })
            : null;
          // Upstash returns "OK" on success; if not OK, assume already counted
          already = res !== "OK";
        } catch {
          // minimal fallback: check/get
          // @ts-ignore
          const had = await (redis as any).get(countedKey);
          already = !!had;
          if (!already) {
            // @ts-ignore
            await (redis as any).incr(countedKey);
            // @ts-ignore
            await (redis as any).expire(countedKey, 60 * 60 * 24 * 30);
          }
        }

        if (!already) {
          // Only now increase the per-session count
          // @ts-ignore
          await (redis as any).incr(countKey);
          // @ts-ignore
          await (redis as any).expire(countKey, 60 * 60 * 24 * 30);
        }
      }
    }

    return NextResponse.json({
      ok,
      size,
      contentType: head.ContentType || null,
      etag: head.ETag || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Verify failed" },
      { status: 400 }
    );
  }
}
