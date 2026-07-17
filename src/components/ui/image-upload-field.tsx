import { publicErrorMessage } from "@/lib/public-error";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/storage";

export function ImageUploadField({
  id,
  label,
  currentUrl,
  onChange,
  description = "JPG, PNG ou WEBP. O app otimiza e remove metadados. Até 8 MB.",
  round = false,
}: {
  id: string;
  label: string;
  currentUrl?: string | null;
  onChange: (file: File | null | undefined) => void;
  description?: string;
  round?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setPreviewUrl(currentUrl ?? null);
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [currentUrl]);

  function selectFile(file?: File) {
    if (!file) return;
    try {
      validateImageFile(file);
    } catch (error) {
      toast.error(publicErrorMessage(error, "Imagem inválida."));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setPreviewUrl(objectUrlRef.current);
    onChange(file);
  }

  function remove() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
    onChange(currentUrl ? null : undefined);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div
        className={`flex gap-4 ${round ? "items-center" : "flex-col sm:flex-row sm:items-center"}`}
      >
        <div
          className={`relative grid shrink-0 place-items-center overflow-hidden border border-dashed border-input bg-muted ${
            round ? "h-24 w-24 rounded-full" : "aspect-[16/9] w-full max-w-64 rounded-2xl"
          }`}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Prévia da imagem" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              <Upload className="h-4 w-4" /> {previewUrl ? "Trocar imagem" : "Escolher imagem"}
            </button>
            {previewUrl && (
              <button
                type="button"
                onClick={remove}
                className="inline-flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="h-4 w-4" /> Remover
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
