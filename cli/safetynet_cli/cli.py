"""SafetyNet CLI — argparse entrypoint.

Run as: `safetynet <command> --help`

Examples:
  safetynet status
  safetynet zone list --user-id demo-user
  safetynet journey start --user-id demo-user --lat 28.7041 --lng 77.1025 --label College --eta 2025-01-01T18:00:00Z
  safetynet simulate --user-id demo-user --lat 28.66 --lng 77.16
  safetynet safety analyze --user-id demo-user
  safetynet demo full --user-id demo-user
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone

from . import format as fmt
from .client import SafetyNetClient


# ---------- common helpers ----------
def _add_user_id(p: argparse.ArgumentParser, default: str = "demo-user") -> None:
    p.add_argument("--user-id", default=default, help="user id (default: demo-user)")


def _add_eta(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--eta",
        default=(datetime.now(tz=timezone.utc) + timedelta(minutes=25)).isoformat(),
        help="ISO timestamp for expected arrival (default: now + 25m)",
    )


# ---------- main ----------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="safetynet",
        description="SafetyNet CLI — talk to the SafetyNet backend.",
    )
    p.add_argument("--url", default=None, help="backend URL (default: $SAFETYNET_URL or http://localhost:8000)")
    sub = p.add_subparsers(dest="command", required=True)

    # status
    sub.add_parser("status", help="show system status")

    # zones
    z = sub.add_parser("zone", help="manage safety zones")
    zsub = z.add_subparsers(dest="zone_cmd", required=True)

    p_zl = zsub.add_parser("list", help="list zones")
    _add_user_id(p_zl)

    p_za = zsub.add_parser("add", help="add a zone")
    _add_user_id(p_za)
    p_za.add_argument("--label", required=True)
    p_za.add_argument("--lat", type=float, required=True)
    p_za.add_argument("--lng", type=float, required=True)
    p_za.add_argument("--radius", type=float, default=250.0)
    p_za.add_argument("--kind", default="custom", choices=["home", "college", "hostel", "work", "custom"])

    p_zd = zsub.add_parser("delete", help="delete a zone")
    p_zd.add_argument("--zone-id", required=True)

    p_zs = zsub.add_parser("suggestions", help="frequent-location suggestions")
    _add_user_id(p_zs)

    # journeys
    j = sub.add_parser("journey", help="journey management")
    jsub = j.add_subparsers(dest="journey_cmd", required=True)

    p_js = jsub.add_parser("start", help="start a safe journey")
    _add_user_id(p_js)
    p_js.add_argument("--lat", type=float, required=True)
    p_js.add_argument("--lng", type=float, required=True)
    p_js.add_argument("--label", default=None)
    _add_eta(p_js)
    p_js.add_argument("--contact-id", default=None)

    p_jst = jsub.add_parser("status", help="active journey status")
    _add_user_id(p_jst)

    p_je = jsub.add_parser("end", help="end the active journey")
    _add_user_id(p_je)

    # state
    p_st = sub.add_parser("state", help="full safety state for a user")
    _add_user_id(p_st)

    # events
    p_ev = sub.add_parser("events", help="recent events")
    _add_user_id(p_ev)
    p_ev.add_argument("--limit", type=int, default=20)

    # risks
    p_rk = sub.add_parser("risks", help="recent risk assessments")
    _add_user_id(p_rk)
    p_rk.add_argument("--limit", type=int, default=10)

    # alerts
    p_al = sub.add_parser("alerts", help="list dispatched alerts")
    _add_user_id(p_al)

    # safety analyze
    p_an = sub.add_parser("safety", help="safety analysis subcommands")
    asub = p_an.add_subparsers(dest="safety_cmd", required=True)
    p_aa = asub.add_parser("analyze", help="run AI analysis on current state")
    _add_user_id(p_aa)

    # sos
    p_so = sub.add_parser("sos", help="trigger manual SOS")
    _add_user_id(p_so)

    # check-in
    p_ci = sub.add_parser("check-in", help="respond to a check-in")
    _add_user_id(p_ci)
    p_ci.add_argument("--missed", action="store_true", help="mark as missed (no response)")

    # simulate
    p_sm = sub.add_parser("simulate", help="simulate a single move event")
    _add_user_id(p_sm)
    p_sm.add_argument("--lat", type=float, required=True)
    p_sm.add_argument("--lng", type=float, required=True)

    # simulator control
    sm = sub.add_parser("simulator", help="interactive simulator")
    smsub = sm.add_subparsers(dest="sim_cmd", required=True)
    p_sms = smsub.add_parser("start", help="start autonomous movement")
    _add_user_id(p_sms)
    p_sms.add_argument("--speed", type=float, default=12.0)
    p_sms.add_argument("--scenario", default=None)
    p_sms2 = smsub.add_parser("stop", help="stop simulator")
    p_sms3 = smsub.add_parser("reset", help="reset simulator position")
    p_sms4 = smsub.add_parser("teleport", help="teleport the virtual user")
    _add_user_id(p_sms4)
    p_sms4.add_argument("--lat", type=float, required=True)
    p_sms4.add_argument("--lng", type=float, required=True)
    p_sms5 = smsub.add_parser("move-to", help="continuously move towards target")
    _add_user_id(p_sms5)
    p_sms5.add_argument("--lat", type=float, required=True)
    p_sms5.add_argument("--lng", type=float, required=True)
    p_sms6 = smsub.add_parser("speed", help="change movement speed")
    p_sms6.add_argument("--speed", type=float, required=True)
    p_sms7 = smsub.add_parser("state", help="show simulator state")

    # scenarios
    p_sc = sub.add_parser("scenario", help="run a scripted scenario")
    p_sc.add_argument("name", choices=[
        "normal", "route_deviation", "sudden_stop", "missed_check_in", "high_risk_route", "emergency", "full_demo"
    ])

    # demo
    p_dm = sub.add_parser("demo", help="run a polished demo")
    dmsub = p_dm.add_subparsers(dest="demo_cmd", required=True)
    p_dmf = dmsub.add_parser("full", help="run the full demo narrative")
    _add_user_id(p_dmf)

    # reports
    rp = sub.add_parser("report", help="community reports")
    rpsub = rp.add_subparsers(dest="report_cmd", required=True)
    p_rp = rpsub.add_parser("add", help="file a community report")
    _add_user_id(p_rp)
    p_rp.add_argument("--lat", type=float, required=True)
    p_rp.add_argument("--lng", type=float, required=True)
    p_rp.add_argument("--category", default="poor_lighting",
                      choices=["poor_lighting", "harassment", "dangerous_crossing",
                               "accident", "suspicious_activity", "broken_streetlight", "other"])
    p_rp.add_argument("--severity", type=int, default=3, choices=[1, 2, 3, 4, 5])
    p_rp.add_argument("--description", default=None)

    p_hs = sub.add_parser("hotspots", help="list aggregated community hotspots")

    # contacts
    p_co = sub.add_parser("contacts", help="list trusted contacts")
    _add_user_id(p_co)

    return p


# ---------- dispatch ----------
def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    client = SafetyNetClient(base_url=args.url)
    try:
        if args.command == "status":
            fmt.cmd_status(client, args)
        elif args.command == "zone":
            if args.zone_cmd == "list":
                fmt.cmd_zone_list(client, args)
            elif args.zone_cmd == "add":
                fmt.cmd_zone_add(client, args)
            elif args.zone_cmd == "delete":
                fmt.cmd_zone_delete(client, args)
            elif args.zone_cmd == "suggestions":
                fmt.cmd_zone_suggestions(client, args)
        elif args.command == "journey":
            if args.journey_cmd == "start":
                fmt.cmd_journey_start(client, args)
            elif args.journey_cmd == "status":
                fmt.cmd_journey_status(client, args)
            elif args.journey_cmd == "end":
                fmt.cmd_journey_end(client, args)
        elif args.command == "state":
            fmt.cmd_state(client, args)
        elif args.command == "events":
            fmt.cmd_events(client, args)
        elif args.command == "risks":
            fmt.cmd_risks(client, args)
        elif args.command == "alerts":
            fmt.cmd_alerts(client, args)
        elif args.command == "safety":
            fmt.cmd_safety_analyze(client, args)
        elif args.command == "sos":
            fmt.cmd_sos(client, args)
        elif args.command == "check-in":
            fmt.cmd_check_in(client, args)
        elif args.command == "simulate":
            fmt.cmd_simulate_move(client, args)
        elif args.command == "simulator":
            if args.sim_cmd == "start":
                fmt.cmd_simulator_start(client, args)
            elif args.sim_cmd == "stop":
                fmt.cmd_simulator_stop(client, args)
            elif args.sim_cmd == "reset":
                fmt.cmd_simulator_reset(client, args)
            elif args.sim_cmd == "teleport":
                fmt.cmd_simulator_teleport(client, args)
            elif args.sim_cmd == "move-to":
                fmt.cmd_simulator_move_to(client, args)
            elif args.sim_cmd == "speed":
                fmt.cmd_simulator_speed(client, args)
            elif args.sim_cmd == "state":
                fmt.cmd_simulator_state(client, args)
        elif args.command == "scenario":
            fmt.cmd_scenario(client, args)
        elif args.command == "demo":
            if args.demo_cmd == "full":
                fmt.cmd_demo_full(client, args)
        elif args.command == "report":
            if args.report_cmd == "add":
                fmt.cmd_report_add(client, args)
        elif args.command == "hotspots":
            fmt.cmd_hotspots(client, args)
        elif args.command == "contacts":
            fmt.cmd_contacts(client, args)
        else:
            print("Unknown command", args.command)
            return 2
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
