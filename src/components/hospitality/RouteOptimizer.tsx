"use client";

import { useState } from "react";
import type { HMTaskWithDetails } from "@/types/hospitality";

interface RouteOptimizerProps {
  tasks: HMTaskWithDetails[];
  onOptimizedRoute: (orderedTaskIds: string[]) => void;
  onRouteGeometry: (geometry: GeoJSON.LineString | null) => void;
}

interface RouteResult {
  orderedTasks: HMTaskWithDetails[];
  totalDuration: number; // seconds
  totalDistance: number; // meters
}

export default function RouteOptimizer({
  tasks,
  onOptimizedRoute,
  onRouteGeometry,
}: RouteOptimizerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const geocodedTasks = tasks.filter(
    (t) => t.property?.lat != null && t.property?.lng != null
  );

  const handleOptimize = async () => {
    if (geocodedTasks.length < 2) return;

    setLoading(true);
    setError(null);

    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) {
        setError("Mapbox token not configured");
        return;
      }

      // Build coordinates string: lng,lat;lng,lat;...
      const coordinates = geocodedTasks
        .map((t) => `${t.property!.lng},${t.property!.lat}`)
        .join(";");

      const response = await fetch(
        `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}?access_token=${token}&roundtrip=true&source=first&geometries=geojson&overview=full`
      );

      if (!response.ok) {
        setError("Route optimization failed");
        return;
      }

      const data = await response.json();

      if (data.code !== "Ok" || !data.trips?.length) {
        setError("Could not find a route between locations");
        return;
      }

      const trip = data.trips[0];
      const waypoints = data.waypoints;

      // waypoints have waypoint_index that tells the optimized order
      const orderedTasks = waypoints
        .sort(
          (a: { waypoint_index: number }, b: { waypoint_index: number }) =>
            a.waypoint_index - b.waypoint_index
        )
        .map(
          (wp: { waypoint_index: number; trips_index: number }, idx: number) => {
            // The original index in our geocodedTasks array
            // waypoints array corresponds 1:1 with the coordinates we sent
            const originalIdx = waypoints.findIndex(
              (w: { waypoint_index: number }) => w.waypoint_index === idx
            );
            // Find which original geocodedTask corresponds to this waypoint
            return geocodedTasks[originalIdx >= 0 ? originalIdx : idx];
          }
        )
        .filter(Boolean);

      // Build ordered list by waypoint_index
      const orderedByIndex: HMTaskWithDetails[] = new Array(geocodedTasks.length);
      waypoints.forEach(
        (wp: { waypoint_index: number }, originalIdx: number) => {
          orderedByIndex[wp.waypoint_index] = geocodedTasks[originalIdx];
        }
      );
      const finalOrdered = orderedByIndex.filter(Boolean);

      const routeResult: RouteResult = {
        orderedTasks: finalOrdered,
        totalDuration: trip.duration,
        totalDistance: trip.distance,
      };

      setResult(routeResult);
      onOptimizedRoute(finalOrdered.map((t) => t.id));
      onRouteGeometry(trip.geometry as GeoJSON.LineString);
    } catch (err) {
      console.error("Route optimization error:", err);
      setError("Failed to optimize route");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResult(null);
    setError(null);
    onRouteGeometry(null);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDistance = (meters: number): string => {
    const miles = meters / 1609.344;
    return `${miles.toFixed(1)} mi`;
  };

  if (geocodedTasks.length < 2) {
    return (
      <div
        className="px-4 py-3 text-xs text-center"
        style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}
      >
        Need at least 2 locations to optimize
      </div>
    );
  }

  return (
    <div
      className="border-t"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border-light)",
      }}
    >
      {/* Header / toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        <span className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Route Optimizer ({geocodedTasks.length} locations)
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: collapsed ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.2s",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3">
          {/* Optimize button */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleOptimize}
              disabled={loading}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-opacity"
              style={{
                background: "var(--gold)",
                color: "#000",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Optimizing..." : "Optimize Route"}
            </button>
            {result && (
              <button
                onClick={handleClear}
                className="px-3 py-2 rounded-lg text-xs border"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-secondary)",
                }}
              >
                Clear
              </button>
            )}
          </div>

          {error && (
            <p className="text-xs mb-2" style={{ color: "#ef4444" }}>
              {error}
            </p>
          )}

          {result && (
            <div>
              {/* Summary */}
              <div
                className="flex gap-4 mb-3 px-3 py-2 rounded-lg"
                style={{ background: "var(--bg-tertiary)" }}
              >
                <div className="text-center">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--gold)" }}
                  >
                    {formatDuration(result.totalDuration)}
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Drive time
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--gold)" }}
                  >
                    {formatDistance(result.totalDistance)}
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Total distance
                  </div>
                </div>
              </div>

              {/* Ordered stop list */}
              <div className="space-y-1">
                {result.orderedTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                    style={{ background: "var(--bg-tertiary)" }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                      style={{ background: "var(--gold)", color: "#000" }}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {task.title || "Untitled"}
                      </div>
                      <div
                        className="truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {task.property?.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
