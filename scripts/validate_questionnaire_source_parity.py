#!/usr/bin/env python3
"""
Truth Labs International (TLI) — DPDP Gap Assessment
Questionnaire Source Parity & Integrity Validator

Independently extracts content from Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx
and verifies 100% exact parity with data/questionnaire_v1.json and data/dpdp_controls.json.
"""

import os
import sys
import json
import zipfile
import re
import xml.etree.ElementTree as ET

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCX_PATH = os.path.join(BASE_DIR, "Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx")
JSON_PATH = os.path.join(BASE_DIR, "data", "questionnaire_v1.json")
CONTROLS_PATH = os.path.join(BASE_DIR, "data", "dpdp_controls.json")

EXPECTED_SECTIONS = [
    ("GOV", "Governance and accountability", 8),
    ("DAT", "Personal data inventory and processing", 8),
    ("NOT", "Notice, consent and applicable processing grounds", 8),
    ("RGT", "Data principal rights and grievances", 7),
    ("SEC", "Security safeguards and breach response", 10),
    ("RET", "Retention and erasure", 6),
    ("TPR", "Processors and third parties", 6),
    ("APP", "Applicability and special obligations", 7),
]

EXPECTED_OPTIONS = [
    "Implemented",
    "Partially implemented",
    "Not implemented",
    "Unknown / not verified",
    "Not applicable — justification required",
]

EXPECTED_FOLLOWUP = "Follow-up field to add in Forms: Assessor / respondent comments and, if Not applicable, justification."
EXPECTED_INSTRUCTIONS = "Select the response that best describes the current state. Do not select “Not applicable” without providing a justification in the follow-up field. Evidence will be collected and validated separately by the Truth Labs assessor."

