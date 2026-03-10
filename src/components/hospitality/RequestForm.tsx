"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  usePropertyByQrCode,
  useRequesterTypes,
  useCategories,
  useSubmitRequest,
  normalizePhone,
} from "@/lib/hospitalityHooks";
import type { HMUrgency, HMRequestInsert } from "@/types/hospitality";

interface RequestFormProps {
  propertyId: string;
}

const URGENCY_OPTIONS: { value: HMUrgency; label: string; color: string; bgColor: string }[] = [
  { value: "routine", label: "Routine", color: "#6b7280", bgColor: "rgba(107,114,128,0.15)" },
  { value: "urgent", label: "Urgent", color: "#f97316", bgColor: "rgba(249,115,22,0.15)" },
  { value: "emergency", label: "Emergency", color: "#ef4444", bgColor: "rgba(239,68,68,0.15)" },
];

const MAX_PHOTOS = 5;

export default function RequestForm({ propertyId }: RequestFormProps) {
  const { property, loading: propertyLoading, error: propertyError } = usePropertyByQrCode(propertyId);
  const { requesterTypes, loading: rtLoading } = useRequesterTypes();
  const { categories, loading: catLoading } = useCategories();
  const { submitRequest, submitting } = useSubmitRequest();

  // Form state
  const [requesterTypeId, setRequesterTypeId] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<HMUrgency>("routine");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // UI state
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount or when photos change
  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  const handlePhotoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const remainingSlots = MAX_PHOTOS - photos.length;
      const newFiles = files.slice(0, remainingSlots);

      if (newFiles.length > 0) {
        const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
        setPhotos((prev) => [...prev, ...newFiles]);
        setPhotoPreviews((prev) => [...prev, ...newPreviews]);
      }

      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [photos.length]
  );

  const removePhoto = useCallback(
    (index: number) => {
      URL.revokeObjectURL(photoPreviews[index]);
      setPhotos((prev) => prev.filter((_, i) => i !== index));
      setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    },
    [photoPreviews]
  );

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!requesterTypeId) errors.requesterTypeId = "Please select who you are";
    if (!contactPhone.trim()) {
      errors.contactPhone = "Phone number is required";
    } else if (contactPhone.replace(/\D/g, "").length < 10) {
      errors.contactPhone = "Please enter a valid phone number";
    }
    if (!categoryId) errors.categoryId = "Please select an issue type";
    if (!description.trim()) errors.description = "Please describe the issue";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) return;
    if (!property) return;

    try {
      const request: HMRequestInsert = {
        property_id: property.id,
        requester_type_id: requesterTypeId,
        contact_phone: normalizePhone(contactPhone),
        category_id: categoryId,
        description: description.trim(),
        urgency,
      };

      await submitRequest(request, photos);

      // Notify managers via SMS (fire-and-forget)
      const selectedCategory = categories.find((c) => c.id === categoryId);
      const urgencyLabel = urgency.charAt(0).toUpperCase() + urgency.slice(1);
      const smsMessage = `New ${urgencyLabel} maintenance request at ${property.name}: ${selectedCategory?.label || "General"} — ${description.trim().slice(0, 100)}`;

      fetch("/api/hospitality/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: normalizePhone(contactPhone),
          message: smsMessage,
        }),
      }).catch(() => {
        // SMS notification is best-effort, don't block success
      });

      setSubmitted(true);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to submit request. Please try again."
      );
    }
  };

  // Loading state
  if (propertyLoading || rtLoading || catLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-sans"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{
              borderColor: "var(--border-light)",
              borderTopColor: "var(--gold)",
            }}
          />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Property not found
  if (propertyError || !property) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-sans p-4"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          className="text-center p-8 rounded-xl border max-w-sm w-full"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
          }}
        >
          <div className="text-4xl mb-4">🏠</div>
          <p
            className="text-lg font-medium mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Property not found
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Please scan the QR code again.
          </p>
        </div>
      </div>
    );
  }

  // Success screen
  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-sans p-4"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          className="text-center p-8 rounded-xl border max-w-sm w-full"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(34,197,94,0.15)" }}
          >
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#22c55e"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p
            className="text-xl font-semibold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Request Submitted!
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Your maintenance request has been submitted. You&apos;ll receive
            updates via text message.
          </p>
        </div>
      </div>
    );
  }

  // Form
  return (
    <div
      className="min-h-screen font-sans"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-lg mx-auto p-4 py-8">
        {/* Property header */}
        <div className="text-center mb-6">
          <p
            className="text-xs uppercase tracking-wider mb-1"
            style={{ color: "var(--gold)" }}
          >
            Maintenance Request
          </p>
          <h1
            className="text-2xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {property.name}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* General form error */}
          {formError && (
            <p
              className="text-sm px-4 py-3 rounded-lg"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#ef4444",
              }}
            >
              {formError}
            </p>
          )}

          {/* Requester type */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Who are you? *
            </label>
            <select
              value={requesterTypeId}
              onChange={(e) => {
                setRequesterTypeId(e.target.value);
                setFieldErrors((prev) => ({ ...prev, requesterTypeId: "" }));
              }}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none min-h-[44px] appearance-none"
              style={{
                background: "var(--input-bg)",
                borderColor: fieldErrors.requesterTypeId
                  ? "#ef4444"
                  : "var(--border-light)",
                color: requesterTypeId
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
              }}
            >
              <option value="">Select...</option>
              {requesterTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </select>
            {fieldErrors.requesterTypeId && (
              <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                {fieldErrors.requesterTypeId}
              </p>
            )}
          </div>

          {/* Contact phone */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Contact Phone (for updates) *
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => {
                setContactPhone(e.target.value);
                setFieldErrors((prev) => ({ ...prev, contactPhone: "" }));
              }}
              placeholder="(555) 123-4567"
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none min-h-[44px]"
              style={{
                background: "var(--input-bg)",
                borderColor: fieldErrors.contactPhone
                  ? "#ef4444"
                  : "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
            {fieldErrors.contactPhone && (
              <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                {fieldErrors.contactPhone}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--text-secondary)" }}
            >
              What type of issue? *
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setFieldErrors((prev) => ({ ...prev, categoryId: "" }));
              }}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none min-h-[44px] appearance-none"
              style={{
                background: "var(--input-bg)",
                borderColor: fieldErrors.categoryId
                  ? "#ef4444"
                  : "var(--border-light)",
                color: categoryId
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
              }}
            >
              <option value="">Select...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && (
              <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                {fieldErrors.categoryId}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Describe the issue *
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFieldErrors((prev) => ({ ...prev, description: "" }));
              }}
              placeholder="Please describe the maintenance issue in detail..."
              rows={4}
              className="w-full rounded-lg border px-3 py-3 text-sm outline-none resize-none min-h-[44px]"
              style={{
                background: "var(--input-bg)",
                borderColor: fieldErrors.description
                  ? "#ef4444"
                  : "var(--border-light)",
                color: "var(--text-primary)",
              }}
            />
            {fieldErrors.description && (
              <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                {fieldErrors.description}
              </p>
            )}
          </div>

          {/* Photos */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Photos (optional, max {MAX_PHOTOS})
            </label>

            {/* Photo previews */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {photoPreviews.map((url, idx) => (
                  <div key={url} className="relative aspect-square">
                    <img
                      src={url}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs leading-none"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_PHOTOS && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg border border-dashed px-3 py-3 text-sm min-h-[44px] flex items-center justify-center gap-2"
                  style={{
                    borderColor: "var(--border-light)",
                    color: "var(--text-muted)",
                  }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                    />
                  </svg>
                  Add Photo
                </button>
              </>
            )}
          </div>

          {/* Urgency */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Urgency *
            </label>
            <div className="flex gap-2">
              {URGENCY_OPTIONS.map((opt) => {
                const isSelected = urgency === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUrgency(opt.value)}
                    className="flex-1 rounded-lg border px-3 py-3 text-sm font-medium min-h-[44px] transition-all"
                    style={{
                      borderColor: isSelected ? opt.color : "var(--border-light)",
                      background: isSelected ? opt.bgColor : "transparent",
                      color: isSelected ? opt.color : "var(--text-muted)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold min-h-[44px] transition-opacity flex items-center justify-center gap-2"
            style={{
              background: "var(--gold)",
              color: "#0a0b0e",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <>
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: "rgba(10,11,14,0.3)",
                    borderTopColor: "#0a0b0e",
                  }}
                />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
