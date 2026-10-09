import io
from datetime import datetime
from typing import Optional, List, Dict

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from apps.timetables.models import Timetable, TimetableEntry
from apps.academics.models import PeriodSlot, Section
from apps.faculty.models import Faculty
from apps.rooms.models import Room


class TimetablePDFGenerator:
    """
    Generates publication-quality, landscape PDF timetables for Sections, Faculty, and Rooms.
    Handles long subject/faculty names, break period highlights, and institutional legends.
    """

    @classmethod
    def generate_section_pdf(cls, timetable: Timetable, section_id: int) -> bytes:
        section = Section.objects.select_related(
            'semester__academic_year', 'semester__department__college', 'semester__shift'
        ).get(id=section_id)

        entries = timetable.entries.select_related(
            'subject', 'faculty__user', 'room', 'period_slot'
        ).filter(section_id=section_id)

        title = f"CLASS TIMETABLE — SECTION {section.name.upper()}"
        subtitle = (
            f"Department of {section.semester.department.name} | "
            f"Semester {section.semester.semester_number} | "
            f"Academic Year: {timetable.academic_year.name} | "
            f"Shift: {timetable.shift.name}"
        )

        return cls._build_pdf(
            timetable=timetable,
            title=title,
            subtitle=subtitle,
            entries=list(entries),
            view_type='section'
        )

    @classmethod
    def generate_faculty_pdf(cls, timetable: Timetable, faculty_id: int) -> bytes:
        faculty = Faculty.objects.select_related(
            'user', 'department__college'
        ).get(id=faculty_id)

        entries = timetable.entries.select_related(
            'section', 'subject', 'room', 'period_slot'
        ).filter(faculty_id=faculty_id)

        fac_name = f"{faculty.user.first_name} {faculty.user.last_name}".strip() or faculty.user.username
        title = f"FACULTY TEACHING SCHEDULE — {fac_name.upper()} ({faculty.employee_id})"
        subtitle = (
            f"Department of {faculty.department.name} | "
            f"Academic Year: {timetable.academic_year.name} | "
            f"Designation: {faculty.get_designation_display()} | "
            f"Total Assigned: {len(entries)} Periods/Week"
        )

        return cls._build_pdf(
            timetable=timetable,
            title=title,
            subtitle=subtitle,
            entries=list(entries),
            view_type='faculty'
        )

    @classmethod
    def generate_room_pdf(cls, timetable: Timetable, room_id: int) -> bytes:
        room = Room.objects.select_related('college', 'department').get(id=room_id)

        entries = timetable.entries.select_related(
            'section', 'subject', 'faculty__user', 'period_slot'
        ).filter(room_id=room_id)

        title = f"ROOM UTILIZATION SCHEDULE — {room.code.upper()} ({room.name})"
        subtitle = (
            f"Room Type: {room.get_room_type_display()} | "
            f"Capacity: {room.capacity} seats | "
            f"Academic Year: {timetable.academic_year.name} | "
            f"Booked Slots: {len(entries)} Periods/Week"
        )

        return cls._build_pdf(
            timetable=timetable,
            title=title,
            subtitle=subtitle,
            entries=list(entries),
            view_type='room'
        )

    @classmethod
    def _build_pdf(
        cls,
        timetable: Timetable,
        title: str,
        subtitle: str,
        entries: List[TimetableEntry],
        view_type: str
    ) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=24,
            rightMargin=24,
            topMargin=24,
            bottomMargin=24
        )

        styles = getSampleStyleSheet()

        college_name = timetable.academic_year.college.name.upper()

        header_style = ParagraphStyle(
            'InstitutionHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=18,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#0f172a')
        )
        title_style = ParagraphStyle(
            'TimetableTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#2563eb')
        )
        sub_style = ParagraphStyle(
            'TimetableSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#64748b')
        )
        meta_style = ParagraphStyle(
            'TimetableMeta',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=7,
            leading=9,
            alignment=TA_RIGHT,
            textColor=colors.HexColor('#94a3b8')
        )

        cell_header_style = ParagraphStyle(
            'CellHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#1e293b')
        )
        day_cell_style = ParagraphStyle(
            'DayCell',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#0f172a')
        )
        cell_subject_style = ParagraphStyle(
            'CellSubject',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#0f172a')
        )
        cell_meta_style = ParagraphStyle(
            'CellMeta',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=6.5,
            leading=8,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#475569')
        )
        break_style = ParagraphStyle(
            'BreakText',
            parent=styles['Normal'],
            fontName='Helvetica-BoldOblique',
            fontSize=7,
            leading=9,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#64748b')
        )

        elements = []

        # 1. Institutional Headers
        elements.append(Paragraph(college_name, header_style))
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(subtitle, sub_style))
        elements.append(Spacer(1, 4))

        meta_info = (
            f"Status: {timetable.get_status_display()} | Version: v{timetable.version} | "
            f"Generated: {datetime.now().strftime('%d-%b-%Y %H:%M')}"
        )
        elements.append(Paragraph(meta_info, meta_style))
        elements.append(Spacer(1, 6))

        # 2. Query Period Slots for Shift
        slots = list(
            PeriodSlot.objects.filter(shift=timetable.shift).order_by('day_of_week', 'period_number')
        )
        days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
        # Filter days that have slots
        active_days = [d for d in days if any(s.day_of_week == d for s in slots)]
        if not active_days:
            active_days = ['MON', 'TUE', 'WED', 'THU', 'FRI']

        unique_p_nums = sorted(list(set(s.period_number for s in slots)))

        # 3. Construct Table Header Row
        header_row = [Paragraph("<b>DAY / TIME</b>", cell_header_style)]
        for p_num in unique_p_nums:
            example_slot = next((s for s in slots if s.period_number == p_num), None)
            if example_slot:
                t_str = f"{example_slot.start_time.strftime('%H:%M')}–{example_slot.end_time.strftime('%H:%M')}"
                if example_slot.is_break:
                    lbl = example_slot.break_label or "BREAK"
                    header_row.append(Paragraph(f"<b>{lbl}</b><br/><font size=6>{t_str}</font>", cell_header_style))
                else:
                    header_row.append(Paragraph(f"<b>PERIOD {p_num}</b><br/><font size=6>{t_str}</font>", cell_header_style))
            else:
                header_row.append(Paragraph(f"<b>PERIOD {p_num}</b>", cell_header_style))

        table_data = [header_row]

        # Map entries: (day, slot_id) -> entry
        entry_map: Dict[tuple, TimetableEntry] = {}
        for e in entries:
            entry_map[(e.day_of_week, e.period_slot_id)] = e

        # 4. Construct Data Rows for each Day
        for day in active_days:
            day_display = dict(PeriodSlot._meta.get_field('day_of_week').choices).get(day, day)
            row = [Paragraph(f"<b>{day_display.upper()}</b>", day_cell_style)]

            for p_num in unique_p_nums:
                slot = next((s for s in slots if s.day_of_week == day and s.period_number == p_num), None)
                if not slot:
                    row.append(Paragraph("—", cell_meta_style))
                elif slot.is_break:
                    lbl = slot.break_label or "LUNCH BREAK"
                    row.append(Paragraph(f"RECESS<br/><font size=5>{lbl}</font>", break_style))
                else:
                    entry = entry_map.get((day, slot.id))
                    if entry:
                        is_lab = (entry.subject.subject_type == 'LAB')
                        lab_badge = " [LAB]" if is_lab else ""
                        sub_text = f"<b>{entry.subject.code}{lab_badge}</b>"

                        if view_type == 'section':
                            fac_last = entry.faculty.user.last_name or entry.faculty.user.username
                            detail_text = f"{entry.room.code} | {fac_last}"
                        elif view_type == 'faculty':
                            detail_text = f"{entry.section.name} | {entry.room.code}"
                        else:  # room
                            fac_last = entry.faculty.user.last_name or entry.faculty.user.username
                            detail_text = f"{entry.section.name} | {fac_last}"

                        cell_content = [
                            Paragraph(sub_text, cell_subject_style),
                            Paragraph(detail_text, cell_meta_style)
                        ]
                        row.append(cell_content)
                    else:
                        row.append(Paragraph("—", cell_meta_style))

            table_data.append(row)

        # 5. Styling the Grid
        num_cols = len(header_row)
        # Printable page width: landscape A4 is 841.89 points wide; margins: 24*2 = 48; usable width ~ 793
        col_width_day = 65
        col_width_period = (793 - col_width_day) / (num_cols - 1) if num_cols > 1 else 100
        col_widths = [col_width_day] + [col_width_period] * (num_cols - 1)

        t_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('BOX', (0, 0), (-1, -1), 1.2, colors.HexColor('#475569')),
            ('BACKGROUND', (0, 1), (0, -1), colors.HexColor('#f8fafc')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]

        # Highlight break columns
        for col_idx, p_num in enumerate(unique_p_nums, start=1):
            ex_slot = next((s for s in slots if s.period_number == p_num), None)
            if ex_slot and ex_slot.is_break:
                t_style.append(('BACKGROUND', (col_idx, 1), (col_idx, -1), colors.HexColor('#f8fafc')))

        grid_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        grid_table.setStyle(TableStyle(t_style))
        elements.append(grid_table)

        # 6. Legend and Subject Overview Table
        elements.append(Spacer(1, 8))
        subjects_used = sorted(list(set(e.subject for e in entries)), key=lambda s: s.code)
        if subjects_used:
            legend_title = Paragraph("<b>CURRICULUM SUBJECT LEGEND & INSTRUCTORS</b>", cell_header_style)
            elements.append(legend_title)
            elements.append(Spacer(1, 2))

            legend_data = [[
                Paragraph("<b>Code</b>", cell_header_style),
                Paragraph("<b>Subject Name</b>", cell_header_style),
                Paragraph("<b>Type</b>", cell_header_style),
                Paragraph("<b>Weekly Periods</b>", cell_header_style)
            ]]
            for s in subjects_used[:8]:  # Limit to 8 to avoid page overflow
                legend_data.append([
                    Paragraph(s.code, cell_subject_style),
                    Paragraph(s.name, cell_meta_style),
                    Paragraph(s.get_subject_type_display(), cell_meta_style),
                    Paragraph(str(s.weekly_periods), cell_meta_style)
                ])

            legend_table = Table(
                legend_data,
                colWidths=[80, 450, 100, 100]
            )
            legend_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))
            elements.append(legend_table)

        # Build document
        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
