import type {
  PhorestAppointment,
  PhorestClient,
  PhorestStaff,
  PhorestBranch,
  CommissionResult,
  BranchCommission,
  StylistCommission,
  ClientCommission,
  ServiceCommission,
} from "@/types/phorest";

const COMMISSION_RATE = 0.2;

export interface BranchData {
  branch: PhorestBranch;
  staff: PhorestStaff[];
  appointments: PhorestAppointment[];
}

export function calculateCommissions(
  branchDataList: BranchData[],
  clients: PhorestClient[],
  startDate: string,
  endDate: string
): CommissionResult {
  // Build client lookup map
  const clientMap = new Map<string, PhorestClient>();
  for (const client of clients) {
    clientMap.set(client.clientId, client);
  }

  // Filter to first-visit clients within date range
  const firstVisitClientIds = new Set<string>();
  for (const client of clients) {
    const firstVisitDate = client.firstVisit?.split("T")[0];
    if (
      firstVisitDate &&
      firstVisitDate >= startDate &&
      firstVisitDate <= endDate &&
      !client.deleted
    ) {
      firstVisitClientIds.add(client.clientId);
    }
  }

  const branches: BranchCommission[] = [];
  let totalCommission = 0;
  const allNewClientIds = new Set<string>();

  for (const { branch, staff, appointments } of branchDataList) {
    // Build staff lookup
    const staffMap = new Map<string, string>();
    for (const s of staff) {
      staffMap.set(s.staffId, `${s.firstName} ${s.lastName}`.trim());
    }

    // Filter appointments to first-visit clients, active/non-deleted, with price
    const eligibleAppointments = appointments.filter(
      (appt) =>
        firstVisitClientIds.has(appt.clientId) &&
        appt.activationState !== "CANCELED" &&
        !appt.deleted &&
        appt.price != null &&
        appt.price > 0
    );

    if (eligibleAppointments.length === 0) continue;

    // Group by stylist
    const stylistGroups = new Map<string, PhorestAppointment[]>();
    for (const appt of eligibleAppointments) {
      const key = appt.staffId;
      if (!stylistGroups.has(key)) stylistGroups.set(key, []);
      stylistGroups.get(key)!.push(appt);
    }

    const stylists: StylistCommission[] = [];
    let branchTotal = 0;

    for (const [staffId, appts] of stylistGroups) {
      // Group by client within stylist
      const clientGroups = new Map<string, PhorestAppointment[]>();
      for (const appt of appts) {
        if (!clientGroups.has(appt.clientId))
          clientGroups.set(appt.clientId, []);
        clientGroups.get(appt.clientId)!.push(appt);
      }

      const clientCommissions: ClientCommission[] = [];
      let stylistTotal = 0;

      for (const [clientId, clientAppts] of clientGroups) {
        const client = clientMap.get(clientId);
        if (!client) continue;

        allNewClientIds.add(clientId);

        const services: ServiceCommission[] = clientAppts.map((appt) => {
          const commission =
            Math.round(appt.price * COMMISSION_RATE * 100) / 100;
          return {
            appointmentId: appt.appointmentId,
            serviceName: appt.serviceName || "Service",
            appointmentDate: appt.appointmentDate,
            price: appt.price,
            commission,
          };
        });

        const clientTotal = services.reduce((sum, s) => sum + s.commission, 0);
        const clientTotalRounded = Math.round(clientTotal * 100) / 100;

        clientCommissions.push({
          clientId,
          clientName: `${client.firstName} ${client.lastName}`.trim(),
          firstVisitDate: client.firstVisit!,
          services,
          clientTotal: clientTotalRounded,
        });

        stylistTotal += clientTotalRounded;
      }

      stylistTotal = Math.round(stylistTotal * 100) / 100;

      stylists.push({
        staffId,
        staffName: staffMap.get(staffId) || "Unknown Stylist",
        clients: clientCommissions,
        stylistTotal,
      });

      branchTotal += stylistTotal;
    }

    branchTotal = Math.round(branchTotal * 100) / 100;
    totalCommission += branchTotal;

    branches.push({
      branchId: branch.branchId,
      branchName: branch.name,
      stylists,
      branchTotal,
    });
  }

  totalCommission = Math.round(totalCommission * 100) / 100;

  return {
    branches,
    totalCommission,
    totalNewClients: allNewClientIds.size,
    fetchedAt: new Date().toISOString(),
  };
}
