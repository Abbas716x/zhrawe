export type AppRole = "student" | "doctor" | "staff" | "admin";

export interface UserProfile {
  role: AppRole;
  name?: string;
  group?: string;
  studentId?: string;
  clinic?: string;
}

export interface AppSession extends UserProfile {
  uid: string;
  id: string;
  name: string;
  group?: string;
  [field: string]: any;
}

export interface CaseRecord {
  sid: string;
  sname: string;
  group: string;
  clinic: string;
  chair: string;
  status: string;
  created: number;
  f: Record<string, string>;
  med: Record<string, string>;
  teeth: string[];
  ev: Record<string, any>;
  [field: string]: any;
}
