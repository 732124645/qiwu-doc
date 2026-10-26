---
description: 'v1.10.0 historical version: native mobile clock-in and clock-out, tenant policies and office sites, personal and department queries, and approved leave and travel links; no DingTalk required.'
---

# Attendance

::: warning v1.10.0 historical reference
Native attendance was publicly released in [v1.10.0](https://github.com/732124645/qiwu-vue-admin/tree/v1.10.0). The v1.11.0 public composition does not contain its source, pages or seeds. The following describes that historical version, not current installation steps. Existing tags and history remain available, including the stated real-device location and on-site acceptance limits. See [Office requests](/en/features/oa) for the current public scope.
:::

Employees use **Clock** on mobile to clock in, clock out and view their records. Administrators configure policies, office sites and queries under Office. Native attendance uses the independent OA capability, works with approvals disabled and needs no DingTalk account or clocking hardware. Sign-in, tenant-package and permission checks still apply.

## Initial setup

Each tenant has one policy, initially **enabled, Asia/Shanghai, no location check, 180-day retention**. Initialization preserves administrator edits, disabled or deleted settings, and creates no clock records.

- **Time zone**: an IANA zone; the server uses it to determine the workday.
- **No location (none)**: does not call device location services.
- **Office site (site)**: an administrator configures coordinates, allowed radius and accuracy threshold. Tapping Clock requests one foreground WGS84 location; the server checks distance and accuracy.
- **Retention**: 30–730 days. A scheduled job cleans historical records by tenant policy, initially daily at 04:15. Administrator changes and disabling are preserved. Backup retention is managed separately by the deployment owner.

## Clock in and out

There is one clock-in and one clock-out per workday. Time comes from the server; a client cannot select another employee, historical date, timestamp or source. Clock-out requires an earlier clock-in on the same workday.

Midnight starts a new workday, so yesterday's clock-in cannot support today's clock-out. Overnight shifts, multiple shifts, scheduling, holidays, corrections and offline uploads are not implemented. Do not use these rules for attendance settlement that requires those features.

Denied permission, unavailable or timed-out location, poor accuracy, a disabled site or being outside the radius rejects clocking explicitly. It never falls back to no location check. Buttons are disabled while locating or submitting. An uncertain outcome first queries the original request and refreshes today's state; the user may then choose to retry. The client does not automatically send another clock write.

Each action carries a personal random request ID, with persistent duplicate protection. Identical requests and parameters return the original result. Reusing an ID with changed parameters, or another request for the same daily action, conflicts. An old request never silently becomes a clock action for a new workday.

## Personal and department queries

Personal records are always restricted to the signed-in user. Management queries separately require permission and department data scope; root remains tenant-isolated. Records preserve the user, department, workday, time zone and policy snapshots at clock time. A later department move does not move history. No business API arbitrarily changes time, clocks for someone else or deletes raw records.

Daily summaries show clock records and approved leave / travel intervals:

- A personal day without activity still returns an empty summary row.
- Department summaries list active “user + department at the time” pairs. One employee may have multiple department snapshot rows; the total **is not headcount or a complete attendance roster**.
- No record does not prove absence; approved leave or travel does not prove clock-in. The system does not judge lateness, early departure, work hours or wage deductions.
- Leave / travel links reveal only type, status and time, without reasons, destinations, costs or attachments. Approval changes do not delete raw clock records.

## Location privacy and limits

Raw employee coordinates are used only for the current check, not stored in attendance tables, and masked in request auditing and HTTP logs. Records keep the fixed office-site snapshot, distance, accuracy and validation result, not a movement trail. No continuous background location permission is requested.

Device or software location can be forged. There is no Wi-Fi, Bluetooth, hardware attestation or device-level fraud protection. An ordinary location-radius check is not reliable proof of physical presence.

## Before release

H5 is for development and automated tests. Mini programs need allowed API domains, a declared location purpose and platform permissions; apps need foreground location permissions and release configuration.

**H5 automation and app / mini program builds have passed; real app and mini program location permissions and on-site clock-in/out have not yet been accepted.** A successful build does not establish permission or usable location on a device. Verify granting and denying permission, poor accuracy, out-of-range rejection, clock-in/out, repeated taps, querying after a lost connection, account switching and midnight boundaries on each target.

DingTalk clocking-hardware synchronization is a separate optional integration, not implemented or enabled. The assistant has no tool to clock for you.

See the repository's [native attendance documentation](https://github.com/732124645/qiwu-vue-admin/blob/v1.10.0/docs/attendance.md) (Chinese) for interfaces, cleanup and time rules.
