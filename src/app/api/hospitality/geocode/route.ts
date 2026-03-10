import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { address, city, state, zip } = await req.json();

    if (!address?.trim()) {
      return NextResponse.json(
        { error: "address is required" },
        { status: 400 }
      );
    }

    const parts = [address.trim(), city?.trim(), [state?.trim(), zip?.trim()].filter(Boolean).join(" ")].filter(Boolean);
    const searchString = parts.join(", ");

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Mapbox token not configured" },
        { status: 500 }
      );
    }

    const mapboxResponse = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchString)}.json?access_token=${token}&limit=1`
    );

    if (!mapboxResponse.ok) {
      return NextResponse.json(
        { error: "Geocoding service error" },
        { status: 502 }
      );
    }

    const data = await mapboxResponse.json();

    if (!data.features || data.features.length === 0) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const [lng, lat] = data.features[0].center;
    return NextResponse.json({ lat, lng });
  } catch (err) {
    console.error("Geocode error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
