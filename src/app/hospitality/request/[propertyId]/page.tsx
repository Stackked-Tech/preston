import RequestForm from "@/components/hospitality/RequestForm";

export const metadata = {
  title: "Maintenance Request",
};

export default async function RequestPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  return <RequestForm propertyId={propertyId} />;
}