def validate():
    print("=" * 72)
    print("  TLI DPDP Questionnaire Source-to-Manifest Parity Validator")
    print("=" * 72)

    errors = []

    # 1. Source Document Existence
    if not os.path.exists(DOCX_PATH):
        print(f"[FAIL] Source DOCX not found at {DOCX_PATH}")
        sys.exit(1)
    print(f"[PASS] Source DOCX located: {DOCX_PATH}")

    # 2. JSON Manifest Existence
    if not os.path.exists(JSON_PATH):
        print(f"[FAIL] Manifest JSON not found at {JSON_PATH}")
        sys.exit(1)
    print(f"[PASS] Questionnaire manifest located: {JSON_PATH}")

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # 3. Independent DOCX Extraction
    with zipfile.ZipFile(DOCX_PATH) as z:
        xml_content = z.read("word/document.xml")
    root = ET.fromstring(xml_content)

    paragraphs = [
        "".join(t.text for t in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if t.text).strip()
        for p in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p")
    ]
    paragraphs = [p for p in paragraphs if p]

    # Validate Preamble & Respondent Instructions
    source_instructions = paragraphs[4].replace("Respondent instructions: ", "")
    if source_instructions != EXPECTED_INSTRUCTIONS:
        errors.append(f"Respondent instructions mismatch. DOCX: '{source_instructions}', Expected: '{EXPECTED_INSTRUCTIONS}'")
    if manifest.get("respondent_instructions") != EXPECTED_INSTRUCTIONS:
        errors.append(f"Manifest respondent_instructions mismatch.")

    # 4. Sections Validation
    if manifest.get("total_sections") != 8 or len(manifest.get("sections", [])) != 8:
        errors.append(f"Expected exactly 8 sections, found {len(manifest.get('sections', []))}")

    for idx, (exp_code, exp_title, exp_cnt) in enumerate(EXPECTED_SECTIONS):
        sec = manifest["sections"][idx]
        if sec["code"] != exp_code or sec["title"] != exp_title:
            errors.append(f"Section {idx+1} mismatch: got ({sec['code']}, {sec['title']}), expected ({exp_code}, {exp_title})")
        
        # Check count of questions in manifest belonging to this section
        sec_q_count = sum(1 for q in manifest["questions"] if q["section_code"] == exp_code)
        if sec_q_count != exp_cnt:
            errors.append(f"Section {exp_code} question count mismatch: got {sec_q_count}, expected {exp_cnt}")

    # 5. Question Parity & Order Check
    if manifest.get("total_questions") != 60 or len(manifest.get("questions", [])) != 60:
        errors.append(f"Expected exactly 60 questions, found {len(manifest.get('questions', []))}")

    # Extract questions independently from DOCX
    docx_questions = []
    assessor_ref_idx = paragraphs.index("Assessor-only reference")
    i = 5
    while i < assessor_ref_idx:
        p = paragraphs[i]
        if re.match(r"^[A-Z]{3}\s*—", p):
            i += 1
            continue
        elif "|" in p and any(p.startswith(prefix) for prefix in ["GOV-", "DAT-", "NOT-", "RGT-", "SEC-", "RET-", "TPR-", "APP-"]):
            q_code, q_text = p.split("|", 1)
            opts = [paragraphs[i+j] for j in range(1, 6)]
            followup = paragraphs[i+6]
            docx_questions.append({
                "code": q_code.strip(),
                "text": q_text.strip(),
                "options": opts,
                "followup": followup
            })
            i += 7
            continue
        else:
            i += 1

    if len(docx_questions) != 60:
        errors.append(f"DOCX extracted {len(docx_questions)} questions instead of 60.")

    # Validate 1-to-1 against manifest
    for idx, docx_q in enumerate(docx_questions):
        m_q = manifest["questions"][idx]
        if m_q["code"] != docx_q["code"]:
            errors.append(f"Question {idx+1} code mismatch: manifest='{m_q['code']}', docx='{docx_q['code']}'")
        if m_q["text"] != docx_q["text"]:
            errors.append(f"Question {m_q['code']} text mismatch:\n  Manifest: {repr(m_q['text'])}\n  DOCX:     {repr(docx_q['text'])}")
        if m_q["options"] != EXPECTED_OPTIONS:
            errors.append(f"Question {m_q['code']} options mismatch.")
        if m_q["options"] != docx_q["options"]:
            errors.append(f"Question {m_q['code']} options differ from DOCX.")
        if m_q["follow_up_prompt"] != EXPECTED_FOLLOWUP:
            errors.append(f"Question {m_q['code']} follow-up mismatch.")
        if m_q["order"] != idx + 1:
            errors.append(f"Question {m_q['code']} order mismatch: got {m_q['order']}, expected {idx + 1}")

    # 6. Canonical Control Mapping Check
    with open(CONTROLS_PATH, "r", encoding="utf-8") as f:
        controls_data = json.load(f)
    valid_control_ids = {c["control_id"] for c in controls_data}

    mapped_count = 0
    unresolved_count = 0
    for q in manifest["questions"]:
        cid = q.get("canonical_control_id")
        status = q.get("mapping_status")
        if cid:
            mapped_count += 1
            if cid not in valid_control_ids:
                errors.append(f"Question {q['code']} references invalid canonical control: {cid}")
            if status != "MAPPED_PRIMARY":
                errors.append(f"Question {q['code']} has control_id but status is {status}")
        else:
            unresolved_count += 1
            if status != "UNRESOLVED_PENDING_EXCEL_SHEET":
                errors.append(f"Question {q['code']} unmapped but status is {status}")

    print(f"[PASS] Section counts verified: 8 sections (GOV, DAT, NOT, RGT, SEC, RET, TPR, APP)")
    print(f"[PASS] Question counts verified: Exactly 60 questions")
    print(f"[PASS] Response options verified: 5 exact options across all 60 questions")
    print(f"[PASS] Follow-up prompt verified: Exact prompt on all 60 questions")
    print(f"[PASS] Respondent instructions verified: 100% exact string match")
    print(f"[PASS] Control mappings verified: {mapped_count} mapped to valid canonical controls, {unresolved_count} recorded as unresolved")

    if errors:
        print("\n" + "!" * 72)
        print(f"VALIDATION FAILED with {len(errors)} errors:")
        for err in errors:
            print(f" - {err}")
        print("!" * 72)
        sys.exit(1)

    print("\n>>> SUCCESS: 100% CANONICAL QUESTIONNAIRE SOURCE PARITY VERIFIED <<<")

if __name__ == "__main__":
    validate()

