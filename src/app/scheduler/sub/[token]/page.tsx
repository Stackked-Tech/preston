"use client";

import { use } from "react";
import SubPortal from "@/components/scheduler/SubPortal";

export default function SubPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  return <SubPortal token={token} />;
}
