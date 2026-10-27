"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { resizePhoto } from "@/lib/photo";
import { Button } from "@/components/ui/button";

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

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      onChange(await resizePhoto(file));
    } catch {
      toast.error(dict.photo.failed);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" className="h-10 px-4" onClick={() => input.current?.click()}>
          <Camera aria-hidden className="size-4" />
          {hasPhoto ? dict.photo.change : dict.photo.add}
        </Button>
        {hasPhoto && (
          <Button type="button" variant="outline" className="h-10 px-4" onClick={() => onChange(null)}>
            <Trash2 aria-hidden className="size-4" />
            {dict.photo.remove}
          </Button>
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
    </div>
  );
}
