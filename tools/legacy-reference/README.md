# Locked Compose UI Reference

These files are byte-for-byte snapshots from:

- Repository: https://github.com/dreamcolor123/SKRoot-Pro-Compose
- Tag: `v4.6.2.1`
- Commit: `d2a8ccf8067e031dddbbffc972eb1cb81ed77df5`
- Source prefix: `app/src/main/java/com/linux/permissionmanager/`

All eleven Git blobs were compared with local baseline `9a1b00a` and matched.
The snapshots are verification inputs only and are outside Android source sets.
Their SHA-256 and Git blob IDs are pinned in `docs/legacy-ui-source.json`.

The compiled copies live under `ui/legacy`. Their allowed adaptations are:
package/import isolation, extraction and public naming of `LegacyMainScreen`,
and a new/legacy UI selector at the top of the original settings page.
Business models, ViewModels, repositories, and persisted original appearance
fields remain owned by the existing application.

Run `scripts/verify_legacy_ui_source.ps1` from PowerShell to verify the snapshot
and adapted source hashes without downloading or changing files.
