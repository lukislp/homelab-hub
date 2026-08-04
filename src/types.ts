export type IconConfig =
  | { type: "favicon" }
  | { type: "lucide"; name: string }
  | { type: "monogram" };

export interface LinkItem {
  id: string;
  name: string;
  url: string;
  description?: string;
  /** Category.id — must exist in DashboardData.categories */
  category: string;
  icon: IconConfig;
  checkEnabled: boolean;
  /** Optional probe target when the click URL is not reachable from inside the cluster */
  statusUrl?: string;
}

export interface Category {
  id: string;
  label: string;
}

export interface Settings {
  title: string;
  subtitle?: string;
}

export interface DashboardData {
  version: 1;
  settings: Settings;
  categories: Category[];
  /** Array position IS the display order */
  links: LinkItem[];
}

export type LinkState = "online" | "offline" | "unknown";

export interface LinkStatus {
  state: LinkState;
  latencyMs: number | null;
  /** ANY http response counts as online (401/403/302 included) */
  httpStatus: number | null;
  error?: string;
  checkedAt: string | null;
}

export interface StatusResponse {
  sweepAt: string | null;
  statuses: Record<string, LinkStatus>;
}
