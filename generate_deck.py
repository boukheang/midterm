import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_deck(filename="Smart_Campus_Access_Control_Presentation.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette - Modern Enterprise Slate
    C_BG = RGBColor(15, 23, 42)          # Slate 900
    C_SURFACE = RGBColor(30, 41, 59)     # Slate 800
    C_CARD = RGBColor(30, 41, 59)        # Slate 800
    C_BORDER = RGBColor(51, 65, 85)      # Slate 700
    C_TEXT_PRIMARY = RGBColor(248, 250, 252)  # Slate 50
    C_TEXT_MUTED = RGBColor(148, 163, 184)    # Slate 400
    C_ACCENT_BLUE = RGBColor(37, 99, 235)     # Royal Blue
    C_ACCENT_CYAN = RGBColor(56, 189, 248)    # Sky Cyan
    C_STATUS_GREEN = RGBColor(16, 185, 129)   # Emerald Green
    C_STATUS_RED = RGBColor(239, 68, 68)      # Crimson Red
    C_STATUS_AMBER = RGBColor(245, 158, 11)   # Amber

    FONT_MAIN = "Arial"
    FONT_MONO = "Consolas"

    def set_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = C_BG
        bg.line.fill.background()
        return bg

    def add_header(slide, tag_text, title_text, subtitle_text=""):
        # Top Category Tag
        tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.35))
        tf_tag = tag_box.text_frame
        tf_tag.word_wrap = True
        tf_tag.margin_left = tf_tag.margin_top = tf_tag.margin_right = tf_tag.margin_bottom = 0
        p_tag = tf_tag.paragraphs[0]
        p_tag.text = tag_text.upper()
        p_tag.font.name = FONT_MAIN
        p_tag.font.size = Pt(10)
        p_tag.font.bold = True
        p_tag.font.color.rgb = C_ACCENT_CYAN

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(11.7), Inches(0.55))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = tf_t.margin_top = tf_t.margin_right = tf_t.margin_bottom = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text
        p_t.font.name = FONT_MAIN
        p_t.font.size = Pt(22)
        p_t.font.bold = True
        p_t.font.color.rgb = C_TEXT_PRIMARY

        # Subtitle
        if subtitle_text:
            sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.42), Inches(11.7), Inches(0.35))
            tf_s = sub_box.text_frame
            tf_s.word_wrap = True
            tf_s.margin_left = tf_s.margin_top = tf_s.margin_right = tf_s.margin_bottom = 0
            p_s = tf_s.paragraphs[0]
            p_s.text = subtitle_text
            p_s.font.name = FONT_MAIN
            p_s.font.size = Pt(12)
            p_s.font.color.rgb = C_TEXT_MUTED

    def add_card(slide, left, top, width, height, title="", border_color=C_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = C_CARD
        card.line.color.rgb = border_color
        card.line.width = Pt(1)

        if title:
            tb = slide.shapes.add_textbox(Inches(left + 0.25), Inches(top + 0.2), Inches(width - 0.5), Inches(0.35))
            tf = tb.text_frame
            tf.word_wrap = True
            tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
            p = tf.paragraphs[0]
            p.text = title
            p.font.name = FONT_MAIN
            p.font.size = Pt(13)
            p.font.bold = True
            p.font.color.rgb = C_TEXT_PRIMARY
        return card

    # ==========================================
    # SLIDE 1: TITLE SLIDE
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)
    set_bg(s1)

    # Accent decorative bar
    bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.8), Inches(0.12), Inches(3.6))
    bar.fill.solid()
    bar.fill.fore_color.rgb = C_ACCENT_BLUE
    bar.line.fill.background()

    # Title box
    tbox = s1.shapes.add_textbox(Inches(1.2), Inches(1.6), Inches(11.0), Inches(2.2))
    tf1 = tbox.text_frame
    tf1.word_wrap = True
    p1 = tf1.paragraphs[0]
    p1.text = "SMART CAMPUS ACCESS CONTROL"
    p1.font.name = FONT_MAIN
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = C_TEXT_PRIMARY

    p2 = tf1.add_paragraph()
    p2.text = "Distributed Microservices, Round-Robin Load Balancing & Cloud Security"
    p2.font.name = FONT_MAIN
    p2.font.size = Pt(18)
    p2.font.color.rgb = C_ACCENT_CYAN
    p2.space_before = Pt(8)

    # Project metadata card
    card1 = add_card(s1, 1.2, 4.3, 10.8, 2.0, "PROJECT ARCHITECTURE OVERVIEW")
    meta_tb = s1.shapes.add_textbox(Inches(1.5), Inches(4.8), Inches(10.2), Inches(1.3))
    tf_m = meta_tb.text_frame
    tf_m.word_wrap = True
    
    pm1 = tf_m.paragraphs[0]
    pm1.text = "Topology: 9 Dockerized Containers  |  Load Balancer: Gateway Round-Robin (50/50)  |  Database: MongoDB Atlas Replica Set"
    pm1.font.name = FONT_MAIN
    pm1.font.size = Pt(12)
    pm1.font.color.rgb = C_TEXT_PRIMARY

    pm2 = tf_m.add_paragraph()
    pm2.text = "Security: Stateless JWT Bearer Tokens & Role-Based Access Control (Admin / Faculty / Student)"
    pm2.font.name = FONT_MAIN
    pm2.font.size = Pt(12)
    pm2.font.color.rgb = C_TEXT_MUTED
    pm2.space_before = Pt(6)

    pm3 = tf_m.add_paragraph()
    pm3.text = "Repository: github.com/boukheang/midterm  |  Test Coverage: 18/18 Automated Verification Checks (100%)"
    pm3.font.name = FONT_MAIN
    pm3.font.size = Pt(12)
    pm3.font.color.rgb = C_STATUS_GREEN
    pm3.space_before = Pt(6)

    # ==========================================
    # SLIDE 2: SYSTEM ARCHITECTURE OVERVIEW
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    set_bg(s2)
    add_header(s2, "Architecture & Design", "High-Level Distributed System Topology", 
               "Microservices decoupled via API Gateway reverse-proxy and synchronized with MongoDB Atlas.")

    # 3 Column Cards
    # Col 1: API Gateway
    add_card(s2, 0.8, 1.9, 3.6, 4.8, "1. INGRESS & GATEWAY")
    tb = s2.shapes.add_textbox(Inches(1.05), Inches(2.45), Inches(3.1), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0
    bullets1 = [
        "Port 4000: Single Public Ingress",
        "Reverse proxy routing for all 6 microservices",
        "Stateless JWT Verification Middleware",
        "Round-Robin Load Balancer Dispatcher",
        "Dedicated Web Console & Session Management",
        "CORS & Unified Error Formatting"
    ]
    for i, b in enumerate(bullets1):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = "- " + b
        p.font.name = FONT_MAIN
        p.font.size = Pt(11.5)
        p.font.color.rgb = C_TEXT_MUTED
        if i > 0: p.space_before = Pt(8)

    # Col 2: Core Microservices
    add_card(s2, 4.8, 1.9, 4.2, 4.8, "2. CORE MICROSERVICES TIER")
    tb = s2.shapes.add_textbox(Inches(5.05), Inches(2.45), Inches(3.7), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0
    bullets2 = [
        "Registration Service (5001): User profile issuance & Campus Card ID generation",
        "Authentication Service (5002): Password hash verification & JWT signing",
        "Room Service (5003): Room registry, electronic deadbolt lock control",
        "Permission Service (5004): RBAC engine for physical clearance verification",
        "Emergency Service (5006): Instant lockdown propagation across all facilities"
    ]
    for i, b in enumerate(bullets2):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = "- " + b
        p.font.name = FONT_MAIN
        p.font.size = Pt(11.5)
        p.font.color.rgb = C_TEXT_MUTED
        if i > 0: p.space_before = Pt(8)

    # Col 3: High Throughput & Persistence
    add_card(s2, 9.4, 1.9, 3.1, 4.8, "3. LOGGING & DATABASE")
    tb = s2.shapes.add_textbox(Inches(9.65), Inches(2.45), Inches(2.6), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0
    bullets3 = [
        "AccessLog-Instance-1 (5005): Primary log ingest worker",
        "AccessLog-Instance-2 (5015): Replicated log ingest worker",
        "Zero single-point-of-failure for badge logging",
        "MongoDB Atlas (clusterdb): Cloud replica set with SSL/TLS encryption",
        "Fully unified database state across UI and Postman"
    ]
    for i, b in enumerate(bullets3):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = "- " + b
        p.font.name = FONT_MAIN
        p.font.size = Pt(11.5)
        p.font.color.rgb = C_TEXT_MUTED
        if i > 0: p.space_before = Pt(8)

    # ==========================================
    # SLIDE 3: SERVICE MAP & PORT TOPOLOGY
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    set_bg(s3)
    add_header(s3, "Service Matrix", "Microservices Container & Port Topology",
               "Clear separation of concerns with Docker containerization and network isolation.")

    # Table of services
    rows, cols = 8, 4
    left, top, width, height = Inches(0.8), Inches(1.9), Inches(11.73), Inches(4.8)
    table_shape = s3.shapes.add_table(rows, cols, left, top, width, height)
    tbl = table_shape.table

    # Column widths
    tbl.columns[0].width = Inches(2.8)
    tbl.columns[1].width = Inches(1.4)
    tbl.columns[2].width = Inches(4.5)
    tbl.columns[3].width = Inches(3.03)

    headers = ["Service Name", "Port", "Core Responsibilities", "Data Store / Integration"]
    for j, h in enumerate(headers):
        cell = tbl.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(40, 53, 76)
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.name = FONT_MAIN
        p.font.size = Pt(11.5)
        p.font.bold = True
        p.font.color.rgb = C_ACCENT_CYAN

    services_data = [
        ("API Gateway", "4000", "Reverse proxy, Load Balancer, Auth Gate, Web Console", "In-memory Round-Robin State"),
        ("Registration Service", "5001", "User registration, Campus Card ID generation", "MongoDB Atlas (clusterdb.users)"),
        ("Authentication Service", "5002", "Credential validation, JWT token signing", "MongoDB Atlas (clusterdb.users)"),
        ("Room Service", "5003", "Facility inventory, lock/unlock toggle", "MongoDB Atlas (clusterdb.rooms)"),
        ("Permission Service", "5004", "Clearance checks (Student / Faculty / Admin)", "MongoDB Atlas (clusterdb.permissions)"),
        ("AccessLog-Instance-1", "5005", "High-throughput badge swipe logging (Worker 1)", "MongoDB Atlas (clusterdb.accesslogs)"),
        ("AccessLog-Instance-2", "5015", "High-throughput badge swipe logging (Worker 2)", "MongoDB Atlas (clusterdb.accesslogs)")
    ]

    for i, row in enumerate(services_data):
        for j, val in enumerate(row):
            cell = tbl.cell(i + 1, j)
            cell.fill.solid()
            cell.fill.fore_color.rgb = C_SURFACE if i % 2 == 0 else RGBColor(24, 33, 49)
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.name = FONT_MAIN
            p.font.size = Pt(10.5)
            p.font.color.rgb = C_TEXT_PRIMARY if j == 0 else C_TEXT_MUTED

    # ==========================================
    # SLIDE 4: LOAD BALANCER & REPLICA LOGGING
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    set_bg(s4)
    add_header(s4, "Load Balancing", "Round-Robin Traffic Distribution",
               "Zero-downtime badge swipe scaling between replicated AccessLog microservices.")

    # Card 1: Algorithm & Mechanism
    add_card(s4, 0.8, 1.9, 5.6, 4.8, "ROUND-ROBIN DISPATCH MECHANISM")
    tb = s4.shapes.add_textbox(Inches(1.05), Inches(2.45), Inches(5.1), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0
    p = tf.paragraphs[0]
    p.text = "How the API Gateway Distributes Requests:"
    p.font.name = FONT_MAIN
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_TEXT_PRIMARY

    bullets = [
        "Round-Robin Rotation: Request 1 -> Instance 1 (Port 5005), Request 2 -> Instance 2 (Port 5015), Request 3 -> Instance 1...",
        "Guaranteed 50% / 50% load distribution across workers.",
        "Response Header Verification:",
        "  - X-Load-Balanced-By: API-Gateway-RoundRobin",
        "  - X-Served-By-Instance: AccessLog-Instance-1 | AccessLog-Instance-2",
        "Automatic Failover: If one instance fails, gateway health-checks reroute traffic to the surviving replica."
    ]
    for b in bullets:
        p = tf.add_paragraph()
        p.text = b
        p.font.name = FONT_MAIN
        p.font.size = Pt(11)
        p.font.color.rgb = C_TEXT_MUTED
        p.space_before = Pt(6)

    # Card 2: Live Metrics & Inspection Proof
    add_card(s4, 6.8, 1.9, 5.7, 4.8, "AUTOMATED INSPECTION & TEST EVIDENCE")
    tb2 = s4.shapes.add_textbox(Inches(7.05), Inches(2.45), Inches(5.2), Inches(4.0))
    tf2 = tb2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_top = 0

    p = tf2.paragraphs[0]
    p.text = "Automated Test Suite Output (test.md Suite 5):"
    p.font.name = FONT_MAIN
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_STATUS_GREEN

    code_lines = [
        "[PASS] 5.1 Swipe 1 Status Code is 200",
        "       Header X-Load-Balanced-By: API-Gateway-RoundRobin",
        "       Request 1 routed to: AccessLog-Instance-1",
        "",
        "[PASS] 5.2 Swipe 2 Status Code is 200",
        "       Request 2 routed to: AccessLog-Instance-2",
        "",
        "[PASS] 5.3 Round-Robin Alternation Verified",
        "       AccessLog-Instance-1 -> AccessLog-Instance-2"
    ]
    for cl in code_lines:
        p = tf2.add_paragraph()
        p.text = cl
        p.font.name = FONT_MONO
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_PRIMARY if "[PASS]" in cl else C_TEXT_MUTED
        p.space_before = Pt(2)

    # ==========================================
    # SLIDE 5: SECURITY & RBAC ENFORCEMENT
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    set_bg(s5)
    add_header(s5, "Security & Auth", "Role-Based Access Control (RBAC) & Negative Tests",
               "Stateless JWT bearer authorization protecting facility endpoints and enforcing strict clearance policies.")

    # Card 1: Clearance Matrix
    add_card(s5, 0.8, 1.9, 5.6, 4.8, "ROLE CLEARANCE MATRIX")
    tb = s5.shapes.add_textbox(Inches(1.05), Inches(2.45), Inches(5.1), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0

    roles = [
        ("STUDENT ROLE", [
            "Allowed: Badge swipe on standard classrooms (e.g. ENG-301)",
            "Restricted: Cannot create rooms (403 Forbidden)",
            "Restricted: Cannot toggle locks; room list is Read-Only",
            "Restricted: Cannot trigger emergency lockdowns"
        ]),
        ("FACULTY ROLE", [
            "Allowed: Badge swipe on labs and classrooms",
            "Restricted: Cannot create rooms or trigger lockdowns"
        ]),
        ("ADMIN ROLE", [
            "Full Clearance: Create rooms, toggle locks, trigger lockdowns",
            "Access to automated verification testing suite"
        ])
    ]
    first = True
    for role_name, perms in roles:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.text = role_name
        p.font.name = FONT_MAIN
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = C_ACCENT_CYAN
        if not first: p.space_before = Pt(6)

        for perm in perms:
            p2 = tf.add_paragraph()
            p2.text = "  - " + perm
            p2.font.name = FONT_MAIN
            p2.font.size = Pt(10)
            p2.font.color.rgb = C_TEXT_MUTED
            p2.space_before = Pt(2)

    # Card 2: Negative Security Cases (Required by Midterm Assignment)
    add_card(s5, 6.8, 1.9, 5.7, 4.8, "NEGATIVE TEST ENFORCEMENT (ASSIGNMENT SPECS)")
    tb2 = s5.shapes.add_textbox(Inches(7.05), Inches(2.45), Inches(5.2), Inches(4.0))
    tf2 = tb2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_top = 0

    neg_cases = [
        ("4.1 Wrong Password", "POST /login with bad credentials returns 401 Unauthorized."),
        ("4.2 Missing Token", "GET /api/rooms with no Authorization header returns 401 Unauthorized."),
        ("4.3 Invalid / Forged Token", "GET /api/rooms with Bearer fake123 returns 403 Forbidden."),
        ("4.4 RBAC Restriction", "POST /api/rooms with Student token returns 403: Role 'student' is unauthorized. Required: [admin].")
    ]
    for i, (title, desc) in enumerate(neg_cases):
        p = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
        p.text = "[PASS] " + title
        p.font.name = FONT_MAIN
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = C_STATUS_GREEN
        if i > 0: p.space_before = Pt(8)

        p_desc = tf2.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_MAIN
        p_desc.font.size = Pt(10)
        p_desc.font.color.rgb = C_TEXT_MUTED
        p_desc.space_before = Pt(2)

    # ==========================================
    # SLIDE 6: CLOUD DATABASE MIGRATION
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    set_bg(s6)
    add_header(s6, "Cloud Data Tier", "MongoDB Atlas Multi-Shard Cluster Integration",
               "Transitioned from local container storage to enterprise cloud database replica set.")

    add_card(s6, 0.8, 1.9, 5.6, 4.8, "DATABASE TOPOLOGY & CONFIGURATION")
    tb = s6.shapes.add_textbox(Inches(1.05), Inches(2.45), Inches(5.1), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0

    db_points = [
        "Target Cluster: MongoDB Atlas 3-Shard Replica Set",
        "Database: clusterdb",
        "Connection Security: SSL/TLS with admin authentication source",
        "Unified Configuration: Injected via root .env, all 6 microservice .env files, and docker-compose.yml",
        "Shared Collections:",
        "  - clusterdb.users (credentials, hashed passwords, roles)",
        "  - clusterdb.rooms (room specs, physical lock states)",
        "  - clusterdb.accesslogs (audit log with node timestamps)"
    ]
    for i, pt in enumerate(db_points):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = "- " + pt
        p.font.name = FONT_MAIN
        p.font.size = Pt(11)
        p.font.color.rgb = C_TEXT_PRIMARY if "Target" in pt or "Shared" in pt else C_TEXT_MUTED
        if i > 0: p.space_before = Pt(6)

    add_card(s6, 6.8, 1.9, 5.7, 4.8, "REAL-TIME CROSS-PLATFORM SYNCHRONIZATION")
    tb2 = s6.shapes.add_textbox(Inches(7.05), Inches(2.45), Inches(5.2), Inches(4.0))
    tf2 = tb2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_top = 0

    sync_points = [
        ("Unified Persistent State", "Any user registered in Postman is immediately recognized by the Web Console and vice versa."),
        ("Live Facility Locks", "Engaging a deadbolt in Postman instantly flips the status badge to LOCKED in the web management UI."),
        ("Audit Compliance", "Every swipe action from any interface persists with timestamp, solenoid state, and serving instance name."),
        ("Cloud Ready Deployment", "Seamlessly deployable to AWS EC2 or Docker Swarm without data loss.")
    ]
    for i, (title, desc) in enumerate(sync_points):
        p = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
        p.text = title
        p.font.name = FONT_MAIN
        p.font.size = Pt(11.5)
        p.font.bold = True
        p.font.color.rgb = C_ACCENT_CYAN
        if i > 0: p.space_before = Pt(8)

        p_desc = tf2.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_MAIN
        p_desc.font.size = Pt(10.5)
        p_desc.font.color.rgb = C_TEXT_MUTED
        p_desc.space_before = Pt(2)

    # ==========================================
    # SLIDE 7: EMERGENCY ALERT & LOCKDOWN
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    set_bg(s7)
    add_header(s7, "Incident Protocol", "Campus-Wide Emergency Lockdown System",
               "Orchestrated incident response enforcing campus-wide electronic deadbolts in milliseconds.")

    add_card(s7, 0.8, 1.9, 5.6, 4.8, "LOCKDOWN WORKFLOW & TIMELINE")
    tb = s7.shapes.add_textbox(Inches(1.05), Inches(2.45), Inches(5.1), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0

    steps = [
        ("1. Incident Triggered", "Administrator triggers lockdown via Web Console or POST /api/emergency/lockdown."),
        ("2. Emergency Broadcast", "Emergency Service notifies Room Service to engage isEmergencyLocked across all rooms."),
        ("3. Door Solenoid Deadbolt", "All electronic doors deadbolt immediately; normal badge clearances are revoked."),
        ("4. Rejection Policy", "Any subsequent swipe attempt returns ACCESS DENIED (CAMPUS_EMERGENCY_LOCKDOWN)."),
        ("5. Lockdown Lifted", "Admin issues POST /api/emergency/lift to safely restore standard permission rules.")
    ]
    for i, (title, desc) in enumerate(steps):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = title
        p.font.name = FONT_MAIN
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = C_STATUS_RED if "1." in title or "3." in title else C_TEXT_PRIMARY
        if i > 0: p.space_before = Pt(6)

        p_desc = tf.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_MAIN
        p_desc.font.size = Pt(10)
        p_desc.font.color.rgb = C_TEXT_MUTED
        p_desc.space_before = Pt(2)

    add_card(s7, 6.8, 1.9, 5.7, 4.8, "SECURITY GUARANTEES & RBAC SHIELD")
    tb2 = s7.shapes.add_textbox(Inches(7.05), Inches(2.45), Inches(5.2), Inches(4.0))
    tf2 = tb2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_top = 0

    guarantees = [
        ("Student & Faculty Shield", "Students and faculty are strictly prevented from initiating or cancelling lockdowns. UI displays 'Admin Clearance Required'."),
        ("Tamper-Proof Audit Logging", "Every attempt to badge in during an emergency is logged to MongoDB Atlas with an emergency alert flag."),
        ("High-Availability Dispatch", "The emergency broadcast operates asynchronously, preventing gateway bottleneck.")
    ]
    for i, (title, desc) in enumerate(guarantees):
        p = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
        p.text = title
        p.font.name = FONT_MAIN
        p.font.size = Pt(11.5)
        p.font.bold = True
        p.font.color.rgb = C_ACCENT_CYAN
        if i > 0: p.space_before = Pt(10)

        p_desc = tf2.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_MAIN
        p_desc.font.size = Pt(10.5)
        p_desc.font.color.rgb = C_TEXT_MUTED
        p_desc.space_before = Pt(3)

    # ==========================================
    # SLIDE 8: WEB CONSOLE DEMO & UX DESIGN
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    set_bg(s8)
    add_header(s8, "Demonstration UI", "Interactive Web Console & User Experience",
               "Live operator dashboard at http://localhost:4000/ with dedicated auth portal and role-restricted views.")

    add_card(s8, 0.8, 1.9, 5.6, 4.8, "AUTHENTICATION-FIRST GATEWAY UX")
    tb = s8.shapes.add_textbox(Inches(1.05), Inches(2.45), Inches(5.1), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0

    features = [
        ("Login Screen First", "Unauthenticated visitors cannot access the dashboard until valid credentials are provided."),
        ("Separated Registration Screen", "Clean toggle between Sign In and Register New Identity cards; no cluttered side-by-side forms."),
        ("Quick Demo Accounts", "One-click Demo Admin, Faculty, and Student buttons for instantaneous grading verification."),
        ("Clean Session Isolation", "In-session role switcher buttons removed. Users must authentically sign out to switch roles.")
    ]
    for i, (title, desc) in enumerate(features):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = title
        p.font.name = FONT_MAIN
        p.font.size = Pt(11.5)
        p.font.bold = True
        p.font.color.rgb = C_ACCENT_CYAN
        if i > 0: p.space_before = Pt(8)

        p_desc = tf.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_MAIN
        p_desc.font.size = Pt(10.5)
        p_desc.font.color.rgb = C_TEXT_MUTED
        p_desc.space_before = Pt(2)

    add_card(s8, 6.8, 1.9, 5.7, 4.8, "LIVE SIMULATION COMPONENTS")
    tb2 = s8.shapes.add_textbox(Inches(7.05), Inches(2.45), Inches(5.2), Inches(4.0))
    tf2 = tb2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_top = 0

    components = [
        ("Load Balancer Traffic Monitor", "Displays real-time request counts and percentage share between Instance 1 and Instance 2 with live pulse animation."),
        ("Physical Solenoid Status Indicator", "Visual feedback box showing SOLENOID RELEASED (Green) or DOOR DEADBOLTED (Red) on every badge swipe."),
        ("Campus Room Management", "Interactive room table with live Lock/Unlock controls for Admin and 'Read Only' policies for Students."),
        ("Automated Verification Runner", "Embedded terminal running test.md verification suite live with pass/fail metrics.")
    ]
    for i, (title, desc) in enumerate(components):
        p = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
        p.text = title
        p.font.name = FONT_MAIN
        p.font.size = Pt(11.5)
        p.font.bold = True
        p.font.color.rgb = C_TEXT_PRIMARY
        if i > 0: p.space_before = Pt(8)

        p_desc = tf2.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_MAIN
        p_desc.font.size = Pt(10.5)
        p_desc.font.color.rgb = C_TEXT_MUTED
        p_desc.space_before = Pt(2)

    # ==========================================
    # SLIDE 9: POSTMAN TESTING & AUTOMATED SUITE
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    set_bg(s9)
    add_header(s9, "Verification & QA", "Postman Suite & 100% Automated Test Pass",
               "Turnkey Postman collection with automated JWT token capture and complete test.md compliance.")

    add_card(s9, 0.8, 1.9, 5.6, 4.8, "POSTMAN COLLECTION V2.1.0 (READY TO IMPORT)")
    tb = s9.shapes.add_textbox(Inches(1.05), Inches(2.45), Inches(5.1), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0

    postman_info = [
        ("Files Included in Repository:", "postman_collection.json and postman_environment.json"),
        ("Automated Token Capture:", "Login requests automatically extract data.token and store in {{adminToken}} or {{studentToken}}."),
        ("Zero Manual Copy-Pasting:", "Subsequent requests automatically inherit authorization tokens."),
        ("Organized Test Folders:", "1. Authentication & Registration\n2. Room Management\n3. Negative Test Cases (401 & 403)\n4. Door Swipe & Round-Robin\n5. Emergency Alert & Lockdown")
    ]
    for i, (title, desc) in enumerate(postman_info):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = title
        p.font.name = FONT_MAIN
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = C_ACCENT_CYAN
        if i > 0: p.space_before = Pt(8)

        p_desc = tf.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_MAIN
        p_desc.font.size = Pt(10)
        p_desc.font.color.rgb = C_TEXT_MUTED
        p_desc.space_before = Pt(2)

    add_card(s9, 6.8, 1.9, 5.7, 4.8, "AUTOMATED VERIFICATION RESULTS")
    tb2 = s9.shapes.add_textbox(Inches(7.05), Inches(2.45), Inches(5.2), Inches(4.0))
    tf2 = tb2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_top = 0

    p = tf2.paragraphs[0]
    p.text = "18 / 18 CHECKS PASSED (100% COMPLIANCE)"
    p.font.name = FONT_MAIN
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_STATUS_GREEN

    test_summary = [
        "Suite 1: Registration Status 201 & User ID Generation",
        "Suite 2: Login Status 200 & JWT Token Signature",
        "Suite 3: Room Creation (201) & Persistent Storage",
        "Suite 4.1: Wrong Password -> 401 Unauthorized",
        "Suite 4.2: Missing Token -> 401 Unauthorized",
        "Suite 4.3: Invalid Token -> 403 Forbidden",
        "Suite 4.4: Student Role Denied Room Creation -> 403 Forbidden",
        "Suite 5.1 & 5.2: Door Swipe Requests 1 & 2 (200 OK)",
        "Suite 5.3: Round-Robin Alternation (Instance-1 -> Instance-2)"
    ]
    for ts in test_summary:
        p = tf2.add_paragraph()
        p.text = "  [PASS] " + ts
        p.font.name = FONT_MONO
        p.font.size = Pt(9.5)
        p.font.color.rgb = C_TEXT_MUTED
        p.space_before = Pt(3)

    # ==========================================
    # SLIDE 10: CONCLUSION & DEMO READINESS
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    set_bg(s10)
    add_header(s10, "Summary & Demo", "Conclusion & Engineering Highlights",
               "Production-ready distributed architecture meeting all midterm project requirements.")

    add_card(s10, 0.8, 1.9, 5.6, 4.8, "KEY ARCHITECTURAL ACHIEVEMENTS")
    tb = s10.shapes.add_textbox(Inches(1.05), Inches(2.45), Inches(5.1), Inches(4.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0

    achievements = [
        ("Resilient Containerization", "9 independent Docker containers connected on an isolated campus network."),
        ("Stateless Scalability", "Round-Robin load balancer distributes log ingestion without sticky session bottlenecks."),
        ("Enterprise RBAC", "Clear multi-tiered security separating administrative power from student users."),
        ("Cloud Multi-Shard Persistence", "Robust data tier on MongoDB Atlas ensuring persistence beyond local container lifecycles."),
        ("Complete Testability", "100% test pass rate in automated suites and importable Postman collections.")
    ]
    for i, (title, desc) in enumerate(achievements):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = title
        p.font.name = FONT_MAIN
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = C_ACCENT_CYAN
        if i > 0: p.space_before = Pt(8)

        p_desc = tf.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_MAIN
        p_desc.font.size = Pt(10)
        p_desc.font.color.rgb = C_TEXT_MUTED
        p_desc.space_before = Pt(2)

    add_card(s10, 6.8, 1.9, 5.7, 4.8, "LIVE DEMONSTRATION CHECKLIST")
    tb2 = s10.shapes.add_textbox(Inches(7.05), Inches(2.45), Inches(5.2), Inches(4.0))
    tf2 = tb2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_top = 0

    p = tf2.paragraphs[0]
    p.text = "READY FOR PRESENTATION & EVALUATION:"
    p.font.name = FONT_MAIN
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_STATUS_GREEN

    demo_steps = [
        "1. Open http://localhost:4000/ -> Show clean Sign In gate.",
        "2. Sign in as Student -> Show that Create Room & Lockdown buttons are hidden.",
        "3. Sign out -> Sign in as Admin -> Full administrative controls appear.",
        "4. Click 'Swipe Badge' 4 times -> Show 50/50 round-robin alternation between Instance 1 and Instance 2.",
        "5. Lock room ENG-146 -> Swipe again -> Solenoid flashes red (DOOR DEADBOLTED).",
        "6. Trigger Emergency Lockdown -> Show all rooms locked instantly.",
        "7. Click 'Run test.md Verification' -> 18/18 tests pass live on screen.",
        "8. Open Postman -> Send collection requests to prove cloud synchronization."
    ]
    for ds in demo_steps:
        p = tf2.add_paragraph()
        p.text = ds
        p.font.name = FONT_MAIN
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_PRIMARY
        p.space_before = Pt(4)

    prs.save(filename)
    print(f"Presentation saved successfully to: {os.path.abspath(filename)}")

if __name__ == "__main__":
    out_file = "Smart_Campus_Access_Control_Presentation.pptx"
    if len(sys.argv) > 1:
        out_file = sys.argv[1]
    create_deck(out_file)
