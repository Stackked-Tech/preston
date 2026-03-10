"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface MapboxFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
  text: string; // street name
  address?: string; // house number
  context?: Array<{ id: string; text: string; short_code?: string }>;
}

export interface AddressResult {
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value: string;
  onSelect: (result: AddressResult) => void;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  inputStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}

export default function AddressAutocomplete({
  value,
  onSelect,
  onChange,
  placeholder = "Start typing an address...",
  label = "Address",
  inputStyle,
  labelStyle,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const defaultInputStyle: React.CSSProperties = {
    background: "var(--input-bg)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    width: "100%",
    outline: "none",
  };

  const defaultLabelStyle: React.CSSProperties = {
    color: "var(--text-secondary)",
    fontSize: "0.75rem",
    fontWeight: 500,
    marginBottom: "0.25rem",
    display: "block",
  };

  const mergedInputStyle = inputStyle ?? defaultInputStyle;
  const mergedLabelStyle = labelStyle ?? defaultLabelStyle;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!token || query.length < 3) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const encoded = encodeURIComponent(query);
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&types=address&autocomplete=true&country=us&limit=5`
        );
        if (!res.ok) throw new Error("Geocoding failed");
        const data = await res.json();
        setSuggestions(data.features || []);
        setShowDropdown((data.features || []).length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const handleInputChange = (input: string) => {
    onChange(input);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(input), 300);
  };

  const parseFeature = (feature: MapboxFeature): AddressResult => {
    const ctx = feature.context || [];
    const getCtx = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix));

    const houseNumber = feature.address || "";
    const street = feature.text || "";
    const fullAddress = houseNumber ? `${houseNumber} ${street}` : street;

    const city = getCtx("place")?.text || "";
    const stateCtx = getCtx("region");
    const state = stateCtx?.short_code?.replace("US-", "") || stateCtx?.text || "";
    const zip = getCtx("postcode")?.text || "";
    const lat = feature.center[1];
    const lng = feature.center[0];

    return { address: fullAddress, city, state, zip, lat, lng };
  };

  const handleSelect = (feature: MapboxFeature) => {
    const parsed = parseFeature(feature);
    onChange(feature.place_name);
    onSelect(parsed);
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <label style={mergedLabelStyle}>{label}</label>}
      <input
        style={mergedInputStyle}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <div
          className="absolute right-3 top-[30px]"
          style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}
        >
          ...
        </div>
      )}
      {showDropdown && suggestions.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-lg border overflow-hidden shadow-lg"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {suggestions.map((feat, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(feat)}
              className="w-full text-left px-3 py-2.5 text-sm transition-colors border-b last:border-b-0"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--border-color)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = "rgba(212,175,55,0.1)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = "transparent";
              }}
            >
              {feat.place_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
