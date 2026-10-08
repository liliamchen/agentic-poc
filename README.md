# Enable Agentic Operations Prototype

Interactive React prototype for an agentic operations automation platform. It covers conversational requests, governed Flows, manual and scheduled Runs, human-in-the-loop decisions, approvals, versioned artifacts, recovery, Toolkit permissions, and operational insights.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173/`.

## Primary demo path

1. Start from **New Request** or use the **Run Flow** shortcut.
2. Run “MUFG Monthly Investment Report” for April 2026.
3. Resolve the AUM source conflict using the approved ledger.
4. Preview the generated PDF and enter an approval comment.
5. Choose **Approve report and complete**.
6. Open the Run to review its report versions and audit log.

Additional scenarios include missing-file recovery, failed Run retry/resume/rerun, Flow creation and publishing, Flow version comparison and rollback, Schedule configuration from a Flow, and Toolkit permission auditing.

Demo state is saved to `localStorage`. Use **Reset demo** in the sidebar to restore the fixtures.

## Product spec

See [`docs/enable-agentic-operations-prototype-spec.md`](docs/enable-agentic-operations-prototype-spec.md).

## Verification

```bash
pnpm run build
```
