import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, ScanLine, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ScanResult = { dataUrl: string; mediaType: string; filename: string };

export function ScanDialog({
  open,
  onOpenChange,
  onScan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: ScanResult) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ScanResult | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(
    async (mode: "environment" | "user") => {
      stopCamera();
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraReady(true);
      } catch {
        setCameraError("Camera access is blocked or unavailable — upload a photo instead.");
      }
    },
    [stopCamera],
  );

  useEffect(() => {
    if (open && !preview) void startCamera(facing);
    if (!open) {
      stopCamera();
      setPreview(null);
    }
    return () => {
      if (!open) stopCamera();
    };
  }, [open, preview, facing, startCamera, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    setPreview({ dataUrl, mediaType: "image/jpeg", filename: "scan.jpg" });
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      stopCamera();
      setPreview({
        dataUrl: reader.result as string,
        mediaType: file.type || "image/jpeg",
        filename: file.name || "scan.jpg",
      });
    };
    reader.onerror = () => toast.error("Couldn't read that image.");
    reader.readAsDataURL(file);
  };

  const confirm = () => {
    if (!preview) return;
    onScan(preview);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4" /> Scan
          </DialogTitle>
          <DialogDescription>
            Point your camera at a page, whiteboard or object — Alaska reads the text and answers
            instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-xl border border-border bg-muted aspect-[4/3]">
          {preview ? (
            <img
              src={preview.dataUrl}
              alt="Scan preview"
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              {!cameraReady ? (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {cameraError ?? "Starting camera…"}
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-primary/70" />
              )}
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) readFile(file);
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Upload
            </Button>
            {!preview && cameraReady ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Switch camera"
                onClick={() =>
                  setFacing((value) => (value === "environment" ? "user" : "environment"))
                }
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          {preview ? (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setPreview(null)}>
                Retake
              </Button>
              <Button type="button" onClick={confirm}>
                <ScanLine className="mr-2 h-4 w-4" /> Scan &amp; answer
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={capture} disabled={!cameraReady}>
              <Camera className="mr-2 h-4 w-4" /> Capture
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
