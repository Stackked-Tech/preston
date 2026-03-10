"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { HMTaskWithDetails } from "@/types/hospitality";

interface TaskMapProps {
  tasks: HMTaskWithDetails[];
  onSelectTask?: (taskId: string) => void;
  routeGeometry?: GeoJSON.LineString | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#3b82f6",
  low: "#9ca3af",
};

export default function TaskMap({ tasks, onSelectTask, routeGeometry }: TaskMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Filter tasks that have geocoded properties
  const geocodedTasks = tasks.filter(
    (t) => t.property?.lat != null && t.property?.lng != null
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-98.5795, 39.8283], // Center of US
      zoom: 3.5,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Add/update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (geocodedTasks.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    geocodedTasks.forEach((task) => {
      const { lat, lng } = task.property!;
      const lngLat: [number, number] = [lng!, lat!];
      bounds.extend(lngLat);

      // Create marker element
      const el = document.createElement("div");
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.borderRadius = "50%";
      el.style.border = "3px solid #fff";
      el.style.backgroundColor = PRIORITY_COLORS[task.priority] || "#9ca3af";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";

      // Popup HTML
      const dueStr = task.due_date
        ? new Date(task.due_date).toLocaleDateString()
        : "No due date";

      const popupHTML = `
        <div style="font-family:sans-serif;max-width:220px;">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${task.title || "Untitled"}</div>
          <div style="font-size:11px;color:#888;margin-bottom:6px;">${task.property?.name || ""}</div>
          <div style="display:flex;gap:8px;font-size:11px;margin-bottom:8px;">
            <span style="color:${PRIORITY_COLORS[task.priority]};text-transform:capitalize;font-weight:500;">${task.priority}</span>
            <span style="color:#aaa;">${task.status.replace("_", " ")}</span>
            <span style="color:#aaa;">${dueStr}</span>
          </div>
          ${onSelectTask ? `<button id="view-task-${task.id}" style="background:#d4af37;color:#000;border:none;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">View Task</button>` : ""}
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 16, closeButton: true }).setHTML(popupHTML);

      popup.on("open", () => {
        if (onSelectTask) {
          const btn = document.getElementById(`view-task-${task.id}`);
          if (btn) {
            btn.addEventListener("click", () => {
              onSelectTask(task.id);
            });
          }
        }
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(lngLat)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit bounds
    if (geocodedTasks.length === 1) {
      const t = geocodedTasks[0];
      map.flyTo({ center: [t.property!.lng!, t.property!.lat!], zoom: 14 });
    } else {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }, [geocodedTasks, mapReady, onSelectTask]);

  // Draw route geometry
  const drawRoute = useCallback(
    (geometry: GeoJSON.LineString | null) => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      // Remove existing route layer/source
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getSource("route-source")) map.removeSource("route-source");

      if (!geometry) return;

      map.addSource("route-source", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route-source",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#d4af37",
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });
    },
    [mapReady]
  );

  useEffect(() => {
    drawRoute(routeGeometry ?? null);
  }, [routeGeometry, drawRoute]);

  if (geocodedTasks.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="text-center px-6">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mx-auto mb-3 opacity-40"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <p className="text-sm">No geocoded properties to display</p>
          <p className="text-xs mt-1 opacity-60">
            Add addresses to properties so they appear on the map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <div ref={mapContainerRef} className="absolute inset-0" />
      {/* Legend */}
      <div
        className="absolute top-3 left-3 rounded-lg px-3 py-2 text-xs"
        style={{
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {(["critical", "high", "medium", "low"] as const).map((p) => (
          <div key={p} className="flex items-center gap-2 mb-1 last:mb-0">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: PRIORITY_COLORS[p] }}
            />
            <span className="capitalize" style={{ color: "#ccc" }}>
              {p}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
