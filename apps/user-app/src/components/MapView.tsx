import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, Rectangle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { LatLng, SafetyZone } from "@safetynet/shared-types";
import { RISK_ZONES, colorForRisk, type RiskZone } from "../lib/riskCities";

const userIcon = new L.DivIcon({
  className: "sn-marker",
  iconSize: [22, 22],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#38e1a7,#0ea5e9);border:2px solid #04111c;box-shadow:0 0 14px rgba(56,225,167,0.6);"></div>`,
});

const destIcon = new L.DivIcon({
  className: "sn-marker",
  iconSize: [22, 22],
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#f59e0b,#f97316);border:2px solid #04111c;box-shadow:0 0 14px rgba(249,115,22,0.6);"></div>`,
});

interface ClickHandlerProps {
  onClick: (latlng: LatLng) => void;
}
function ClickHandler({ onClick }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface RecenterProps {
  center: LatLng;
  zoom?: number;
}
function Recenter({ center, zoom }: RecenterProps) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom || map.getZoom());
  }, [center.lat, center.lng, zoom]);
  return null;
}

interface Props {
  center: LatLng;
  position?: LatLng | null;
  destination?: LatLng | null;
  zones?: SafetyZone[];
  expectedRoute?: LatLng[];
  actualRoute?: LatLng[];
  hotspots?: { center: LatLng; risk_weight: number }[];
  onMapClick?: (latlng: LatLng) => void;
  onRiskZoneClick?: (zone: RiskZone) => void;
  className?: string;
  zoom?: number;
  showZones?: boolean;
  showRiskZones?: boolean;
  interactive?: boolean;
}

export default function MapView({
  center,
  position,
  destination,
  zones,
  expectedRoute,
  actualRoute,
  hotspots,
  onMapClick,
  onRiskZoneClick,
  className,
  zoom = 13,
  showZones = true,
  showRiskZones = false,
  interactive = true,
}: Props) {
  const ref = useRef<L.Map | null>(null);
  return (
    <div className={`map ${className || ""}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        ref={(m) => {
          if (m) ref.current = m;
        }}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        zoomControl={interactive}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <Recenter center={center} zoom={zoom} />
        {onMapClick && <ClickHandler onClick={onMapClick} />}

        {showRiskZones &&
          RISK_ZONES.map((z) => (
            <Rectangle
              key={z.id}
              bounds={[
                [z.ll.lat, z.ll.lng],
                [z.ur.lat, z.ur.lng],
              ]}
              pathOptions={{
                color: colorForRisk(z.riskScore),
                fillColor: colorForRisk(z.riskScore),
                fillOpacity: 0.25,
                weight: 1.5,
              }}
              eventHandlers={{
                click: () => onRiskZoneClick?.(z),
              }}
            >
              <Popup>
                <strong>{z.name}</strong>
                <br />
                {z.district}, {z.state}
                <br />
                Risk score: {z.riskScore}
              </Popup>
            </Rectangle>
          ))}

        {showZones &&
          zones?.map((z) => (
            <Circle
              key={z.id}
              center={[z.center.lat, z.center.lng]}
              radius={z.radius_m}
              pathOptions={{
                color: "#38e1a7",
                fillColor: "#38e1a7",
                fillOpacity: 0.08,
                weight: 1.5,
                dashArray: "4 6",
              }}
            >
              <Popup>{z.label}</Popup>
            </Circle>
          ))}

        {hotspots?.map((h, i) => (
          <Circle
            key={i}
            center={[h.center.lat, h.center.lng]}
            radius={180}
            pathOptions={{
              color: "#ef4444",
              fillColor: "#ef4444",
              fillOpacity: Math.min(0.3, h.risk_weight * 0.3),
              weight: 1,
            }}
          />
        ))}

        {expectedRoute && expectedRoute.length > 0 && (
          <Polyline
            positions={expectedRoute.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#0ea5e9", weight: 4, opacity: 0.7, dashArray: "6 8" }}
          />
        )}
        {actualRoute && actualRoute.length > 0 && (
          <Polyline
            positions={actualRoute.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#38e1a7", weight: 5, opacity: 0.9 }}
          />
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
            <Popup>Destination</Popup>
          </Marker>
        )}
        {position && (
          <Marker position={[position.lat, position.lng]} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
