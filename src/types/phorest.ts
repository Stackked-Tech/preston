// Phorest API response types

export interface PhorestBranch {
  branchId: string;
  name: string;
  timeZone?: string;
  city?: string;
  state?: string;
}

export interface PhorestStaff {
  staffId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  archived: boolean;
}

export interface PhorestAppointment {
  appointmentId: string;
  branchId: string;
  clientId: string;
  staffId: string;
  serviceId: string;
  serviceName?: string;
  appointmentDate: string;
  startTime: { hourOfDay: number; minuteOfHour: number } | string;
  price: number;
  state: "BOOKED" | "CHECKED_IN" | "PAID";
  activationState: "RESERVED" | "ACTIVE" | "CANCELED";
  deleted?: boolean;
}

export interface PhorestClient {
  clientId: string;
  firstName: string;
  lastName: string;
  firstVisit?: string | null;
  clientSince?: string;
  archived?: boolean;
  deleted?: boolean;
}

export interface PhorestPageMetadata {
  size: number;
  totalElements: number;
  totalPages: number;
  number: number;
}

// Commission calculation result types

export interface CommissionResult {
  branches: BranchCommission[];
  totalCommission: number;
  totalNewClients: number;
  fetchedAt: string;
}

export interface BranchCommission {
  branchId: string;
  branchName: string;
  stylists: StylistCommission[];
  branchTotal: number;
}

export interface StylistCommission {
  staffId: string;
  staffName: string;
  clients: ClientCommission[];
  stylistTotal: number;
}

export interface ClientCommission {
  clientId: string;
  clientName: string;
  firstVisitDate: string;
  services: ServiceCommission[];
  clientTotal: number;
}

export interface ServiceCommission {
  appointmentId: string;
  serviceName: string;
  appointmentDate: string;
  price: number;
  commission: number;
}
