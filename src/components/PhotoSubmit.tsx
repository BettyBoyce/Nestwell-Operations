"use client";

import { useRef, useState, useTransition } from "react";

const MAX_PHOTOS = 6;
const MAX_EDGE = 1600; // px — plenty for review, small enough to upload fast
const QUALITY = 0.8;

type Shot = { id: string; file: File; url: string };

/** Shrink a phone photo to a JPEG under ~500 KB so uploads are fast and fit server limits. */
async function compress(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // unsupported format — send as is; the server checks size
  }
}

export function PhotoSubmit({
  action,
  required,
}: {
  action: (formData: FormData) => Promise<void>;
  required: boolean;
}) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setBusy(true);
    const room = MAX_PHOTOS - shots.length;
    const picked = Array.from(list).filter((f) => f.type.startsWith("image/") || f.type === "").slice(0, room);
    const done = await Promise.all(picked.map(compress));
    setShots((s) => [
      ...s,
      ...done.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })),
    ]);
    if (list.length > room) setError(`Up to ${MAX_PHOTOS} photos per job.`);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  function remove(id: string) {
    setShots((s) => {
      const gone = s.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return s.filter((x) => x.id !== id);
    });
  }

  function submit() {
    if (required && shots.length === 0) {
      setError("Take at least one photo of the finished work first.");
      return;
    }
    const fd = new FormData();
    shots.forEach((s) => fd.append("proof", s.file));
    startTransition(() => action(fd));
  }

  const working = busy || pending;

  return (
    <div className="space-y-3 border-t border-stone-100 pt-3">
      <div className="flex items-center justify-between">
        <p className="label mb-0">
          {required ? "📸 Photos of finished work (required)" : "📸 Photos (optional)"}
        </p>
        <span className="text-xs text-stone-500">{shots.length}/{MAX_PHOTOS}</span>
      </div>

      {shots.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {shots.map((s) => (
            <li key={s.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt="Work photo" className="aspect-square w-full rounded-xl border object-cover" />
              <button
                type="button"
                onClick={() => remove(s.id)}
                className="absolute right-1 top-1 h-7 w-7 rounded-full bg-black/60 text-sm font-bold text-white"
                aria-label="Remove photo"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {shots.length < MAX_PHOTOS && (
        <label className={`btn-ghost w-full cursor-pointer ${working ? "pointer-events-none opacity-50" : ""}`}>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => add(e.target.files)}
          />
          {busy ? "Preparing photo…" : shots.length ? "+ Add another photo" : "Take or choose photo"}
        </label>
      )}

      {error && <p className="rounded-xl bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={working || (required && shots.length === 0)}
        className="btn w-full"
      >
        {pending ? "Sending…" : "Mark done & send for review"}
      </button>
      {required && shots.length === 0 && (
        <p className="text-center text-xs text-stone-500">Add a photo to unlock “Mark done”.</p>
      )}
    </div>
  );
}
