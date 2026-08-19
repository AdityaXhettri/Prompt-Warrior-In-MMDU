"""CLI command implementations."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

console = Console()


# ---------- helpers ----------
def _risk_color(level: str) -> str:
    return {
        "low": "green",
        "moderate": "yellow",
        "elevated": "dark_orange",
        "high": "red",
        "critical": "bold red",
    }.get(level, "white")


def _safety_color(level: str) -> str:
    return {
        "normal": "green",
        "check_in": "yellow",
        "guardian_alert": "dark_orange",
        "emergency": "bold red",
    }.get(level, "white")


def _print_json(data: Any) -> None:
    console.print_json(json.dumps(data, default=str, indent=2))


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


# ---------- commands ----------
def cmd_status(client, args) -> None:
    s = client.status()
    table = Table(title="SafetyNet Status", show_header=True)
    table.add_column("Field", style="cyan")
    table.add_column("Value", style="white")
    table.add_row("Status", "OK healthy" if s["ok"] else "DOWN")
    table.add_row("Version", s["version"])
    table.add_row("Uptime", f"{s['uptime_s']}s")
    table.add_row("Users", str(s["users"]))
    table.add_row("Zones", str(s["zones"]))
    table.add_row("Active journeys", str(s["active_journeys"]))
    table.add_row("Alerts (24h)", str(s["alerts_last_24h"]))
    console.print(table)


def cmd_zone_list(client, args) -> None:
    zones = client.zones(args.user_id)
    if not zones:
        console.print("No safety zones yet.")
        return
    table = Table(title="Safety Zones", show_header=True)
    table.add_column("Label", style="cyan")
    table.add_column("Kind")
    table.add_column("Center")
    table.add_column("Radius (m)")
    for z in zones:
        c = f"{z['center']['lat']:.4f}, {z['center']['lng']:.4f}"
        table.add_row(z["label"], z["kind"], c, str(int(z["radius_m"])))
    console.print(table)


def cmd_zone_add(client, args) -> None:
    payload = {
        "user_id": args.user_id,
        "label": args.label,
        "center": {"lat": args.lat, "lng": args.lng},
        "radius_m": args.radius,
        "kind": args.kind,
    }
    z = client.create_zone(payload)
    console.print(f"[green]Added zone:[/green] {z['label']} ({z['id']})")


def cmd_zone_suggestions(client, args) -> None:
    out = client.zone_suggestions(args.user_id)
    if not out:
        console.print("Not enough data to suggest zones yet.")
        return
    table = Table(title="Familiar-zone suggestions", show_header=True)
    table.add_column("Label", style="cyan")
    table.add_column("Center")
    table.add_column("Visits")
    for s in out:
        c = f"{s['center']['lat']:.4f}, {s['center']['lng']:.4f}"
        table.add_row(s["label"], c, str(s["visits"]))
    console.print(table)


def cmd_zone_delete(client, args) -> None:
    client.delete_zone(args.zone_id)
    console.print(f"[green]Deleted zone {args.zone_id}[/green]")


def cmd_journey_start(client, args) -> None:
    payload = {
        "user_id": args.user_id,
        "destination": {"lat": args.lat, "lng": args.lng, "label": args.label},
        "expected_arrival_at": args.eta,
        "trusted_contact_id": args.contact_id,
    }
    j = client.start_journey(payload)
    console.print(f"[green]Started journey {j['id']}[/green] (familiar={j['familiarity']})")


def cmd_journey_status(client, args) -> None:
    j = client.active_journey(args.user_id)
    if not j:
        console.print("[yellow]No active journey.[/yellow]")
        return
    table = Table(title="Active Journey", show_header=True)
    table.add_column("Field", style="cyan")
    table.add_column("Value")
    for k in ("id", "status", "familiarity", "destination_label", "expected_arrival_at"):
        table.add_row(k, str(j.get(k)))
    d = j["destination"]
    table.add_row("destination", f"{d['lat']:.4f}, {d['lng']:.4f}")
    console.print(table)


def cmd_journey_end(client, args) -> None:
    j = client.end_journey(args.user_id, status="completed")
    console.print(f"[green]Ended journey {j['id']}[/green]")


def cmd_state(client, args) -> None:
    s = client.state(args.user_id)
    last_risk = s.get("last_risk") or {}
    panel_lines = [
        f"Safety level: [{_safety_color(s['safety_level'])}]{s['safety_level']}[/]",
        f"Active journey: {s.get('active_journey_id') or '-'}",
        f"Current zone: {s.get('current_zone_id') or '-'}",
        f"Last event: {s.get('last_event_at') or '-'}",
    ]
    if last_risk:
        panel_lines.append(
            f"Risk: [{_risk_color(last_risk.get('risk_level','low'))}]{last_risk.get('risk_level')}[/] "
            f"({last_risk.get('risk_score')}/100, conf {last_risk.get('confidence')})"
        )
        panel_lines.append(f"Reason: {last_risk.get('explanation')}")
        panel_lines.append(f"Action: {last_risk.get('recommended_action')}")
    console.print(Panel("\n".join(panel_lines), title=f"Safety state · {args.user_id}"))


def cmd_events(client, args) -> None:
    evs = client.events(args.user_id, limit=args.limit)
    if not evs:
        console.print("No events yet.")
        return
    table = Table(title="Recent events", show_header=True)
    table.add_column("At", style="cyan")
    table.add_column("Type")
    table.add_column("Location")
    table.add_column("Payload")
    for e in evs:
        loc = "-"
        if e.get("location"):
            loc = f"{e['location']['lat']:.4f},{e['location']['lng']:.4f}"
        table.add_row(e["created_at"], e["type"], loc, json.dumps(e.get("payload", {}))[:60])
    console.print(table)


def cmd_risks(client, args) -> None:
    rs = client.risks(args.user_id, limit=args.limit)
    for r in rs:
        console.print(
            f"[{_risk_color(r['risk_level'])}]{r['risk_level'].upper():8}[/] "
            f"{r['risk_score']:3}/100 conf={r['confidence']:.2f}  -  {r['explanation']}"
        )


def cmd_alerts(client, args) -> None:
    al = client.alerts(args.user_id)
    if not al:
        console.print("No alerts dispatched.")
        return
    for a in al:
        console.print(
            f"[{_safety_color(a['level'])}]{a['level']}[/] "
            f"-> {a.get('to') or 'in-app'}  ({a['status']})  {a['message']}"
        )


def cmd_safety_analyze(client, args) -> None:
    r = client.analyze(args.user_id)
    text = Text()
    text.append(f"{r['risk_level'].upper()} ", style=_risk_color(r['risk_level']))
    text.append(f"{r['risk_score']}/100\n")
    text.append(f"Confidence: {r['confidence']}\n")
    text.append(f"Explanation: {r['explanation']}\n")
    text.append(f"Recommended action: {r['recommended_action']}\n")
    text.append(f"Contributing factors: {', '.join(r.get('contributing_factors', []))}\n")
    console.print(Panel(text, title="AI Risk Analysis"))


def cmd_sos(client, args) -> None:
    r = client.sos(args.user_id)
    console.print(f"[bold red]SOS dispatched[/bold red] — alert status: {r['alert']['status']}")


def cmd_check_in(client, args) -> None:
    r = client.check_in(args.user_id, ok=not args.missed)
    console.print(f"[cyan]Check-in recorded[/cyan] {r['state']['safety_level']}")


def cmd_simulate_move(client, args) -> None:
    r = client.move(args.user_id, {"lat": args.lat, "lng": args.lng})
    risk = r["risk"]
    console.print(
        f"move -> [{_risk_color(risk['risk_level'])}]{risk['risk_level']}[/] "
        f"{risk['risk_score']}/100  {risk['explanation']}"
    )


def cmd_simulator_start(client, args) -> None:
    out = client.simulator_start(args.user_id, args.speed, scenario=args.scenario)
    console.print(f"[green]Simulator running[/green] {out['state']}")


def cmd_simulator_stop(client, args) -> None:
    client.simulator_stop()
    console.print("[yellow]Simulator stopped[/yellow]")


def cmd_simulator_reset(client, args) -> None:
    client.simulator_reset()
    console.print("[yellow]Simulator reset[/yellow]")


def cmd_simulator_teleport(client, args) -> None:
    client.simulator_teleport(args.user_id, args.lat, args.lng)
    console.print(f"[green]Teleported to {args.lat},{args.lng}[/green]")


def cmd_simulator_move_to(client, args) -> None:
    client.simulator_move_to(args.user_id, args.lat, args.lng)
    console.print(f"[green]Now moving to {args.lat},{args.lng}[/green]")


def cmd_simulator_speed(client, args) -> None:
    out = client.simulator_speed(args.speed)
    console.print(f"[green]Speed: {out['speed_mps']} m/s[/green]")


def cmd_simulator_state(client, args) -> None:
    out = client.simulator_state()
    console.print_json(json.dumps(out, indent=2))


def cmd_scenario(client, args) -> None:
    out = client.run_scenario(args.name)
    console.print(f"[green]Scenario '{args.name}' done[/green]: {len(out['steps'])} steps")


def cmd_demo_full(client, args) -> None:
    out = client.run_scenario("full_demo")
    console.print("[bold cyan]═══ Full demo complete ═══[/bold cyan]")
    for s in out["steps"]:
        console.print(f"  · {s['step']}")
    final = client.state(args.user_id)
    console.print(f"Final safety level: [{_safety_color(final['safety_level'])}]{final['safety_level']}[/]")


def cmd_report_add(client, args) -> None:
    payload = {
        "user_id": args.user_id,
        "location": {"lat": args.lat, "lng": args.lng},
        "category": args.category,
        "description": args.description,
        "severity": args.severity,
    }
    client.add_report(payload)
    console.print("[green]Report added[/green]")


def cmd_hotspots(client, args) -> None:
    hs = client.hotspots()
    if not hs:
        console.print("No hotspots yet.")
        return
    table = Table(title="Safety Hotspots", show_header=True)
    table.add_column("Cell", style="cyan")
    table.add_column("Center")
    table.add_column("Count")
    table.add_column("Avg severity")
    table.add_column("Top categories")
    table.add_column("Risk weight")
    for h in hs:
        c = f"{h['center']['lat']:.4f},{h['center']['lng']:.4f}"
        table.add_row(
            h["cell_id"],
            c,
            str(h["count"]),
            str(h["avg_severity"]),
            ", ".join(h["top_categories"]),
            f"{h['risk_weight']:.2f}",
        )
    console.print(table)


def cmd_contacts(client, args) -> None:
    cs = client.contacts(args.user_id)
    for c in cs:
        primary = " (primary)" if c.get("is_primary") else ""
        console.print(f"  {c['name']}{primary}: {c['phone']}")
