// Plugin registry — central registry for all integration connectors
// Plugins self-register and expose a common interface

export type PluginCategory = "calendar" | "payment" | "communication" | "crm" | "website" | "analytics";
export type ConnectorStatus = "active" | "inactive" | "error" | "pending_auth";

export interface FieldDefinition {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "email" | "select" | "boolean" | "number";
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  sensitive?: boolean; // mask in UI
}

export interface PluginCapability {
  id: string;
  name: string;
  description: string;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  icon: string;         // emoji or icon identifier
  category: PluginCategory;
  configFields: FieldDefinition[];
  capabilities: PluginCapability[];
  docsUrl?: string;
  popularIn?: string[]; // e.g. ["IN"] for India-specific plugins

  /** Test if the provided config is valid and can connect */
  testConnection(config: Record<string, any>): Promise<TestConnectionResult>;

  /** Perform any initial setup after connection (e.g. subscribe webhooks) */
  setup?(config: Record<string, any>): Promise<void>;

  /** Clean up when connector is disconnected */
  teardown?(config: Record<string, any>): Promise<void>;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  data?: Record<string, any>; // e.g. { accountName: "Business XYZ", calendars: [...] }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<string, Plugin>();

export function registerPlugin(plugin: Plugin): void {
  registry.set(plugin.id, plugin);
}

export function getPlugin(id: string): Plugin | undefined {
  return registry.get(id);
}

export function listPlugins(category?: PluginCategory): Plugin[] {
  const all = Array.from(registry.values());
  return category ? all.filter(p => p.category === category) : all;
}

export function pluginExists(id: string): boolean {
  return registry.has(id);
}

// NOTE: Plugins self-register when imported. To load all plugins at server start,
// import "server/plugins/load-all.ts" from your entry point (server/index.ts).
