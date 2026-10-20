#!/usr/bin/env python3
"""
Truth Labs International (TLI) — DPDP Gap Assessment
Canonical Questionnaire Extractor & Validator

Extracts the authoritative 60-question questionnaire directly from:
./data/source/Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx

Outputs:
data/questionnaire_v1.json
"""

import os
import sys
import json
import zipfile
import re
import xml.etree.ElementTree as ET

DOCX_REL_PATH = os.path.join("data", "source", "Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCX_PATH = os.path.join(BASE_DIR, DOCX_REL_PATH)
OUTPUT_JSON = os.path.join(BASE_DIR, "data", "questionnaire_v1.json")

# Verified mappings to canonical 30 controls in data/dpdp_controls.json
# Strictly unmapped items are marked as UNRESOLVED_PENDING_EXCEL_SHEET.
CONTROL_MAPPINGS = {
    'GOV-001': {'control_id': 'TLI-DPDP-FID-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(1) Accountability & Non-Delegable Responsibility'},
    'GOV-002': {'control_id': 'TLI-DPDP-FID-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(1) Inter-departmental DPDP governance accountability'},
    'GOV-003': {'control_id': 'TLI-DPDP-SCO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 3 DPDP statutory applicability & obligations inventory'},
    'GOV-004': {'control_id': 'TLI-DPDP-FID-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(1) Approved organisational privacy policy'},
    'GOV-005': {'control_id': None, 'status': 'UNRESOLVED_PENDING_EXCEL_SHEET', 'notes': 'Privacy by design / pre-launch risk assessment awaiting Excel build sheet mapping'},
    'GOV-006': {'control_id': None, 'status': 'UNRESOLVED_PENDING_EXCEL_SHEET', 'notes': 'Regulatory horizon monitoring awaiting Excel build sheet mapping'},
    'GOV-007': {'control_id': 'TLI-DPDP-SEC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(4)-(5) Role-based privacy training as organisational safeguard'},
    'GOV-008': {'control_id': None, 'status': 'UNRESOLVED_PENDING_EXCEL_SHEET', 'notes': 'Privacy exception tracking workflow awaiting Excel build sheet mapping'},

    'DAT-001': {'control_id': 'TLI-DPDP-SCO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 3 Digital personal data perimeter and categorization'},
    'DAT-002': {'control_id': 'TLI-DPDP-LGL-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 4 Specified lawful processing purposes and business ownership'},
    'DAT-003': {'control_id': 'TLI-DPDP-FID-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(3) Data processing lifecycle and flow documentation'},
    'DAT-004': {'control_id': 'TLI-DPDP-SEC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(4) Systems and repository inventory for security safeguards'},
    'DAT-005': {'control_id': 'TLI-DPDP-FID-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(3) Provenance and source method recording'},
    'DAT-006': {'control_id': 'TLI-DPDP-PRO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(2) Routine disclosures, transfers and third-party access'},
    'DAT-007': {'control_id': 'TLI-DPDP-SEC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(4) Data classification and handling rules as TOMs'},
    'DAT-008': {'control_id': 'TLI-DPDP-FID-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(3) Inventory reconciliation against operational systems'},

    'NOT-001': {'control_id': 'TLI-DPDP-CON-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 6(1)-(3) Clear affirmative consent prior to processing'},
    'NOT-002': {'control_id': 'TLI-DPDP-NOT-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 5(1) Itemised and pre-consent notice requirements'},
    'NOT-003': {'control_id': 'TLI-DPDP-NOT-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 5(1) Notice of withdrawal, rights, and grievance officer'},
    'NOT-004': {'control_id': 'TLI-DPDP-LGL-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 4 Demonstration of consent vs legitimate uses rationale'},
    'NOT-005': {'control_id': 'TLI-DPDP-CON-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 6 Evidentiary audit trail for notice and consent timestamp'},
    'NOT-006': {'control_id': 'TLI-DPDP-CON-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 6(4)-(6) Ceasing processing upon consent withdrawal'},
    'NOT-007': {'control_id': 'TLI-DPDP-NOT-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 5 Notice updates upon material processing changes'},
    'NOT-008': {'control_id': 'TLI-DPDP-LGL-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 4 / 5 New purpose authorization and communication'},

    'RGT-001': {'control_id': 'TLI-DPDP-DSR-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 11 Right to access information about personal data'},
    'RGT-002': {'control_id': 'TLI-DPDP-DSR-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 12 Right to correction, completion and updating'},
    'RGT-003': {'control_id': 'TLI-DPDP-DSR-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 12 / 8(7) Right to erasure of personal data'},
    'RGT-004': {'control_id': 'TLI-DPDP-DSR-03', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 13 Grievance redressal mechanism and escalation'},
    'RGT-005': {'control_id': 'TLI-DPDP-DSR-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 11 / 12 Proportional authentication of requester'},
    'RGT-006': {'control_id': 'TLI-DPDP-DSR-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 11 Auditable tracking of principal requests'},
    'RGT-007': {'control_id': 'TLI-DPDP-DSR-04', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 14 Right of nomination of surrogate principal'},

    'SEC-001': {'control_id': 'TLI-DPDP-SEC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(4)-(5) Reasonable security safeguards (TOMs)'},
    'SEC-002': {'control_id': 'TLI-DPDP-SEC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(4) Role-based access control and least privilege'},
    'SEC-003': {'control_id': 'TLI-DPDP-SEC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(4) Multi-factor and privileged authentication controls'},
    'SEC-004': {'control_id': 'TLI-DPDP-SEC-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(5) Encryption in transit and at rest'},
    'SEC-005': {'control_id': 'TLI-DPDP-SEC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(4) Security logging and monitoring capabilities'},
    'SEC-006': {'control_id': 'TLI-DPDP-SEC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(4) Vulnerability management and patching'},
    'SEC-007': {'control_id': 'TLI-DPDP-SEC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(4) Backup protection and restoration testing'},
    'SEC-008': {'control_id': 'TLI-DPDP-BRC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(6) Incident response and triage workflow'},
    'SEC-009': {'control_id': 'TLI-DPDP-BRC-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(6) Breach impact assessment and principal identification'},
    'SEC-010': {'control_id': 'TLI-DPDP-BRC-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(6) Dual breach notification to DPBI and data principals'},

    'RET-001': {'control_id': 'TLI-DPDP-RET-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(7) Purpose completion and retention periods definition'},
    'RET-002': {'control_id': 'TLI-DPDP-RET-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(7) Purpose exhaustion evaluation process'},
    'RET-003': {'control_id': 'TLI-DPDP-RET-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(7) Secure automated or systematic erasure'},
    'RET-004': {'control_id': 'TLI-DPDP-RET-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(7) Backup and archive copies erasure handling'},
    'RET-005': {'control_id': 'TLI-DPDP-RET-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(7)-(8) Statutory retention exceptions and legal holds'},
    'RET-006': {'control_id': 'TLI-DPDP-RET-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(7) Testing and verification of retention controls'},

    'TPR-001': {'control_id': 'TLI-DPDP-PRO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(2) Identification of third-party processors'},
    'TPR-002': {'control_id': 'TLI-DPDP-PRO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(2) Mandatory processor contracts and terms'},
    'TPR-003': {'control_id': 'TLI-DPDP-PRO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(2) Pre-engagement vendor risk evaluation'},
    'TPR-004': {'control_id': 'TLI-DPDP-PRO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(2) Periodic third-party access review'},
    'TPR-005': {'control_id': 'TLI-DPDP-PRO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 8(2) Processor termination, return and deletion terms'},
    'TPR-006': {'control_id': 'TLI-DPDP-XBD-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 16 Cross-border transfers and negative list compliance'},

    'APP-001': {'control_id': 'TLI-DPDP-SCO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 3 Territorial scope and statutory exclusions'},
    'APP-002': {'control_id': 'TLI-DPDP-SCO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 17 Statutory exemptions evaluation'},
    'APP-003': {'control_id': 'TLI-DPDP-SDF-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 10 Significant Data Fiduciary classification'},
    'APP-004': {'control_id': 'TLI-DPDP-CHD-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 9 Children and persons with disabilities safeguards'},
    'APP-005': {'control_id': 'TLI-DPDP-XBD-02', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 16(2) Sectoral localization and privacy obligations'},
    'APP-006': {'control_id': None, 'status': 'UNRESOLVED_PENDING_EXCEL_SHEET', 'notes': 'Section 17(2)(b) Research, archiving and statistical exemptions awaiting Excel build sheet mapping'},
    'APP-007': {'control_id': 'TLI-DPDP-SCO-01', 'status': 'MAPPED_PRIMARY', 'notes': 'Section 3 Reassessment process for new products and markets'}
}

def extract_from_docx(path: str) -> dict:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Source DOCX not found at: {path}")

    with zipfile.ZipFile(path) as z:
        xml_content = z.read('word/document.xml')
    root = ET.fromstring(xml_content)

    paragraphs = [
        ''.join(t.text for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text).strip()
        for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p')
    ]
    paragraphs = [p for p in paragraphs if p]

    title = paragraphs[0]
    subtitle = paragraphs[1]
    draft_status = paragraphs[2].replace('Draft status: ', '')
    import_note = paragraphs[3].replace('Import note: ', '')
    respondent_instructions = paragraphs[4].replace('Respondent instructions: ', '')

    assessor_ref_idx = paragraphs.index('Assessor-only reference')
    assessor_note = paragraphs[assessor_ref_idx + 1]
    scoring_proposal = paragraphs[assessor_ref_idx + 2]

    sections = []
    questions = []
    current_sec = None

    i = 5
    q_global_order = 1
    while i < assessor_ref_idx:
        p = paragraphs[i]
        if re.match(r'^[A-Z]{3}\s*—', p):
            sec_code, sec_title = p.split('—', 1)
            current_sec = {
                'code': sec_code.strip(),
                'title': sec_title.strip(),
                'heading': p
            }
            sections.append(current_sec)
            i += 1
            continue
        elif '|' in p and any(p.startswith(prefix) for prefix in ['GOV-', 'DAT-', 'NOT-', 'RGT-', 'SEC-', 'RET-', 'TPR-', 'APP-']):
            q_code, q_text = p.split('|', 1)
            q_code = q_code.strip()
            opts = [paragraphs[i+j] for j in range(1, 6)]
            followup = paragraphs[i+6]

            mapping = CONTROL_MAPPINGS.get(q_code, {'control_id': None, 'status': 'UNRESOLVED_PENDING_EXCEL_SHEET', 'notes': 'Unmapped'})

            questions.append({
                'code': q_code,
                'order': q_global_order,
                'section_code': current_sec['code'],
                'section_title': current_sec['title'],
                'text': q_text.strip(),
                'options': opts,
                'follow_up_prompt': followup,
                'canonical_control_id': mapping['control_id'],
                'mapping_status': mapping['status'],
                'mapping_notes': mapping['notes']
            })
            q_global_order += 1
            i += 7
            continue
        else:
            i += 1

    return {
        'version': '1.0.0',
        'version_id': 'TLI-DPDP-MSFORMS-60Q-V1',
        'source_document': os.path.basename(path),
        'title': title,
        'subtitle': subtitle,
        'draft_status': draft_status,
        'import_note': import_note,
        'respondent_instructions': respondent_instructions,
        'assessor_only_reference': {
            'notice': assessor_note,
            'scoring_defaults_proposal': scoring_proposal,
            'proposed_score_values': {
                'Implemented': 100,
                'Partially implemented': 50,
                'Not implemented': 0,
                'Unknown / not verified': 'unscored pending review',
                'Not applicable — justification required': 'excluded only after written justification and assessor approval'
            }
        },
        'total_sections': len(sections),
        'total_questions': len(questions),
        'sections': sections,
        'questions': questions
    }

def main():
    print(f"[EXTRACTOR] Reading source document: {DOCX_PATH}")
    manifest = extract_from_docx(DOCX_PATH)
    print(f"[EXTRACTOR] Extracted {manifest['total_sections']} sections and {manifest['total_questions']} questions.")

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"[EXTRACTOR] Manifest successfully written to: {OUTPUT_JSON}")

if __name__ == '__main__':
    main()

