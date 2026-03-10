"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { HMTaskWithDetails } from "@/types/hospitality";

interface TaskMapProps {
  tasks: HMTaskWithDetails[];
  onSelectTask?: (taskId: string) => void;
  routeGeometry?: GeoJSON.LineString | null;
  routeStopOrder?: string[]; // ordered property IDs from route optimizer
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#3b82f6",
  low: "#9ca3af",
};

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

const MAP_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;

// CSS for popups only (markers are now layer-based)
const POPUP_STYLES = `
  .taskmap-popup .mapboxgl-popup-content {
    background: #1a1b2e;
    border: 1px solid rgba(212, 175, 55, 0.35);
    border-radius: 10px;
    padding: 14px 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    animation: taskmap-popup-in 0.25s ease-out;
    max-width: 280px;
  }
  .taskmap-popup .mapboxgl-popup-tip {
    border-top-color: #1a1b2e;
  }
  .taskmap-popup .mapboxgl-popup-close-button {
    color: #9ca3af;
    font-size: 18px;
    right: 6px;
    top: 4px;
  }
  .taskmap-popup .mapboxgl-popup-close-button:hover {
    color: #d4af37;
    background: transparent;
  }
  @keyframes taskmap-popup-in {
    from { opacity: 0; transform: translateY(4px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

// ---- Helpers ----

interface PropertyGroup {
  propertyId: string;
  propertyName: string;
  lat: number;
  lng: number;
  tasks: HMTaskWithDetails[];
  highestPriority: string;
}

function groupTasksByProperty(tasks: HMTaskWithDetails[]): PropertyGroup[] {
  const map = new Map<string, PropertyGroup>();
  for (const task of tasks) {
    if (!task.property?.lat || !task.property?.lng) continue;
    const pid = task.property.id;
    let group = map.get(pid);
    if (!group) {
      group = {
        propertyId: pid,
        propertyName: task.property.name,
        lat: task.property.lat,
        lng: task.property.lng,
        tasks: [],
        highestPriority: "low",
      };
      map.set(pid, group);
    }
    group.tasks.push(task);
    const order = PRIORITY_ORDER.indexOf(task.priority as (typeof PRIORITY_ORDER)[number]);
    const currentOrder = PRIORITY_ORDER.indexOf(group.highestPriority as (typeof PRIORITY_ORDER)[number]);
    if (order >= 0 && (currentOrder < 0 || order < currentOrder)) {
      group.highestPriority = task.priority;
    }
  }
  return Array.from(map.values());
}

function buildPopupHTML(group: PropertyGroup, hasOnSelect: boolean): string {
  const taskItems = group.tasks
    .map((task) => {
      const dueStr = task.due_date
        ? new Date(task.due_date).toLocaleDateString()
        : "No due date";
      const statusLabel = task.status.replace(/_/g, " ");
      const assignee = task.assigned_user?.name || "Unassigned";
      return `
        <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-weight:600;font-size:13px;color:#e8e6e1;margin-bottom:4px;">${task.title || "Untitled"}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:${PRIORITY_COLORS[task.priority]}22;color:${PRIORITY_COLORS[task.priority]};text-transform:uppercase;letter-spacing:0.5px;">${task.priority}</span>
            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:500;background:rgba(255,255,255,0.06);color:#9ca3af;text-transform:capitalize;">${statusLabel}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;margin-bottom:${hasOnSelect ? "6" : "0"}px;">
            <span>${assignee}</span>
            <span>${dueStr}</span>
          </div>
          ${hasOnSelect ? `<button data-task-id="${task.id}" class="taskmap-view-btn" style="background:#d4af37;color:#000;border:none;padding:5px 14px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;width:100%;margin-top:2px;transition:background 0.15s;letter-spacing:0.3px;">View Task</button>` : ""}
        </div>`;
    })
    .join("");

  return `
    <div style="font-family:'DM Sans',system-ui,sans-serif;min-width:220px;">
      <div style="font-size:14px;font-weight:700;color:#d4af37;margin-bottom:2px;letter-spacing:0.3px;">${group.propertyName}</div>
      <div style="font-size:11px;color:#9ca3af;margin-bottom:8px;">${group.tasks.length} task${group.tasks.length > 1 ? "s" : ""}</div>
      <div style="max-height:260px;overflow-y:auto;">${taskItems}</div>
    </div>
  `;
}

// Helper to add all task-related layers to the map
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addTaskLayers(map: any) {
  // Cluster source
  if (!map.getSource("task-clusters")) {
    map.addSource("task-clusters", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 50,
    });
  }

  // Cluster circle layer
  if (!map.getLayer("cluster-circles")) {
    map.addLayer({
      id: "cluster-circles",
      type: "circle",
      source: "task-clusters",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#d4af37",
        "circle-radius": [
          "step", ["get", "point_count"],
          18, 5, 24, 15, 30, 30, 36,
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(212, 175, 55, 0.4)",
      },
    });
  }

  // Cluster count label
  if (!map.getLayer("cluster-count")) {
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "task-clusters",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 13,
      },
      paint: { "text-color": "#000" },
    });
  }

  // Unclustered point — outer ring (stroke only, for priority/route color)
  if (!map.getLayer("unclustered-point")) {
    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "task-clusters",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 14,
        "circle-color": "rgba(10, 11, 14, 0.85)",
        "circle-stroke-width": 3,
        "circle-stroke-color": [
          "case",
          [">", ["get", "stopNumber"], 0],
          "#d4af37",
          [
            "match", ["get", "highestPriority"],
            "critical", "#ef4444",
            "high", "#f97316",
            "medium", "#3b82f6",
            "low", "#9ca3af",
            "#9ca3af",
          ],
        ],
      },
    });
  }

  // Inner dot (priority color, only when no route stop)
  if (!map.getLayer("unclustered-dot")) {
    map.addLayer({
      id: "unclustered-dot",
      type: "circle",
      source: "task-clusters",
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "stopNumber"], 0]],
      paint: {
        "circle-radius": 5,
        "circle-color": [
          "match", ["get", "highestPriority"],
          "critical", "#ef4444",
          "high", "#f97316",
          "medium", "#3b82f6",
          "low", "#9ca3af",
          "#9ca3af",
        ],
      },
    });
  }

  // Stop number / task count label
  if (!map.getLayer("unclustered-label")) {
    map.addLayer({
      id: "unclustered-label",
      type: "symbol",
      source: "task-clusters",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": [
          "case",
          [">", ["get", "stopNumber"], 0],
          ["to-string", ["get", "stopNumber"]],
          [
            "case",
            [">", ["get", "taskCount"], 1],
            ["to-string", ["get", "taskCount"]],
            "",
          ],
        ],
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-size": 12,
        "text-allow-overlap": true,
        "icon-allow-overlap": true,
      },
      paint: {
        "text-color": [
          "case",
          [">", ["get", "stopNumber"], 0],
          "#d4af37",
          "#e8e6e1",
        ],
      },
    });
  }
}

// ---- Component ----

export default function TaskMap({
  tasks,
  onSelectTask,
  routeGeometry,
  routeStopOrder = [],
}: TaskMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapboxglRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const popupRef = useRef<any>(null);
  const groupsRef = useRef<Map<string, PropertyGroup>>(new Map());
  const onSelectTaskRef = useRef(onSelectTask);
  onSelectTaskRef.current = onSelectTask;

  const [currentStyle, setCurrentStyle] = useState<"dark" | "satellite">("dark");
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(
    new Set(PRIORITY_ORDER)
  );
  const initialFitDoneRef = useRef(false);

  // Inject popup CSS once
  useEffect(() => {
    const id = "taskmap-popup-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = POPUP_STYLES;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  // Event delegation for popup "View Task" buttons
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest(".taskmap-view-btn") as HTMLElement | null;
      if (!btn) return;
      const taskId = btn.dataset.taskId;
      if (taskId && onSelectTaskRef.current) {
        onSelectTaskRef.current(taskId);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Filter tasks that have geocoded properties
  const geocodedTasks = useMemo(
    () => tasks.filter((t) => t.property?.lat != null && t.property?.lng != null),
    [tasks]
  );

  const propertyGroups = useMemo(
    () => groupTasksByProperty(geocodedTasks),
    [geocodedTasks]
  );

  const filteredGroups = useMemo(
    () =>
      propertyGroups
        .map((g) => ({
          ...g,
          tasks: g.tasks.filter((t) => priorityFilter.has(t.priority)),
        }))
        .filter((g) => g.tasks.length > 0)
        .map((g) => {
          let highest = "low";
          for (const t of g.tasks) {
            const o = PRIORITY_ORDER.indexOf(t.priority as (typeof PRIORITY_ORDER)[number]);
            const c = PRIORITY_ORDER.indexOf(highest as (typeof PRIORITY_ORDER)[number]);
            if (o >= 0 && (c < 0 || o < c)) highest = t.priority;
          }
          return { ...g, highestPriority: highest };
        }),
    [propertyGroups, priorityFilter]
  );

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const t of geocodedTasks) {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    }
    return counts;
  }, [geocodedTasks]);

  // ---- Initialize map ----
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    let cancelled = false;

    import("mapbox-gl").then((mapboxgl) => {
      if (cancelled || !mapContainerRef.current) return;

      const mb = mapboxgl.default || mapboxgl;
      mapboxglRef.current = mb;
      mb.accessToken = token;

      const map = new mb.Map({
        container: mapContainerRef.current,
        style: MAP_STYLES.dark,
        center: [-98.5795, 39.8283],
        zoom: 3.5,
        pitch: 0,
        bearing: 0,
        antialias: true,
      });

      // Controls
      map.addControl(new mb.NavigationControl(), "top-right");
      map.addControl(
        new mb.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        "top-right"
      );
      map.addControl(new mb.FullscreenControl(), "top-right");

      // Resize observer
      resizeObserverRef.current = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserverRef.current.observe(mapContainerRef.current);

      map.on("load", () => {
        if (cancelled) return;

        // Atmosphere
        map.setFog({
          range: [0.5, 10],
          color: "#0a0b0e",
          "high-color": "#1a1b2e",
          "horizon-blend": 0.05,
          "space-color": "#0a0b0e",
          "star-intensity": 0.15,
        });

        // 3D buildings
        const layers = map.getStyle().layers;
        let labelLayerId: string | undefined;
        if (layers) {
          for (const layer of layers) {
            if (
              layer.type === "symbol" &&
              (layer.layout as Record<string, unknown>)?.["text-field"]
            ) {
              labelLayerId = layer.id;
              break;
            }
          }
        }
        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#1a1b2e",
              "fill-extrusion-height": [
                "interpolate", ["linear"], ["zoom"],
                14, 0, 14.5, ["get", "height"],
              ],
              "fill-extrusion-base": [
                "interpolate", ["linear"], ["zoom"],
                14, 0, 14.5, ["get", "min_height"],
              ],
              "fill-extrusion-opacity": 0.6,
            },
          },
          labelLayerId
        );

        // All task layers (cluster + unclustered)
        addTaskLayers(map);

        // Cluster click → zoom in
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "cluster-circles", (e: any) => {
          const features = e.features;
          if (!features?.[0]) return;
          const clusterId = features[0].properties?.cluster_id;
          if (clusterId == null) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const src = map.getSource("task-clusters") as any;
          if (!src?.getClusterExpansionZoom) return;
          src.getClusterExpansionZoom(clusterId, (err: Error | null, zoom: number) => {
            if (err) return;
            map.easeTo({ center: [e.lngLat.lng, e.lngLat.lat], zoom });
          });
        });

        // Unclustered point click → popup
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "unclustered-point", (e: any) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const propertyId = feature.properties?.propertyId;
          const group = groupsRef.current.get(propertyId);
          if (!group) return;

          if (popupRef.current) popupRef.current.remove();

          const coords = feature.geometry.coordinates.slice() as [number, number];

          const popup = new mb.Popup({
            offset: 20,
            closeButton: true,
            className: "taskmap-popup",
            maxWidth: "300px",
          })
            .setLngLat(coords)
            .setHTML(buildPopupHTML(group, !!onSelectTaskRef.current))
            .addTo(map);

          popupRef.current = popup;
        });

        // Cursors
        map.on("mouseenter", "cluster-circles", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "cluster-circles", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("mouseenter", "unclustered-point", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "unclustered-point", () => {
          map.getCanvas().style.cursor = "";
        });

        setMapReady(true);
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (debounceTimerRef.current != null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
      initialFitDoneRef.current = false;
    };
  }, []);

  // Build stop number map
  const stopNumberMap = useMemo(() => {
    const m = new Map<string, number>();
    routeStopOrder.forEach((propId, idx) => m.set(propId, idx + 1));
    return m;
  }, [routeStopOrder]);

  // ---- Update GeoJSON data (debounced) ----
  const updateData = useCallback(() => {
    const map = mapRef.current;
    const mb = mapboxglRef.current;
    if (!map || !mb || !mapReady) return;

    // Update groups ref for popup click handler
    const gMap = new Map<string, PropertyGroup>();
    filteredGroups.forEach((g) => gMap.set(g.propertyId, g));
    groupsRef.current = gMap;

    // Update cluster source (includes stop numbers for layer styling)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clusterSource = map.getSource("task-clusters") as any;

    const features: GeoJSON.Feature[] = filteredGroups.map((g) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [g.lng, g.lat],
      },
      properties: {
        propertyId: g.propertyId,
        propertyName: g.propertyName,
        highestPriority: g.highestPriority,
        taskCount: g.tasks.length,
        stopNumber: stopNumberMap.get(g.propertyId) ?? 0,
      },
    }));

    if (clusterSource && typeof clusterSource.setData === "function") {
      clusterSource.setData({ type: "FeatureCollection", features });
    }

    if (filteredGroups.length === 0) return;

    // Camera fit
    const bounds = new mb.LngLatBounds();
    filteredGroups.forEach((g) => bounds.extend([g.lng, g.lat] as [number, number]));

    if (!initialFitDoneRef.current) {
      initialFitDoneRef.current = true;
      if (filteredGroups.length === 1) {
        map.flyTo({
          center: [filteredGroups[0].lng, filteredGroups[0].lat],
          zoom: 15,
          duration: 2000,
          essential: true,
        });
      } else {
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          maxZoom: 15,
          duration: 2000,
        });
      }
    }
  }, [filteredGroups, mapReady, stopNumberMap]);

  useEffect(() => {
    if (!mapReady) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(updateData, 60);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [updateData, mapReady]);

  // ---- Route visualization ----
  const drawRoute = useCallback(
    (geometry: GeoJSON.LineString | null) => {
      const map = mapRef.current;
      const mb = mapboxglRef.current;
      if (!map || !mb || !mapReady) return;

      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      if (map.getLayer("route-line-glow")) map.removeLayer("route-line-glow");
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getSource("route-source")) map.removeSource("route-source");

      if (!geometry) return;

      map.addSource("route-source", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry },
      });

      map.addLayer(
        {
          id: "route-line-glow",
          type: "line",
          source: "route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#d4af37",
            "line-width": 12,
            "line-opacity": 0.15,
            "line-blur": 4,
          },
        },
        "cluster-circles"
      );

      map.addLayer(
        {
          id: "route-line",
          type: "line",
          source: "route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#d4af37",
            "line-width": 3.5,
            "line-opacity": 0.9,
            "line-dasharray": [2, 2],
          },
        },
        "cluster-circles"
      );

      // Animate dash
      let dashOffset = 0;
      const animate = () => {
        dashOffset = (dashOffset + 0.15) % 4;
        if (map.getLayer("route-line")) {
          const shift = dashOffset;
          const d1 = 2 - (shift % 2);
          const d2 = shift % 2;
          const pattern = d2 > 0.01 ? [d2, 2, d1, 0] : [2, 2];
          map.setPaintProperty("route-line", "line-dasharray", pattern);
        }
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);

      // Fit to route bounds
      const routeCoords = geometry.coordinates;
      if (routeCoords.length > 0) {
        const routeBounds = new mb.LngLatBounds();
        for (const coord of routeCoords) {
          routeBounds.extend(coord as [number, number]);
        }
        map.fitBounds(routeBounds, {
          padding: { top: 100, bottom: 100, left: 100, right: 100 },
          maxZoom: 15,
          duration: 1500,
        });
      }
    },
    [mapReady]
  );

  useEffect(() => {
    drawRoute(routeGeometry ?? null);
  }, [routeGeometry, drawRoute]);

  // ---- Style switch ----
  const toggleStyle = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const next = currentStyle === "dark" ? "satellite" : "dark";
    setCurrentStyle(next);
    setMapReady(false);
    initialFitDoneRef.current = false;

    map.setStyle(MAP_STYLES[next]);

    map.once("style.load", () => {
      // Fog
      if (next === "dark") {
        map.setFog({
          range: [0.5, 10],
          color: "#0a0b0e",
          "high-color": "#1a1b2e",
          "horizon-blend": 0.05,
          "space-color": "#0a0b0e",
          "star-intensity": 0.15,
        });
      } else {
        map.setFog({
          range: [0.5, 10],
          color: "#dce6f0",
          "high-color": "#a0c0e0",
          "horizon-blend": 0.08,
          "space-color": "#d0e0f0",
          "star-intensity": 0,
        });
      }

      // 3D buildings
      const layers = map.getStyle().layers;
      let labelLayerId: string | undefined;
      if (layers) {
        for (const layer of layers) {
          if (
            layer.type === "symbol" &&
            (layer.layout as Record<string, unknown>)?.["text-field"]
          ) {
            labelLayerId = layer.id;
            break;
          }
        }
      }
      if (!map.getLayer("3d-buildings")) {
        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": next === "dark" ? "#1a1b2e" : "#d4c8a8",
              "fill-extrusion-height": [
                "interpolate", ["linear"], ["zoom"],
                14, 0, 14.5, ["get", "height"],
              ],
              "fill-extrusion-base": [
                "interpolate", ["linear"], ["zoom"],
                14, 0, 14.5, ["get", "min_height"],
              ],
              "fill-extrusion-opacity": 0.6,
            },
          },
          labelLayerId
        );
      }

      // Re-add all task layers
      addTaskLayers(map);

      // Re-attach cluster click
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", "cluster-circles", (e: any) => {
        const features = e.features;
        if (!features?.[0]) return;
        const clusterId = features[0].properties?.cluster_id;
        if (clusterId == null) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src = map.getSource("task-clusters") as any;
        if (!src?.getClusterExpansionZoom) return;
        src.getClusterExpansionZoom(clusterId, (err: Error | null, zoom: number) => {
          if (err) return;
          map.easeTo({ center: [e.lngLat.lng, e.lngLat.lat], zoom });
        });
      });

      // Re-attach unclustered click
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", "unclustered-point", (e: any) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const propertyId = feature.properties?.propertyId;
        const group = groupsRef.current.get(propertyId);
        if (!group) return;

        if (popupRef.current) popupRef.current.remove();
        const mb = mapboxglRef.current;
        if (!mb) return;

        const coords = feature.geometry.coordinates.slice() as [number, number];
        const popup = new mb.Popup({
          offset: 20,
          closeButton: true,
          className: "taskmap-popup",
          maxWidth: "300px",
        })
          .setLngLat(coords)
          .setHTML(buildPopupHTML(group, !!onSelectTaskRef.current))
          .addTo(map);

        popup.on("open", () => {
          setTimeout(() => {
            const btns = document.querySelectorAll(".taskmap-view-btn");
            btns.forEach((btn) => {
              const taskId = (btn as HTMLElement).dataset.taskId;
              if (taskId && onSelectTaskRef.current) {
                (btn as HTMLElement).onclick = () => onSelectTaskRef.current!(taskId);
              }
            });
          }, 0);
        });

        popupRef.current = popup;
      });

      map.on("mouseenter", "cluster-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "cluster-circles", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "unclustered-point", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "unclustered-point", () => {
        map.getCanvas().style.cursor = "";
      });

      setMapReady(true);
    });
  }, [currentStyle]);

  // ---- Priority filter toggle ----
  const togglePriority = useCallback((priority: string) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) {
        if (next.size <= 1) return prev;
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next;
    });
  }, []);

  // ---- Empty state ----
  if (geocodedTasks.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="text-center px-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <p className="text-sm">No geocoded properties to display</p>
          <p className="text-xs mt-1 opacity-60">Add addresses to properties so they appear on the map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Interactive Legend */}
      <div
        className="absolute top-3 left-3 rounded-xl px-4 py-3 text-xs select-none"
        style={{
          background: "rgba(10, 11, 14, 0.65)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(212, 175, 55, 0.15)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "#d4af37",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "8px",
          }}
        >
          Priority
        </div>
        {PRIORITY_ORDER.map((p) => {
          const active = priorityFilter.has(p);
          return (
            <button
              key={p}
              onClick={() => togglePriority(p)}
              className="flex items-center gap-2 mb-1.5 last:mb-0 w-full text-left"
              style={{
                opacity: active ? 1 : 0.35,
                transition: "opacity 0.2s",
                background: "none",
                border: "none",
                padding: "2px 0",
                cursor: "pointer",
              }}
              aria-label={`${active ? "Hide" : "Show"} ${p} priority tasks`}
              aria-pressed={active}
            >
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: PRIORITY_COLORS[p] }}
              />
              <span
                className="capitalize flex-1"
                style={{ color: active ? "#e8e6e1" : "#6b7280" }}
              >
                {p}
              </span>
              <span
                style={{
                  color: active ? "#9ca3af" : "#4b5563",
                  fontVariantNumeric: "tabular-nums",
                  minWidth: "16px",
                  textAlign: "right",
                }}
              >
                {priorityCounts[p]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Style Switcher */}
      <button
        onClick={toggleStyle}
        className="absolute left-3 rounded-lg flex items-center justify-center"
        style={{
          top: "calc(12px + 140px + 8px)",
          width: "36px",
          height: "36px",
          background: "rgba(10, 11, 14, 0.65)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(212, 175, 55, 0.15)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          cursor: "pointer",
          zIndex: 5,
          color: "#d4af37",
          transition: "background 0.15s",
        }}
        aria-label={`Switch to ${currentStyle === "dark" ? "satellite" : "dark"} map style`}
        title={currentStyle === "dark" ? "Satellite view" : "Dark view"}
      >
        {currentStyle === "dark" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    </div>
  );
}
