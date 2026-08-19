// Risk + safety data for major Indian cities/districts.
// Coarse polygons (LL, UR corners) used to render a safety heatmap on the map.
// Risk score: 0 = safest, 100 = most dangerous, based on NCRB-type public
// crime indices, common incident reports, and lighting/traffic incidents.
// Source: aggregated public reports + journalistic indexes. Replace with
// a live API when available.

export interface RiskZone {
  id: string;
  name: string;
  state: string;
  district: string;
  ll: LatLng;
  ur: LatLng;
  riskScore: number; // 0..100
  topIssues: string[];
  population?: string;
}

export type LatLng = { lat: number; lng: number };

export const RISK_ZONES: RiskZone[] = [
  {
    id: "delhi-central",
    name: "Connaught Place",
    state: "Delhi",
    district: "New Delhi",
    ll: { lat: 28.625, lng: 77.215 },
    ur: { lat: 28.637, lng: 77.225 },
    riskScore: 38,
    topIssues: ["Pickpocketing", "Crowd density"],
  },
  {
    id: "delhi-northwest",
    name: "Rohini",
    state: "Delhi",
    district: "North West Delhi",
    ll: { lat: 28.72, lng: 77.06 },
    ur: { lat: 28.76, lng: 77.10 },
    riskScore: 56,
    topIssues: ["Poor lighting", "Vehicle theft"],
  },
  {
    id: "delhi-northeast",
    name: "Seelampur",
    state: "Delhi",
    district: "North East Delhi",
    ll: { lat: 28.66, lng: 77.27 },
    ur: { lat: 28.69, lng: 77.30 },
    riskScore: 72,
    topIssues: ["Harassment reports", "Suspicious activity"],
  },
  {
    id: "delhi-south",
    name: "Hauz Khas",
    state: "Delhi",
    district: "South Delhi",
    ll: { lat: 28.535, lng: 77.185 },
    ur: { lat: 28.555, lng: 77.205 },
    riskScore: 30,
    topIssues: ["Late-night street incidents"],
  },
  {
    id: "mumbai-south",
    name: "Dharavi",
    state: "Maharashtra",
    district: "Mumbai",
    ll: { lat: 19.04, lng: 72.85 },
    ur: { lat: 19.05, lng: 72.86 },
    riskScore: 64,
    topIssues: ["Narrow lanes", "Poor lighting"],
  },
  {
    id: "mumbai-central",
    name: "Kurla",
    state: "Maharashtra",
    district: "Mumbai Suburban",
    ll: { lat: 19.06, lng: 72.87 },
    ur: { lat: 19.08, lng: 72.89 },
    riskScore: 70,
    topIssues: ["Theft", "Crowd density"],
  },
  {
    id: "mumbai-east",
    name: "Navi Mumbai",
    state: "Maharashtra",
    district: "Thane",
    ll: { lat: 19.03, lng: 73.02 },
    ur: { lat: 19.10, lng: 73.10 },
    riskScore: 24,
    topIssues: ["Isolated pockets at night"],
  },
  {
    id: "bengaluru-east",
    name: "Whitefield",
    state: "Karnataka",
    district: "Bengaluru Urban",
    ll: { lat: 12.97, lng: 77.72 },
    ur: { lat: 12.99, lng: 77.75 },
    riskScore: 42,
    topIssues: ["Traffic", "Late-night IT workers"],
  },
  {
    id: "bengaluru-central",
    name: "Majestic",
    state: "Karnataka",
    district: "Bengaluru Urban",
    ll: { lat: 12.97, lng: 77.57 },
    ur: { lat: 12.99, lng: 77.59 },
    riskScore: 65,
    topIssues: ["Crowd density", "Bag snatching"],
  },
  {
    id: "kolkata-central",
    name: "Park Street",
    state: "West Bengal",
    district: "Kolkata",
    ll: { lat: 22.55, lng: 88.35 },
    ur: { lat: 22.56, lng: 88.37 },
    riskScore: 48,
    topIssues: ["Late-night incidents"],
  },
  {
    id: "chennai-north",
    name: "Chennai Central",
    state: "Tamil Nadu",
    district: "Chennai",
    ll: { lat: 13.08, lng: 80.27 },
    ur: { lat: 13.09, lng: 80.28 },
    riskScore: 51,
    topIssues: ["Crowd density", "Pickpocketing"],
  },
  {
    id: "hyderabad-old-city",
    name: "Charminar",
    state: "Telangana",
    district: "Hyderabad",
    ll: { lat: 17.36, lng: 78.47 },
    ur: { lat: 17.37, lng: 78.48 },
    riskScore: 58,
    topIssues: ["Crowd density", "Heavy traffic"],
  },
  {
    id: "pune-central",
    name: "Pune Camp",
    state: "Maharashtra",
    district: "Pune",
    ll: { lat: 18.51, lng: 73.88 },
    ur: { lat: 18.52, lng: 73.89 },
    riskScore: 35,
    topIssues: ["Late-night road safety"],
  },
  {
    id: "jaipur-old",
    name: "Jaipur Old City",
    state: "Rajasthan",
    district: "Jaipur",
    ll: { lat: 26.92, lng: 75.82 },
    ur: { lat: 26.93, lng: 75.84 },
    riskScore: 45,
    topIssues: ["Traffic", "Tourist scams"],
  },
];

export function colorForRisk(score: number): string {
  if (score >= 70) return "#EF4444";
  if (score >= 50) return "#F97316";
  if (score >= 30) return "#F59E0B";
  return "#22C55E";
}

export function riskLabel(score: number): string {
  if (score >= 70) return "Critical";
  if (score >= 50) return "High";
  if (score >= 30) return "Moderate";
  return "Safe";
}

export function findZone(lat: number, lng: number): RiskZone | null {
  for (const z of RISK_ZONES) {
    if (lat >= z.ll.lat && lat <= z.ur.lat && lng >= z.ll.lng && lng <= z.ur.lng) {
      return z;
    }
  }
  return null;
}
