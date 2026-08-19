// =====================================================================
// SafetyNet - Shared Type Definitions
// This module is the single source of truth for the event model, safety
// states, risk levels, and API contracts used by the User App, Guardian
// Dashboard, Simulator, CLI and Backend.
// =====================================================================

export type UUID = string;
export type ISODate = string;

// ---------- Core domain ----------

export interface LatLng {
  lat: number;
  lng: number;
}

export interface UserProfile {
  id: UUID;
  display_name: string;
  phone: string;
  email?: string;
  avatar_url?: string;
  created_at: ISODate;
}

export interface TrustedContact {
  id: UUID;
  user_id: UUID;
  name: string;
  phone: string;
  relation?: string;
  is_primary: boolean;
}

export interface SafetyZone {
  id: UUID;
  user_id: UUID;
  label: string;
  center: LatLng;
  radius_m: number; // meters
  kind: 'home' | 'college' | 'hostel' | 'work' | 'custom';
  is_familiar_suggestion?: boolean;
  created_at: ISODate;
}

export interface CommunityReport {
  id: UUID;
  user_id: UUID;
  location: LatLng;
  category:
    | 'poor_lighting'
    | 'harassment'
    | 'dangerous_crossing'
    | 'accident'
    | 'suspicious_activity'
    | 'broken_streetlight'
    | 'other';
  description?: string;
  severity: 1 | 2 | 3 | 4 | 5;
  created_at: ISODate;
}

export interface Hotspot {
  cell_id: string;
  center: LatLng;
  count: number;
  avg_severity: number;
  top_categories: string[];
  risk_weight: number; // 0..1
}

// ---------- Journey model ----------

export type SafetyLevel = 'normal' | 'check_in' | 'guardian_alert' | 'emergency';

export type JourneyStatus =
  | 'planned'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface Journey {
  id: UUID;
  user_id: UUID;
  destination: LatLng & { label?: string };
  expected_arrival_at: ISODate;
  started_at: ISODate;
  ended_at?: ISODate;
  status: JourneyStatus;
  trusted_contact_id?: UUID;
  expected_route: LatLng[];
  familiarity: 'familiar' | 'unfamiliar';
  route_signature?: string;
}

// ---------- Events ----------

export type EventType =
  | 'location_update'
  | 'zone_enter'
  | 'zone_exit'
  | 'route_deviation'
  | 'inactivity'
  | 'eta_delay'
  | 'missed_check_in'
  | 'check_in_ok'
  | 'manual_sos'
  | 'community_report'
  | 'simulator_move'
  | 'journey_start'
  | 'journey_end'
  | 'system';

export interface SafetyEvent {
  id: UUID;
  user_id: UUID;
  journey_id?: UUID;
  type: EventType;
  location?: LatLng;
  payload: Record<string, unknown>;
  created_at: ISODate;
}

// ---------- Risk assessment ----------

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';

export interface RiskAssessment {
  id: UUID;
  user_id: UUID;
  journey_id?: UUID;
  risk_level: RiskLevel;
  risk_score: number; // 0..100
  confidence: number; // 0..1
  explanation: string;
  recommended_action: string;
  contributing_factors: string[];
  safety_level: SafetyLevel;
  created_at: ISODate;
}

export interface SafetyState {
  user_id: UUID;
  safety_level: SafetyLevel;
  current_zone_id?: UUID;
  active_journey_id?: UUID;
  last_event_at?: ISODate;
  last_risk?: RiskAssessment;
  pending_check_in?: boolean;
}

// ---------- Alerts ----------

export type AlertChannel = 'sms' | 'push' | 'email' | 'in_app';
export type AlertStatus = 'pending' | 'sent' | 'failed' | 'acknowledged';

export interface Alert {
  id: UUID;
  user_id: UUID;
  journey_id?: UUID;
  level: SafetyLevel;
  channel: AlertChannel;
  message: string;
  to?: string; // phone / email
  status: AlertStatus;
  sent_at?: ISODate;
  created_at: ISODate;
}

// ---------- API contracts ----------

export interface ApiError {
  error: string;
  detail?: string;
}

export interface FamiliarSuggestion {
  center: LatLng;
  label: string;
  visits: number;
  suggested_radius_m: number;
}

export interface RouteRequest {
  origin: LatLng;
  destination: LatLng;
  avoid_hotspots: boolean;
}

export interface RouteResponse {
  polyline: LatLng[];
  distance_m: number;
  duration_s: number;
  safety_score: number;
  notes: string[];
}

export interface StatusResponse {
  ok: boolean;
  version: string;
  uptime_s: number;
  users: number;
  zones: number;
  active_journeys: number;
  alerts_last_24h: number;
}

export interface SimulateMoveRequest {
  user_id: UUID;
  to: LatLng;
  speed_mps?: number;
  source?: 'simulator' | 'real';
}

export interface SimulateMoveResponse {
  event: SafetyEvent;
  risk: RiskAssessment;
  state: SafetyState;
}

export interface StartJourneyRequest {
  user_id: UUID;
  destination: LatLng & { label?: string };
  expected_arrival_at: ISODate;
  trusted_contact_id?: UUID;
  origin?: LatLng;
}

export interface Scenarios {
  name:
    | 'normal'
    | 'route_deviation'
    | 'sudden_stop'
    | 'missed_check_in'
    | 'high_risk_route'
    | 'emergency'
    | 'full_demo';
  description: string;
}

export interface SimulatorState {
  running: boolean;
  speed_mps: number;
  virtual_user_id: UUID;
  position?: LatLng;
  last_event?: SafetyEvent;
  scenario?: Scenarios['name'];
  started_at?: ISODate;
}

// ---------- Realtime channel names ----------

export const REALTIME_CHANNELS = {
  state: (userId: UUID) => `state:${userId}`,
  events: (userId: UUID) => `events:${userId}`,
  alerts: (userId: UUID) => `alerts:${userId}`,
  risk: (userId: UUID) => `risk:${userId}`,
  guardian: (userId: UUID) => `guardian:${userId}`,
} as const;
