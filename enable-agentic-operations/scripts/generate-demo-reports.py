from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output" / "pdf"

REPORTS = [
    ("MUFG-April-2026-Report.pdf", "MUFG Monthly Investment Report", "April 2026", "Ready for approval"),
    ("MUFG-September-2026-Report.pdf", "MUFG Monthly Investment Report", "September 2026", "Approved"),
    ("BIS-Risk-Asset-Report-October-2026.pdf", "BIS Risk Asset Report", "October 2026", "Draft"),
    ("Daily-Cash-Flow-Reconciliation-October-2026-Report.pdf", "Daily Cash Flow Reconciliation", "4 October 2026", "Draft"),
]


def build_report(filename: str, title: str, period: str, status: str) -> None:
    styles = getSampleStyleSheet()
    output_path = OUTPUT_DIR / filename
    document = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=22 * mm,
        leftMargin=22 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=title,
    )

    story = [
        Paragraph("ENABLE · INVESTMENT OPERATIONS", styles["BodyText"]),
        Spacer(1, 8),
        Paragraph(title, styles["Title"]),
        Spacer(1, 5),
        Paragraph(f"Reporting period: {period}", styles["Normal"]),
        Spacer(1, 18),
        Table(
            [
                ["Status", status],
                ["Prepared by", "Enable Agent"],
                ["Control", "Human approval required before external delivery"],
            ],
            colWidths=[42 * mm, 110 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111827")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ]
            ),
        ),
        Spacer(1, 22),
        Paragraph("Executive summary", styles["Heading2"]),
        Spacer(1, 6),
        Paragraph(
            "The reporting package was prepared from the approved source profile. "
            "Automated validation checks completed and any material exceptions are surfaced below for review.",
            styles["BodyText"],
        ),
        Spacer(1, 16),
        Paragraph("Validation results", styles["Heading2"]),
        Spacer(1, 6),
        Table(
            [
                ["Check", "Result"],
                ["Required source files", "Passed"],
                ["Reporting period", "Passed"],
                ["Authorized data source", "Passed"],
                ["External delivery", "Not started"],
            ],
            colWidths=[105 * mm, 47 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            ),
        ),
        Spacer(1, 24),
        Paragraph(
            "This prototype artifact is generated for review. Approval decisions and comments are recorded in the Run Audit Log.",
            styles["Italic"],
        ),
    ]
    document.build(story)


if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for report in REPORTS:
        build_report(*report)
