// Google Calendar plugin
// OAuth 2.0 flow + Calendar API for reading free/busy and creating events

import { registerPlugin } from "./registry.js";

const GOOGLE_CALENDAR_SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

registerPlugin({
  id: "google_calendar",
  name: "Google Calendar",
  description: "Sync appointments with Google Calendar — create events, check availability, and send Google Meet links.",
  icon: "📅",
  category: "calendar",
  docsUrl: "https://developers.google.com/calendar",
  configFields: [
    { key: "clientId", label: "OAuth Client ID", type: "text", required: true, description: "From Google Cloud Console → Credentials" },
    { key: "clientSecret", label: "OAuth Client Secret", type: "password", required: true, sensitive: true },
    { key: "refreshToken", label: "Refresh Token", type: "password", required: true, sensitive: true, description: "Obtained after OAuth authorization flow" },
    { key: "calendarId", label: "Calendar ID", type: "text", required: false, placeholder: "primary", description: "Leave empty to use primary calendar" },
  ],
  capabilities: [
    { id: "create_event", name: "Create Events", description: "Add confirmed appointments to calendar" },
    { id: "free_busy", name: "Free/Busy Check", description: "Check staff availability" },
    { id: "meet_link", name: "Google Meet Links", description: "Auto-generate video call links" },
  ],

  async testConnection(config) {
    try {
      const token = await refreshAccessToken(config as GoogleCalendarConfig);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId || "primary")}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        return { success: false, message: `Calendar API returned ${res.status}` };
      }
      const data = await res.json() as any;
      return {
        success: true,
        message: `Connected to calendar: ${data.summary}`,
        data: { calendarName: data.summary, timeZone: data.timeZone },
      };
    } catch (e: any) {
      return { success: false, message: `Connection failed: ${e.message}` };
    }
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId?: string;
}

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  attendees?: Array<{ email: string; displayName?: string }>;
  createMeetLink?: boolean;
  timezone?: string;
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string;
  meetLink?: string;
}

export interface FreeBusyResult {
  busy: Array<{ start: string; end: string }>;
  calendarId: string;
}

// ─── OAuth Token Management ───────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function refreshAccessToken(config: GoogleCalendarConfig): Promise<string> {
  const cacheKey = config.refreshToken.substring(0, 20);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json() as any;
    throw new Error(`Token refresh failed: ${err.error_description || err.error}`);
  }

  const data = await res.json() as TokenResponse;
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

/**
 * Generates the OAuth authorization URL for the initial setup.
 * The user visits this URL, grants permissions, and we get a code to exchange for tokens.
 */
export function getAuthorizationUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges an authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json() as any;
    throw new Error(`Token exchange failed: ${err.error_description || err.error}`);
  }

  const data = await res.json() as any;
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

// ─── Calendar Operations ──────────────────────────────────────────────────────

/**
 * Creates a calendar event for a confirmed appointment.
 */
export async function createCalendarEvent(
  config: GoogleCalendarConfig,
  event: CalendarEvent
): Promise<CalendarEventResult> {
  const token = await refreshAccessToken(config);
  const calendarId = config.calendarId || "primary";

  const body: any = {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.startsAt.toISOString(),
      timeZone: event.timezone || "Asia/Kolkata",
    },
    end: {
      dateTime: event.endsAt.toISOString(),
      timeZone: event.timezone || "Asia/Kolkata",
    },
    attendees: event.attendees?.map(a => ({ email: a.email, displayName: a.displayName })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 },
        { method: "popup", minutes: 30 },
      ],
    },
    sendNotifications: true,
  };

  if (event.createMeetLink) {
    body.conferenceData = {
      createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${event.createMeetLink ? "?conferenceDataVersion=1" : ""}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json() as any;
    throw new Error(`Failed to create event: ${err.error?.message || res.status}`);
  }

  const data = await res.json() as any;
  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
    meetLink: data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri,
  };
}

/**
 * Deletes a calendar event (when appointment is cancelled).
 */
export async function deleteCalendarEvent(config: GoogleCalendarConfig, eventId: string): Promise<void> {
  const token = await refreshAccessToken(config);
  const calendarId = config.calendarId || "primary";
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=all`;
  await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
}

/**
 * Gets free/busy information for availability checking.
 */
export async function getFreeBusy(
  config: GoogleCalendarConfig,
  from: Date,
  to: Date
): Promise<FreeBusyResult> {
  const token = await refreshAccessToken(config);
  const calendarId = config.calendarId || "primary";

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) throw new Error(`FreeBusy failed: ${res.status}`);

  const data = await res.json() as any;
  const busy = data.calendars?.[calendarId]?.busy || [];
  return { busy, calendarId };
}

/**
 * Lists upcoming events (used for sync/import existing appointments).
 */
export async function listUpcomingEvents(config: GoogleCalendarConfig, days = 7): Promise<any[]> {
  const token = await refreshAccessToken(config);
  const calendarId = config.calendarId || "primary";
  const now = new Date();
  const future = new Date(now.getTime() + days * 86400000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    maxResults: "250",
    singleEvents: "true",
    orderBy: "startTime",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error(`List events failed: ${res.status}`);
  const data = await res.json() as any;
  return data.items || [];
}
