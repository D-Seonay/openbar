import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync, promises as fsp } from 'fs';
import { basename, join, resolve, sep } from 'path';

/**
 * Accepted upload types, mapped to the extension the file is stored under.
 *
 * The stored extension MUST come from this table and never from the client's
 * `originalname`: `mimetype` is client-controlled too, so a file named
 * `evil.html` sent as `image/png` would otherwise land on disk as `.html` and
 * be served as markup by the static handler — stored XSS on the API origin,
 * which shares cookies with the web app (cookies ignore the port).
 */
export const UPLOAD_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Public prefix these files are served under, via `useStaticAssets`. */
export const UPLOAD_URL_PREFIX = '/uploads/';

// multer's diskStorage does not create the destination for us.
mkdirSync(UPLOADS_DIR, { recursive: true });

const logger = new Logger('Uploads');

/**
 * Resolve a stored `imageUrl` to a path on disk, or null when it isn't ours.
 *
 * `imageUrl` is client-controlled — the DTO only validates it as a string — so
 * it is never treated as a path. Only the basename is kept, which collapses any
 * `../` traversal, and the result is confirmed to sit inside UPLOADS_DIR before
 * the caller is allowed to touch it. Without this, a bottle saved with
 * `imageUrl: "/uploads/../../../etc/passwd"` would turn deleting that bottle
 * into an arbitrary file deletion.
 */
export function resolveUploadPath(imageUrl?: string | null): string | null {
  if (!imageUrl?.startsWith(UPLOAD_URL_PREFIX)) return null;

  const filename = basename(imageUrl.slice(UPLOAD_URL_PREFIX.length));
  if (!filename || filename === '.' || filename === '..') return null;

  const target = resolve(UPLOADS_DIR, filename);
  if (!target.startsWith(resolve(UPLOADS_DIR) + sep)) return null;

  return target;
}

/** Build the on-disk name for a freshly uploaded file of a validated type. */
export function buildUploadFilename(mimetype: string): string | null {
  const ext = UPLOAD_EXTENSION_BY_MIME[mimetype];
  if (!ext) return null;
  return `bottle-${Date.now()}-${randomUUID()}${ext}`;
}

/**
 * Best-effort removal of an uploaded file. Never throws: the database row is
 * the source of truth, and a leftover file must not fail the request that
 * already removed it.
 */
export async function deleteUploadedImage(
  imageUrl?: string | null,
): Promise<void> {
  const target = resolveUploadPath(imageUrl);
  if (!target) return;

  try {
    await fsp.unlink(target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // ENOENT: already gone, or the row referenced a file we never wrote.
    if (code !== 'ENOENT') {
      logger.warn(`Impossible de supprimer ${target} : ${String(error)}`);
    }
  }
}
