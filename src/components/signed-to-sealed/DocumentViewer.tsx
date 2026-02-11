"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { STSField, STSRecipient, FieldType } from "@/types/signedtosealed";
import { FIELD_TYPE_LABELS } from "@/types/signedtosealed";

// react-pdf is loaded dynamically to avoid SSR issues with pdfjs-dist
let Document: React.ComponentType<any> | null = null;
let Page: React.ComponentType<any> | null = null;
let pdfjsLoaded = false;

function usePdfJs() {
  const [loaded, setLoaded] = useState(pdfjsLoaded);

  useEffect(() => {
    if (pdfjsLoaded) return;
    import("react-pdf").then((mod) => {
      Document = mod.Document;
      Page = mod.Page;
      mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`;
      pdfjsLoaded = true;
      setLoaded(true);
    });
  }, []);

  return loaded;
}

interface DocumentViewerProps {
  fileUrl: string;
  fields: STSField[];
  recipients: STSRecipient[];
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageCountLoad?: (count: number) => void;
  onFieldClick?: (field: STSField) => void;
  onDropField?: (fieldType: FieldType, recipientId: string, page: number, xPct: number, yPct: number) => void;
  onFieldMove?: (fieldId: string, xPct: number, yPct: number) => void;
  onFieldResize?: (fieldId: string, width: number, height: number) => void;
  readOnly?: boolean;
  highlightRecipientId?: string | null;
  zoom?: number;
}

export default function DocumentViewer({
  fileUrl,
  fields,
  recipients,
  currentPage,
  onPageChange,
  onPageCountLoad,
  onFieldClick,
  onDropField,
  onFieldMove,
  onFieldResize,
  readOnly,
  highlightRecipientId,
  zoom = 1,
}: DocumentViewerProps) {
  const pdfReady = usePdfJs();
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingFieldId, setResizingFieldId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    onPageCountLoad?.(n);
  }, [onPageCountLoad]);

  const onPageLoadSuccess = useCallback((page: { width: number; height: number }) => {
    setPageWidth(page.width);
    setPageHeight(page.height);
  }, []);

  const pageFields = fields.filter((f) => f.page_number === currentPage);

  const handlePageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (readOnly) return;
    const fieldType = e.dataTransfer.getData("fieldType") as FieldType;
    const recipientId = e.dataTransfer.getData("recipientId");
    if (!fieldType || !recipientId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onDropField?.(fieldType, recipientId, currentPage, Math.max(0, Math.min(xPct, 100)), Math.max(0, Math.min(yPct, 100)));
  };

  const handleFieldMouseDown = (e: React.MouseEvent, field: STSField) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraggingFieldId(field.id);
    const fieldX = (field.x_position / 100) * rect.width;
    const fieldY = (field.y_position / 100) * rect.height;
    setDragOffset({ x: e.clientX - rect.left - fieldX, y: e.clientY - rect.top - fieldY });
  };

  useEffect(() => {
    if (!draggingFieldId || !containerRef.current) return;
    const handleMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;
      onFieldMove?.(draggingFieldId, Math.max(0, Math.min(xPct, 95)), Math.max(0, Math.min(yPct, 95)));
    };
    const handleUp = () => setDraggingFieldId(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingFieldId, dragOffset, onFieldMove]);

  // Resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent, field: STSField) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    setResizingFieldId(field.id);
    setResizeStart({ mouseX: e.clientX, mouseY: e.clientY, w: field.width, h: field.height });
  };

  useEffect(() => {
    if (!resizingFieldId || !containerRef.current) return;
    const handleMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const dxPct = ((e.clientX - resizeStart.mouseX) / rect.width) * 100;
      const dyPct = ((e.clientY - resizeStart.mouseY) / rect.height) * 100;
      const newW = Math.max(5, Math.min(80, resizeStart.w + dxPct));
      const newH = Math.max(3, Math.min(50, resizeStart.h + dyPct));
      onFieldResize?.(resizingFieldId, newW, newH);
    };
    const handleUp = () => setResizingFieldId(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizingFieldId, resizeStart, onFieldResize]);

  const getRecipient = (id: string) => recipients.find((r) => r.id === id);

  return (
    <div className="flex flex-col">
      {/* Page Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border-color)" }}>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="text-xs px-3 py-1 rounded border transition-all"
          style={{ borderColor: "var(--border-color)", color: "var(--text-muted)", opacity: currentPage <= 1 ? 0.3 : 1 }}
        >
          &larr; Prev
        </button>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Page {currentPage} of {numPages || "..."}
        </span>
        <button
          onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
          disabled={currentPage >= numPages}
          className="text-xs px-3 py-1 rounded border transition-all"
          style={{ borderColor: "var(--border-color)", color: "var(--text-muted)", opacity: currentPage >= numPages ? 0.3 : 1 }}
        >
          Next &rarr;
        </button>
      </div>

      {/* PDF + Field Overlay */}
      <div className="flex-1 overflow-auto flex justify-center p-4" style={{ background: "var(--bg-primary)" }}>
        <div
          ref={containerRef}
          className="relative inline-block"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handlePageDrop}
        >
          {pdfReady && Document && Page ? (
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="w-[612px] h-[792px] flex items-center justify-center" style={{ background: "var(--card-bg)" }}><p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading PDF...</p></div>}
              error={<div className="w-[612px] h-[792px] flex items-center justify-center" style={{ background: "var(--card-bg)" }}><p className="text-sm" style={{ color: "#ef4444" }}>Failed to load PDF</p></div>}
            >
              <Page
                pageNumber={currentPage}
                onLoadSuccess={onPageLoadSuccess}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={612}
              />
            </Document>
          ) : (
            <div className="w-[612px] h-[792px] flex items-center justify-center" style={{ background: "var(--card-bg)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading PDF viewer...</p>
            </div>
          )}

          {/* Field Overlays */}
          {pageFields.map((field) => {
            const r = getRecipient(field.recipient_id);
            const color = r?.color_hex || "#6b7280";
            const isHighlighted = !highlightRecipientId || field.recipient_id === highlightRecipientId;
            const isFilled = !!field.field_value;
            const isSignatureType = field.field_type === "signature" || field.field_type === "initials";
            const isCheckbox = field.field_type === "checkbox";

            return (
              <div
                key={field.id}
                className="absolute rounded flex items-center justify-center transition-all overflow-hidden"
                style={{
                  left: `${field.x_position}%`,
                  top: `${field.y_position}%`,
                  width: `${field.width}%`,
                  height: `${field.height}%`,
                  borderColor: isFilled ? color : color,
                  borderWidth: 2,
                  borderStyle: isFilled ? "solid" : "dashed",
                  background: isFilled ? (isSignatureType ? "#ffffff" : color + "10") : color + "15",
                  opacity: isHighlighted ? 1 : 0.3,
                  cursor: readOnly ? "pointer" : "move",
                  zIndex: draggingFieldId === field.id ? 50 : 10,
                }}
                onMouseDown={(e) => handleFieldMouseDown(e, field)}
                onClick={() => onFieldClick?.(field)}
              >
                {/* Filled signature/initials — show the image */}
                {isFilled && isSignatureType && (
                  <img
                    src={field.field_value!}
                    alt={field.field_type}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                )}

                {/* Filled checkbox */}
                {isFilled && isCheckbox && (
                  <span className="text-xl font-bold pointer-events-none select-none" style={{ color }}>
                    {field.field_value === "true" ? "✓" : ""}
                  </span>
                )}

                {/* Filled text/date/dropdown — show value inside the box */}
                {isFilled && !isSignatureType && !isCheckbox && (
                  <span className="text-sm font-semibold pointer-events-none select-none px-2 truncate w-full text-center" style={{ color: "#1a1a2e" }}>
                    {field.field_value}
                  </span>
                )}

                {/* Unfilled — show field type label */}
                {!isFilled && (
                  <span className="text-[9px] font-medium pointer-events-none select-none" style={{ color }}>
                    {FIELD_TYPE_LABELS[field.field_type]}
                  </span>
                )}

                {/* Resize handle — bottom-right corner (edit mode only) */}
                {!readOnly && (
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3"
                    style={{
                      cursor: "nwse-resize",
                      background: color,
                      borderRadius: "1px 0 3px 0",
                    }}
                    onMouseDown={(e) => handleResizeMouseDown(e, field)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
