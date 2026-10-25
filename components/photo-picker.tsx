"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { resizePhoto } from "@/lib/photo";

/** Take or pick a photo (the device offers the camera or the library), or remove it. */
export function PhotoPicker({
  hasPhoto,
  onChange,
}: {
  hasPhoto: boolean;
  onChange: (data: string | null) => void;
}) {
  const { dict } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      onChange(await resizePhoto(file));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-ghost h-10 px-4" onClick={() => input.current?.click()}>
          <Camera aria-hidden className="size-4" />
          {hasPhoto ? dict.photo.change : dict.photo.add}
        </button>
        {hasPhoto && (
          <button type="button" className="btn btn-ghost h-10 px-4" onClick={() => onChange(null)}>
            <Trash2 aria-hidden className="size-4" />
            {dict.photo.remove}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {failed && (
        <p role="alert" className="text-sm text-accent">
          {dict.photo.failed}
        </p>
      )}
    </div>
  );
}
