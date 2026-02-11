"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { SignatureMethod, SignatureType } from "@/types/signedtosealed";

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string, method: SignatureMethod, fontFamily?: string) => void;
  type: SignatureType;
  signerName: string;
}

const SIGNATURE_FONTS = [
  { name: "Cursive", family: "'Dancing Script', cursive" },
  { name: "Elegant", family: "'Great Vibes', cursive" },
  { name: "Script", family: "'Pacifico', cursive" },
  { name: "Formal", family: "'Alex Brush', cursive" },
];

export default function SignatureModal({ isOpen, onClose, onSave, type, signerName }: SignatureModalProps) {
  const [method, setMethod] = useState<SignatureMethod>("draw");
  const [typedText, setTypedText] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].family);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // Reset canvas when opening
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHasDrawn(false);
      }
    }
    setTypedText(signerName);
    setUploadPreview(null);
  }, [isOpen, signerName]);

  // Drawing handlers
  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a2e";
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    ctx.stroke();
  }, [isDrawing]);

  const endDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Upload handler
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Save handler
  const handleSave = () => {
    if (method === "draw") {
      if (!canvasRef.current || !hasDrawn) return;
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onSave(dataUrl, "draw");
    } else if (method === "type") {
      if (!typedText.trim()) return;
      // Render text to canvas to get data URL
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `48px ${selectedFont}`;
      ctx.fillStyle = "#1a1a2e";
      ctx.textBaseline = "middle";
      ctx.fillText(typedText, 10, 50);
      const dataUrl = canvas.toDataURL("image/png");
      onSave(dataUrl, "type", selectedFont);
    } else if (method === "upload") {
      if (!uploadPreview) return;
      onSave(uploadPreview, "upload");
    }
    onClose();
  };

  const canSave = () => {
    if (method === "draw") return hasDrawn;
    if (method === "type") return typedText.trim().length > 0;
    if (method === "upload") return !!uploadPreview;
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-xl border w-full max-w-lg"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <h3 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            {type === "signature" ? "Create Signature" : "Create Initials"}
          </h3>
          <button onClick={onClose} className="text-lg" style={{ color: "var(--text-muted)" }}>&times;</button>
        </div>

        {/* Method Tabs */}
        <div className="flex border-b" style={{ borderColor: "var(--border-color)" }}>
          {(["draw", "type", "upload"] as SignatureMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className="flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-all"
              style={{
                color: method === m ? "var(--gold)" : "var(--text-muted)",
                borderBottom: method === m ? "2px solid var(--gold)" : "2px solid transparent",
              }}
            >
              {m === "draw" ? "Draw" : m === "type" ? "Type" : "Upload"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Draw */}
          {method === "draw" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Draw your {type} below</p>
                <button onClick={clearCanvas} className="text-xs" style={{ color: "#ef4444" }}>Clear</button>
              </div>
              <canvas
                ref={canvasRef}
                width={460}
                height={150}
                className="w-full rounded-lg border cursor-crosshair"
                style={{ background: "#ffffff", borderColor: "var(--border-color)", height: 150 }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
              />
            </div>
          )}

          {/* Type */}
          {method === "type" && (
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Type your {type}</p>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={type === "signature" ? "Full name" : "Initials"}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none mb-4"
                style={{ background: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Select a font style</p>
              <div className="grid grid-cols-2 gap-2">
                {SIGNATURE_FONTS.map((font) => (
                  <button
                    key={font.family}
                    onClick={() => setSelectedFont(font.family)}
                    className="p-3 rounded-lg border text-left transition-all"
                    style={{
                      background: selectedFont === font.family ? "var(--card-hover)" : "var(--card-bg)",
                      borderColor: selectedFont === font.family ? "var(--gold)" : "var(--border-light)",
                    }}
                  >
                    <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{font.name}</p>
                    <p className="text-xl" style={{ fontFamily: font.family, color: "#1a1a2e" }}>
                      {typedText || signerName || "Preview"}
                    </p>
                  </button>
                ))}
              </div>
              {/* Load Google Fonts */}
              {/* eslint-disable-next-line @next/next/no-page-custom-font */}
              <link
                href="https://fonts.googleapis.com/css2?family=Dancing+Script&family=Great+Vibes&family=Pacifico&family=Alex+Brush&display=swap"
                rel="stylesheet"
              />
            </div>
          )}

          {/* Upload */}
          {method === "upload" && (
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Upload an image of your {type}</p>
              {uploadPreview ? (
                <div className="mb-4">
                  <img src={uploadPreview} alt="Signature preview" className="max-h-32 mx-auto rounded-lg border" style={{ borderColor: "var(--border-color)" }} />
                  <button
                    onClick={() => setUploadPreview(null)}
                    className="block mx-auto mt-2 text-xs"
                    style={{ color: "#ef4444" }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center gap-2 p-8 rounded-lg border-2 border-dashed cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <span className="text-2xl">🖼️</span>
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>Click to upload image</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>PNG, JPG supported</span>
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                </label>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "var(--border-color)" }}>
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md border"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave()}
            className="text-xs px-4 py-1.5 rounded-md font-medium transition-all"
            style={{ background: "var(--gold)", color: "#0a0b0e", opacity: canSave() ? 1 : 0.5 }}
          >
            Adopt & Sign
          </button>
        </div>
      </div>
    </div>
  );
}
