-- ============================================================================
-- Migration: 003_seed_canonical_library.sql
-- Description: Canonical DPDP legal sources, control framework v1.0, and evidence catalogue
-- Generated deterministically from data/ canonical datasets
-- Version: 1.0.0
-- Author: Principal Software Architect / Database Security Engineer
-- Target: PostgreSQL 16+
-- ============================================================================

-- 1. FRAMEWORK VERSION
INSERT INTO framework_versions (id, code, name, description, legal_basis, status, effective_date)
VALUES ('ab68a890-9932-5775-bd04-d18bffdb0415', 'DPDPA-2023-V1.0',
  'India Digital Personal Data Protection Act, 2023 Framework (v1.0)',
  'Canonical compliance baseline derived from DPDPA 2023 and DPDP Rules 2025.',
  'Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023)',
  'ACTIVE', '2025-11-13')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status;

-- 2. SCORING MODEL
INSERT INTO scoring_models (id, code, name, version, formula_definition, status)
VALUES ('c9ddba7f-8954-5d37-a92f-cf5a1f27e68b', 'SCORING-V1-STANDARD-WEIGHTED',
  'TLI DPDP Standard Weighted Risk and Maturity Model v1.0', '1.0.0',
  '{"method": "WEIGHTED_DOMAIN_AVERAGE", "scale": "0-5", "penalty_tiers": {"TIER_1": 2500000000, "TIER_2": 2000000000, "TIER_3": 1500000000, "TIER_4": 500000000, "TIER_5": 10000}}'::jsonb,
  'ACTIVE')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, formula_definition = EXCLUDED.formula_definition, status = EXCLUDED.status;

-- 3. LEGAL SOURCES REGISTER (7 CANONICAL AUTHORITIES)
INSERT INTO legal_sources (id, source_id, title, citation, issuing_authority, publication_date, gazette_reference, source_type, commencement_status, url, verification_status)
VALUES ('35da98e6-57ea-5b48-9485-425fdc6aceaa', 'SRC-01', 'Digital Personal Data Protection Act, 2023', 'Act No. 22 of 2023',
  'Parliament of India / Ministry of Law and Justice', '2023-08-11', 'Gazette of India (Extraordinary), Part II, Section 1, No. 26',
  'ENACTED_STATUTE'::legal_source_type, 'PHASED_COMMENCEMENT'::source_commencement_status,
  'https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf', 'VERIFIED_PRIMARY_SOURCE')
ON CONFLICT (source_id) DO UPDATE SET
  title = EXCLUDED.title, citation = EXCLUDED.citation, issuing_authority = EXCLUDED.issuing_authority,
  commencement_status = EXCLUDED.commencement_status, url = EXCLUDED.url, verification_status = EXCLUDED.verification_status;

INSERT INTO legal_sources (id, source_id, title, citation, issuing_authority, publication_date, gazette_reference, source_type, commencement_status, url, verification_status)
VALUES ('89654bd9-8be9-54db-a7bd-0a629c1770e3', 'SRC-02', 'DPDPA 2023 Commencement Notification', 'S.O. 4930(E)',
  'Ministry of Electronics and Information Technology (MeitY)', '2025-11-13', 'Gazette of India (Extraordinary), Part II, Section 3(ii)',
  'COMMENCEMENT_NOTIFICATION'::legal_source_type, 'IN_FORCE'::source_commencement_status,
  'https://egazette.gov.in/WriteReadData/2025/258941.pdf', 'VERIFIED_PRIMARY_SOURCE')
ON CONFLICT (source_id) DO UPDATE SET
  title = EXCLUDED.title, citation = EXCLUDED.citation, issuing_authority = EXCLUDED.issuing_authority,
  commencement_status = EXCLUDED.commencement_status, url = EXCLUDED.url, verification_status = EXCLUDED.verification_status;

INSERT INTO legal_sources (id, source_id, title, citation, issuing_authority, publication_date, gazette_reference, source_type, commencement_status, url, verification_status)
VALUES ('a9420d05-93ea-5b10-afec-45866777e155', 'SRC-03', 'Digital Personal Data Protection Rules, 2025', 'G.S.R. 846(E)',
  'Ministry of Electronics and Information Technology (MeitY)', '2025-11-13', 'Gazette of India (Extraordinary), Part II, Section 3(i)',
  'NOTIFIED_RULES'::legal_source_type, 'PHASED_COMMENCEMENT'::source_commencement_status,
  'https://www.meity.gov.in/writereaddata/files/DPDP_Rules_2025_GSR846E.pdf', 'VERIFIED_PRIMARY_SOURCE')
ON CONFLICT (source_id) DO UPDATE SET
  title = EXCLUDED.title, citation = EXCLUDED.citation, issuing_authority = EXCLUDED.issuing_authority,
  commencement_status = EXCLUDED.commencement_status, url = EXCLUDED.url, verification_status = EXCLUDED.verification_status;

INSERT INTO legal_sources (id, source_id, title, citation, issuing_authority, publication_date, gazette_reference, source_type, commencement_status, url, verification_status)
VALUES ('55cba0f2-f489-5409-9e16-7ffbe0e0261a', 'SRC-04', 'DPDP (Removal of Difficulties) Order, 2026', 'S.O. 4120(E)',
  'Ministry of Electronics and Information Technology (MeitY)', '2026-10-07', 'Gazette of India (Extraordinary), Part II, Section 3(ii)',
  'OFFICIAL_ORDER'::legal_source_type, 'IN_FORCE'::source_commencement_status,
  'https://egazette.gov.in/WriteReadData/2026/269102.pdf', 'VERIFIED_PRIMARY_SOURCE')
ON CONFLICT (source_id) DO UPDATE SET
  title = EXCLUDED.title, citation = EXCLUDED.citation, issuing_authority = EXCLUDED.issuing_authority,
  commencement_status = EXCLUDED.commencement_status, url = EXCLUDED.url, verification_status = EXCLUDED.verification_status;

INSERT INTO legal_sources (id, source_id, title, citation, issuing_authority, publication_date, gazette_reference, source_type, commencement_status, url, verification_status)
VALUES ('c4c3ee7a-e0a6-582f-8aa7-e1d2a0c8b116', 'SRC-05', 'Constitution of India, Eighth Schedule (Languages)', 'Eighth Schedule, Articles 344(1) and 351',
  'Constituent Assembly of India / Ministry of Law and Justice', '1950-01-26', 'Constitution of India',
  'CONSTITUTIONAL_REFERENCE'::legal_source_type, 'IN_FORCE'::source_commencement_status,
  'https://legislative.gov.in/constitution-of-india/', 'VERIFIED_PRIMARY_SOURCE')
ON CONFLICT (source_id) DO UPDATE SET
  title = EXCLUDED.title, citation = EXCLUDED.citation, issuing_authority = EXCLUDED.issuing_authority,
  commencement_status = EXCLUDED.commencement_status, url = EXCLUDED.url, verification_status = EXCLUDED.verification_status;

INSERT INTO legal_sources (id, source_id, title, citation, issuing_authority, publication_date, gazette_reference, source_type, commencement_status, url, verification_status)
VALUES ('67dac3d1-37c7-51cd-b262-4e8fe6edcbe2', 'SRC-06', 'RBI Directive on Storage of Payment System Data', 'DPSS.CO.OD.No.2785/06.08.005/2017-18',
  'Reserve Bank of India (Payment and Settlement Systems)', '2018-04-06', 'RBI Notification',
  'SECTORAL_REGULATION'::legal_source_type, 'IN_FORCE'::source_commencement_status,
  'https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=11244', 'VERIFIED_PRIMARY_SOURCE')
ON CONFLICT (source_id) DO UPDATE SET
  title = EXCLUDED.title, citation = EXCLUDED.citation, issuing_authority = EXCLUDED.issuing_authority,
  commencement_status = EXCLUDED.commencement_status, url = EXCLUDED.url, verification_status = EXCLUDED.verification_status;

INSERT INTO legal_sources (id, source_id, title, citation, issuing_authority, publication_date, gazette_reference, source_type, commencement_status, url, verification_status)
VALUES ('c6f5000c-a9d7-5e71-baba-b73b8be615ee', 'SRC-07', 'CERT-In Cyber Security Directions, 2022', 'No. 20(3)/2022-CERT-In',
  'Indian Computer Emergency Response Team (CERT-In)', '2022-04-28', 'Gazette of India, Section 70B(6) IT Act',
  'SECTORAL_REGULATION'::legal_source_type, 'IN_FORCE'::source_commencement_status,
  'https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf', 'VERIFIED_PRIMARY_SOURCE')
ON CONFLICT (source_id) DO UPDATE SET
  title = EXCLUDED.title, citation = EXCLUDED.citation, issuing_authority = EXCLUDED.issuing_authority,
  commencement_status = EXCLUDED.commencement_status, url = EXCLUDED.url, verification_status = EXCLUDED.verification_status;

-- 4. CONTROL DOMAINS (13 CANONICAL TOPICS)
INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('96e33cc2-dcc7-53e3-896c-f64245e74364', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'NOTICE_TRANSPARENCY', 'Notice & Transparency Architecture',
  'Itemised, standalone notices presented prior to or at time of consent collection.', 'Section 5 r/w Rule 3', 1.25, 1)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('f9af9a60-b9ec-535a-9a16-173e6aa84efc', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'CONSENT_MANAGEMENT', 'Consent Architecture & Consent Managers',
  'Unbundled, freely given, specific, informed and unambiguous consent mechanisms.', 'Section 6 r/w Rules 4-5', 1.25, 2)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('de5f127f-29ac-589b-a435-aba4c89a0556', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'LEGITIMATE_USES', 'Legitimate Uses & Legal Grounds',
  'Exhaustive statutory legitimate grounds for processing without affirmative consent.', 'Section 7', 1.0, 3)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('0f38da0d-9ac0-5025-990f-28894ec97273', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'FIDUCIARY_DUTIES', 'Data Fiduciary General Obligations',
  'Completeness, accuracy, technical and organizational safeguards, and grievance redressal.', 'Section 8(1)-(4), 8(10)', 1.0, 4)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('1832ad19-4c2c-584d-b4f8-9f141c2a5615', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'PROCESSOR_OVERSIGHT', 'Data Processor Oversight & Contracts',
  'Valid data processing agreements, technical instructions, and sub-processor governance.', 'Section 8(2)', 1.0, 5)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('a774abcc-b4e1-5ff3-b4e8-d96618055b80', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'SECURITY_SAFEGUARDS', 'Security Safeguards & Technical Measures',
  'Reasonable technical and organizational security safeguards to prevent data breaches.', 'Section 8(5)', 1.5, 6)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('ceb4cc99-c1bf-5e05-9e04-e2b1fb803730', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'BREACH_READINESS', 'Personal Data Breach Readiness & Notification',
  'Intimation of personal data breaches to the Data Protection Board and affected Data Principals.', 'Section 8(6) r/w Rule 7', 1.5, 7)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('236ea7bb-1335-5c80-962d-f0f94c4c9ac5', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'RETENTION_ERASURE', 'Data Retention & Purpose Erasure',
  'Data erasure upon purpose fulfillment, consent withdrawal, or statutory retention expiration.', 'Section 8(7), 8(8)', 1.0, 8)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('7886fc84-15a6-5821-8ea6-599309f6804f', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'CHILDREN_DISABLED_DATA', 'Children & Persons with Disabilities Safeguards',
  'Verifiable parental consent, age verification, and prohibition of behavioral tracking.', 'Section 9 r/w Rule 8', 1.25, 9)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('612805de-1449-5e6e-b455-408d54116009', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'SDF_GOVERNANCE', 'Significant Data Fiduciary (SDF) Governance',
  'Enhanced obligations: Resident DPO, Independent Data Auditor, periodic DPIAs and audits.', 'Section 10 r/w Rules 9-10', 1.25, 10)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('42503c9f-3981-5641-8c1c-b98067825db2', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'DATA_PRINCIPAL_RIGHTS', 'Data Principal Rights & Grievance Redressal',
  'Rights of access, correction, erasure, grievance redressal, and nomination.', 'Sections 11-14 r/w Rules 11-14', 1.25, 11)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('4fa0b148-6928-5701-8347-c94f4bfc923a', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'CROSS_BORDER_TRANSFERS', 'Cross-Border Personal Data Transfers',
  'Transfers of personal data outside India subject to Central Government restriction lists.', 'Section 16', 1.0, 12)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)
VALUES ('5ec22c3b-65ef-5972-b22f-5635e03fbbd6', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'PENALTY_READINESS', 'Statutory Penalties & Adjudication Readiness',
  'Penalty exposure tracking, mitigating defense documentation, and DPBI inquiry readiness.', 'Section 33 r/w Schedule', 1.0, 13)
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,
  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;

-- 5. CONTROLS (30 CANONICAL CONTROLS)
INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('2068e1ba-0e98-50e2-aed5-5bb43b4a7e16', 'ab68a890-9932-5775-bd04-d18bffdb0415', '96e33cc2-dcc7-53e3-896c-f64245e74364', 'TLI-DPDP-SCO-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 3', 'Applicability, Jurisdiction and Material Perimeter', 'Establish the material and territorial boundaries of digital personal data processing within and outside India.',
  'MANDATORY_STATUTORY'::obligation_type, 'The Act applies to the processing of digital personal data within India, and outside India if in connection with offering goods or services to Data Principals in India. Excludes personal/domestic use and publicly available data.',
  'Applies universally to any entity processing personal data in digital form.', 'Core jurisdictional perimeter; non-excludable.',
  'Has the organisation documented its digital personal data inventory, established jurisdictional boundaries, and identified all digital collection touchpoints?', 'Maintain an exhaustive inventory of digital processing activities (RoPA), categorising personal data collected within India or from Indian Data Principals abroad.',
  '["EVID-ROPA-01"]'::jsonb, 'Verbal assertions without a documented data inventory are insufficient.',
  'Verify whether offline data digitised subsequently is brought into scope as mandated by Section 3(a)(ii).', 'Operating outside defined compliance scope risks unmonitored regulatory exposure across all processing streams.',
  'Implement an enterprise Data Processing Activities Registry (RoPA) cataloguing data flows, storage locations, and legal entities.', '["TLI-DPDP-LGL-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 1, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('fea196b7-fc38-54b9-a215-5fb2c71f81e8', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'de5f127f-29ac-589b-a435-aba4c89a0556', 'TLI-DPDP-LGL-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 4', 'Lawful Basis and Ground of Processing', 'Ensure all personal data processing is underpinned by valid consent or an exhaustive statutory legitimate use.',
  'MANDATORY_STATUTORY'::obligation_type, 'Personal data may be processed only for a lawful purpose for which the Data Principal has given consent (Section 6), or for certain legitimate uses specified under Section 7.',
  'Applies to all processing activities across all business units.', 'Foundational rule; no processing can exist without a valid statutory ground.',
  'Is every personal data processing activity formally mapped to a distinct statutory ground (valid consent under Section 6 or an exhaustive legitimate use under Section 7)?', 'Document the legal ground for every data processing activity in the RoPA; eliminate processing lacking a valid statutory anchor.',
  '["EVID-ROPA-01", "EVID-SEC-01"]'::jsonb, 'High-level privacy policies without activity-level legal mapping do not demonstrate compliance.',
  'Confirm that the organisation does not rely on generic ''business interest'' claims outside the exhaustive list of Section 7.', 'Processing without a lawful basis constitutes an unlawful act under Section 4, exposing the fiduciary to statutory scrutiny.',
  'Conduct a legal grounds audit mapping each personal data collection workflow to either Section 6 (Consent) or a Section 7 clause.', '["TLI-DPDP-CON-01", "TLI-DPDP-LEG-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 2, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('e78827a1-6c1c-5991-9ffc-67c36235f3ae', 'ab68a890-9932-5775-bd04-d18bffdb0415', '96e33cc2-dcc7-53e3-896c-f64245e74364', 'TLI-DPDP-NOT-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 5(1) r/w Rule 3', 'Itemised and Pre-Consent Notice', 'Provide Data Principals with clear, itemised notice before seeking consent.',
  'MANDATORY_STATUTORY'::obligation_type, 'Notice must be given before or at the time of seeking consent. It must specify the personal data sought, the specific itemised purpose, the manner of exercising Section 11 rights, and the manner of making complaints to the DPBI.',
  'Applies to all activities where personal data is collected on the basis of consent.', 'Mandatory whenever consent is sought.',
  'Does the organisation provide a clear, standalone, itemised notice before or at the time of requesting consent, detailing data types, purpose, rights, and DPBI complaint procedures?', 'Deploy discrete pre-consent notices detailing data fields, specific itemised purposes, DSAR instructions, and grievance redressal steps.',
  '["EVID-NOT-01"]'::jsonb, 'Generic website terms of service or privacy policies bundled with commercial conditions do not satisfy Section 5(1).',
  'Inspect actual collection touchpoints to verify notice timing and content.', 'Inadequate or bundled notice invalidates consent under Section 6(1), undermining the legality of processing.',
  'Redesign onboarding UI/UX to display standalone, itemised notices prior to consent checkboxes.', '["TLI-DPDP-NOT-03", "TLI-DPDP-CON-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 3, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('629db1eb-522b-5db4-a436-573f6ec3df56', 'ab68a890-9932-5775-bd04-d18bffdb0415', '96e33cc2-dcc7-53e3-896c-f64245e74364', 'TLI-DPDP-NOT-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 5(2) r/w Rule 3', 'Historical Notice for Pre-Existing Consent', 'Inform existing Data Principals of processing details for legacy consent captured prior to commencement.',
  'MANDATORY_STATUTORY'::obligation_type, 'Where consent was collected prior to commencement, notice informing the Data Principal of data, purpose, rights, and DPBI grievance route must be dispatched as soon as practicable.',
  'Applies to fiduciaries holding legacy personal data collected prior to 13 May 2027.', 'Mandatory for entities with legacy customer/user databases.',
  'Has the organisation planned or dispatched retrospective notices to existing Data Principals whose consent was captured prior to the commencement of the Act?', 'Implement a communication protocol to send compliant Section 5 notices to existing registered users upon commencement.',
  '["EVID-NOT-03", "EVID-SOP-01"]'::jsonb, 'Marketing email campaigns without statutory notice elements do not qualify.',
  'Verify communications schedules, customer notification email/SMS templates, and audit logs.', 'Continuing processing legacy data without issuing statutory notice exposes the fiduciary to non-compliance penalties.',
  'Draft and schedule a grandfathering notice communication plan for all active registered users.', '["TLI-DPDP-NOT-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 4, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('833541bb-1bd6-5d06-9e6f-2620298d20d9', 'ab68a890-9932-5775-bd04-d18bffdb0415', '96e33cc2-dcc7-53e3-896c-f64245e74364', 'TLI-DPDP-NOT-03', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 5(3) r/w Rule 5', 'Multilingual Notice Option Mechanism', 'Enable Data Principals to access notices in English or any Eighth Schedule language.',
  'MANDATORY_STATUTORY'::obligation_type, 'The Data Principal shall be given an option to access the contents of the notice in English or any of the 22 languages specified in the Eighth Schedule to the Constitution.',
  'Applies to all consumer-facing and public-facing Data Fiduciaries seeking consent.', 'Mandatory statutory provision under Section 5(3).',
  'Does the organisation provide an operational mechanism (e.g. language toggle or accessible translated views) allowing Data Principals to view notices in English or any Eighth Schedule language?', 'Implement UI language selection toggles or certified translated versions of the privacy notice across 22 Eighth Schedule languages.',
  '["EVID-NOT-02"]'::jsonb, 'Stating that a translation tool can be used by the user in their browser does not satisfy the statutory mandate under Section 5(3).',
  'Verify that certified translations or verified dynamic localization engines are integrated into the customer onboarding path.', 'Failure to provide Eighth Schedule multilingual options constitutes a breach of notice obligations under Section 5.',
  'Commission certified translations of statutory notices and implement an accessible language selector on public portals.', '["TLI-DPDP-NOT-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 5, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-01; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('a5fca31d-2d17-5bd6-bb22-b81e9b127cdd', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'f9af9a60-b9ec-535a-9a16-173e6aa84efc', 'TLI-DPDP-CON-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 6(1)-(3) r/w Rule 6', 'Unbundled Affirmative Consent Architecture', 'Capture affirmative, unbundled, and unambiguous consent free from dark patterns.',
  'MANDATORY_STATUTORY'::obligation_type, 'Consent must be free, specific, informed, unconditional, unambiguous, and signified by clear affirmative action. Pre-ticked boxes, bundled terms, or forced consent for non-essential purposes are prohibited.',
  'Applies to all processing activities relying on consent.', 'Mandatory statutory provision for consent-based processing.',
  'Are consent mechanisms unbundled, free from dark patterns and pre-ticked checkboxes, and captured through clear affirmative action with cryptographic timestamps?', 'Configure consent collection with unchecked boxes, separate consent toggles for distinct purposes, and an immutable consent logging system.',
  '["EVID-CON-01"]'::jsonb, 'Merely showing a ''By clicking Submit you agree to our Terms'' button fails the unconditional and affirmative action test.',
  'Inspect live registration flows across web, mobile, and offline channels.', 'Invalid or bundled consent nullifies the legal basis of processing under Section 6.',
  'Remove pre-ticked checkboxes and decouple service delivery from optional data collection.', '["TLI-DPDP-CON-02", "TLI-DPDP-NOT-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 6, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('adea9713-7a0b-5385-86b3-80f36c471663', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'f9af9a60-b9ec-535a-9a16-173e6aa84efc', 'TLI-DPDP-CON-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 6(4)-(6)', 'Consent Withdrawal Mechanism and Comparable Ease', 'Enable Data Principals to withdraw consent with ease comparable to giving it.',
  'MANDATORY_STATUTORY'::obligation_type, 'Data Principals have the right to withdraw consent at any time. Ease of withdrawal must be comparable to ease of granting. Upon withdrawal, fiduciary must cease processing within reasonable time.',
  'Applies to all consent-based processing systems.', 'Mandatory statutory duty.',
  'Does the organisation provide an accessible, frictionless mechanism allowing Data Principals to withdraw consent with ease comparable to granting it, triggering automated cessation of processing?', 'Deploy self-service consent management preference centers (e.g. 1-click opt-out) integrated with backend data pipelines.',
  '["EVID-CON-02"]'::jsonb, 'Requiring physical letters or complex manual customer service calls to withdraw digitally given consent violates Section 6(4).',
  'Compare the steps required to give consent vs the steps required to withdraw.', 'Obstructing consent withdrawal violates Section 6(4) and triggers mandatory erasure requirements under Section 8(7).',
  'Build a self-service privacy preference center in mobile apps and web account settings.', '["TLI-DPDP-CON-01", "TLI-DPDP-RET-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 7, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('7b629114-5f5c-5b46-9ca1-ca8ccaa11a30', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'f9af9a60-b9ec-535a-9a16-173e6aa84efc', 'TLI-DPDP-CON-03', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 6(7)-(9) r/w Rule 4', 'Consent Manager Interoperability', 'Support electronic consent giving, management, and withdrawal through registered Consent Managers.',
  'STATUTORY_EXCEPTION_CONDITIONAL'::obligation_type, 'A Data Principal may give, manage, review, or withdraw consent through a registered Consent Manager. Consent Managers must be registered with DPBI and satisfy Rule 4 standards.',
  'Applies to organisations interfacing with or acting as registered Consent Managers.', 'Interoperability requirement commencing 13 November 2026.',
  'Is the organisation equipped with technical APIs and interoperability workflows to receive, verify, and execute consent instructions from registered Consent Managers?', 'Integrate standard API endpoints to ingest and validate consent artifacts dispatched by registered Consent Managers.',
  '["EVID-CON-01"]'::jsonb, 'Architecture drafts without implemented API specifications are insufficient.',
  'Verify whether system architecture accommodates external consent lifecycle webhooks.', 'Inability to honor Consent Manager requests once operational creates regulatory non-compliance under Section 6(9).',
  'Design an inbound Consent Artifact ingestion gateway supporting MeitY/DPBI electronic data interchange standards.', '["TLI-DPDP-CON-01", "TLI-DPDP-CON-02"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 8, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-02; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('b0a29d1b-5fce-5adc-b2ff-1367eafc6ba6', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'de5f127f-29ac-589b-a435-aba4c89a0556', 'TLI-DPDP-LEG-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 7(a)', 'Voluntary Provision Legitimate Uses', 'Confine processing under voluntary provision strictly to specified purposes.',
  'STATUTORY_EXCEPTION_CONDITIONAL'::obligation_type, 'Processing without explicit consent is lawful where the Data Principal voluntarily provides personal data for a specified purpose and has not indicated withholding of consent.',
  'Applies to workflows relying on voluntary provision (e.g. inbound queries).', 'Legitimate use exception.',
  'Where processing relies on voluntary provision under Section 7(a), is processing strictly confined to the specific purpose for which the data was provided?', 'Document controls ensuring data voluntarily furnished for one purpose (e.g., support ticket) is not repurposed for marketing.',
  '["EVID-ROPA-01", "EVID-SOP-01"]'::jsonb, 'Repurposing voluntary support data for unsolicited sales outreach violates Section 7(a).',
  'Verify whether data boundaries and access restrictions prevent secondary processing.', 'Exceeding the scope of voluntary provision constitutes unlawful processing under Section 4.',
  'Establish technical partition tags preventing voluntary customer enquiry data from synchronizing to marketing databases.', '["TLI-DPDP-LGL-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 9, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('53f68812-2b03-5f99-9bca-b74f26844c04', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'de5f127f-29ac-589b-a435-aba4c89a0556', 'TLI-DPDP-LEG-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 7(g)', 'Employment Functions Legitimate Uses', 'Process employee data strictly within legitimate employment purposes without disproportionate surveillance.',
  'STATUTORY_EXCEPTION_CONDITIONAL'::obligation_type, 'Personal data may be processed without consent for the purposes of employment or for safeguarding the employer from loss or liability.',
  'Applies to all employers processing employee data.', 'Legitimate use exception for HR/workplace data.',
  'Does the organisation process employee personal data strictly within the boundaries of employment functions, benefits administration, and asset protection without excessive surveillance?', 'Maintain an Employee Privacy Notice and HR Processing Policy defining permissible monitoring and data handling boundaries.',
  '["EVID-ROPA-01", "EVID-SEC-01"]'::jsonb, 'Invasive personal device monitoring without employment nexus cannot be justified under Section 7(g).',
  'Inspect employee handbooks, monitoring disclosures, and BYOD policies.', 'Unjustified surveillance beyond Section 7(g) boundaries violates statutory grounds.',
  'Formalise an Employee Data Protection SOP clarifying legitimate employment use cases and data retention limits.', '["TLI-DPDP-LGL-01", "TLI-DPDP-RET-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 10, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-03; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('2044cfd8-8aab-5dc2-ac64-540851195916', 'ab68a890-9932-5775-bd04-d18bffdb0415', '0f38da0d-9ac0-5025-990f-28894ec97273', 'TLI-DPDP-FID-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(1)', 'Accountability and Non-Delegable Responsibility', 'Maintain non-delegable responsibility for compliance across internal operations and processors.',
  'MANDATORY_STATUTORY'::obligation_type, 'A Data Fiduciary shall be responsible for complying with the provisions of this Act in respect of any processing undertaken by it or on its behalf by a Data Processor.',
  'Applies to all Data Fiduciaries.', 'Non-negotiable statutory duty under Section 8(1).',
  'Does the organisation maintain enterprise-wide governance, policies, and audit mechanisms ensuring accountability for all processing conducted internally and through external vendors?', 'Formulate board-approved data protection governance charters, appoint privacy leads, and conduct regular internal compliance reviews.',
  '["EVID-SEC-01", "EVID-DPA-01"]'::jsonb, 'Shifting full compliance responsibility onto cloud providers or IT vendors is legally void under Section 8(1).',
  'Review executive accountability reporting, compliance charters, and vendor oversight mechanisms.', 'Fiduciary remains solely liable before the DPBI for statutory violations committed by downstream processors.',
  'Establish a Data Protection Committee and implement formal third-party risk governance.', '["TLI-DPDP-PRO-01", "TLI-DPDP-SEC-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 11, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('a7b0d967-9d8c-5f34-af6f-3e69e5f6369f', 'ab68a890-9932-5775-bd04-d18bffdb0415', '1832ad19-4c2c-584d-b4f8-9f141c2a5615', 'TLI-DPDP-PRO-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(2) r/w Rule 7', 'Data Processor Engagement and Contractual Governance', 'Bind all third-party Data Processors under valid contracts containing mandatory statutory clauses.',
  'MANDATORY_STATUTORY'::obligation_type, 'A Data Fiduciary may engage, appoint, use or otherwise involve a Data Processor only under a valid contract. Rule 7 specifies mandatory clauses: processing scope, confidentiality, technical security, breach notice, sub-processor restrictions, and audit rights.',
  'Applies to all fiduciaries engaging third-party software, cloud hosts, or outsourcing agencies.', 'Mandatory statutory duty.',
  'Are all third-party Data Processors bound by legally executed Data Processing Agreements (DPAs) incorporating mandatory Rule 7 clauses?', 'Execute standardized DPAs with all cloud hosts, SaaS providers, and service vendors processing personal data.',
  '["EVID-DPA-01"]'::jsonb, 'Standard commercial purchase orders without privacy and security schedules fail Section 8(2).',
  'Review a sample of executed vendor contracts across cloud infrastructure, HR SaaS, and customer support vendors.', 'Engaging an uncontracted processor violates Section 8(2) and exposes fiduciary to direct liability for vendor breaches.',
  'Establish an enterprise DPA remediation workflow to execute supplemental data protection terms with all active vendors.', '["TLI-DPDP-FID-01", "TLI-DPDP-SEC-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 12, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-04; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('fb7cc426-3b2b-5a44-bae7-8e646fc50e8d', 'ab68a890-9932-5775-bd04-d18bffdb0415', '0f38da0d-9ac0-5025-990f-28894ec97273', 'TLI-DPDP-FID-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(3)', 'Data Quality, Accuracy and Decision Safeguards', 'Ensure personal data completeness, accuracy, and consistency when used for decision-making or disclosure.',
  'MANDATORY_STATUTORY'::obligation_type, 'A Data Fiduciary shall ensure data completeness, accuracy, and consistency if personal data is used to make a decision that affects the Data Principal, or is disclosed to another Data Fiduciary.',
  'Applies to fiduciaries using personal data for automated scoring, underwriting, reviews, or external sharing.', 'Mandatory statutory duty under Section 8(3).',
  'Does the organisation maintain data validation, deduplication, and quality controls to guarantee accuracy when personal data affects Data Principals or is disclosed to third parties?', 'Implement database input validation routines, deduplication engines, and self-service correction mechanisms.',
  '["EVID-SOP-02"]'::jsonb, 'Manual ad-hoc corrections without documented quality validation protocols do not satisfy Section 8(3).',
  'Test data validation rules on onboarding inputs and data exchange interfaces.', 'Incorrect decisions resulting from inaccurate data breach Section 8(3) and provoke Data Principal claims.',
  'Implement automated data hygiene and verification pipelines at points of collection and transformation.', '["TLI-DPDP-DSR-02"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 13, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('6cfbd8c0-712a-5c0a-872f-f094fd533d47', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'a774abcc-b4e1-5ff3-b4e8-d96618055b80', 'TLI-DPDP-SEC-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(4)-(5) r/w Rule 8', 'Technical and Organisational Security Safeguards (TOMs)', 'Implement reasonable technical and organisational security safeguards to prevent personal data breaches.',
  'MANDATORY_STATUTORY'::obligation_type, 'A Data Fiduciary shall implement appropriate technical and organisational measures to ensure compliance, and protect personal data by taking reasonable security safeguards to prevent personal data breach. Maximum penalty: ₹250 Crores.',
  'Applies universally across all systems holding digital personal data.', 'Top-tier statutory mandate carrying maximum penal exposure.',
  'Has the organisation implemented verified technical and organisational security measures (access controls, vulnerability assessments, network segmentation, multi-factor authentication) to prevent data breaches?', 'Deploy ISO 27001 / SOC 2 aligned security baselines: annual VAPT, strict MFA on employee portals, role-based database access, and patch management.',
  '["EVID-SEC-01", "EVID-VAPT-01"]'::jsonb, 'Stale VAPT reports older than 12 months or unresolved critical vulnerabilities invalidate claims of reasonable safeguards.',
  'Inspect recent penetration test executive summaries and remediation verification letters.', 'Absence of reasonable safeguards exposes organisation to maximum statutory penalty under Schedule Tier 1 (up to ₹250 Crores).',
  'Commission an immediate external VAPT audit and remediate all high/critical vulnerabilities on personal data repositories.', '["TLI-DPDP-SEC-02", "TLI-DPDP-BRC-01"]'::jsonb,
  'TIER_1_250CR'::penalty_tier, 1.5, 14, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('e6df79b0-b51f-5c20-ab18-8077b856c343', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'a774abcc-b4e1-5ff3-b4e8-d96618055b80', 'TLI-DPDP-SEC-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(5) r/w Rule 8', 'Encryption, Key Governance and Access Controls', 'Enforce strong encryption at rest and in transit with secure key management.',
  'MANDATORY_STATUTORY'::obligation_type, 'Reasonable safeguards require protecting data in transit and at rest using standard cryptographic mechanisms, key isolation, and least-privilege identity access management.',
  'Applies to all databases, object stores, and transmission channels carrying personal data.', 'Core baseline safeguard.',
  'Is all digital personal data encrypted at rest (e.g. AES-256) and in transit (TLS 1.2+ / 1.3), supported by secure KMS key rotation and least-privilege access?', 'Enforce TLS 1.3 in transit, AES-256 at rest, automated annual key rotation via KMS/HSM, and zero plaintext personal data storage.',
  '["EVID-SEC-02"]'::jsonb, 'Hardcoded encryption keys in source repositories or plaintext database backups fail Section 8(5).',
  'Inspect database configuration snapshots and TLS ciphersuite audit reports.', 'Plaintext data exfiltration turns an intrusion into a catastrophic data breach with maximum liability.',
  'Enable automated KMS encryption at rest across all cloud storage buckets and relational database volumes.', '["TLI-DPDP-SEC-01"]'::jsonb,
  'TIER_1_250CR'::penalty_tier, 1.5, 15, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('bcd6a6df-fbc6-5697-b72d-19866a17f468', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'ceb4cc99-c1bf-5e05-9e04-e2b1fb803730', 'TLI-DPDP-BRC-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(6) r/w Rule 9', 'Personal Data Breach Incident Response and Triage', 'Maintain operational incident response playbooks for detecting, containing, and triaging personal data breaches.',
  'MANDATORY_STATUTORY'::obligation_type, 'In the event of a personal data breach, the Data Fiduciary shall intimate the Board and each affected Data Principal. Requires documented incident management and triage SOPs. Maximum penalty: ₹200 Crores.',
  'Applies to all Data Fiduciaries.', 'Mandatory statutory duty carrying Tier 2 penalty exposure.',
  'Does the organisation maintain an operational Personal Data Breach Incident Response Plan detailing detection, escalation, containment, and root-cause analysis?', 'Establish a 24/7 CSIRT team, breach triage matrix, and documented escalation protocols.',
  '["EVID-BRC-01"]'::jsonb, 'Generic IT disaster recovery plans that omit personal data compromise and privacy impacts are insufficient.',
  'Review table-top drill records and incident response playbooks.', 'Failure to promptly detect and triage a breach leads to statutory reporting failure under Section 8(6).',
  'Author and execute a dedicated Data Breach Incident Response Plan with annual tabletop simulation drills.', '["TLI-DPDP-BRC-02", "TLI-DPDP-SEC-01"]'::jsonb,
  'TIER_2_200CR'::penalty_tier, 1.25, 16, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-05; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('4530b958-37b4-53e2-97fb-96eab39baf36', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'ceb4cc99-c1bf-5e05-9e04-e2b1fb803730', 'TLI-DPDP-BRC-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(6) r/w Rule 9', 'Dual Breach Intimation (DPBI and Affected Principals)', 'Maintain capability to intimate personal data breaches to the DPBI and affected Data Principals in prescribed form.',
  'MANDATORY_STATUTORY'::obligation_type, 'Mandatory intimation of personal data breach to the DPBI and to each affected Data Principal in prescribed form, manner, and timelines. Maximum penalty: ₹200 Crores.',
  'Applies to all Data Fiduciaries.', 'Non-negotiable statutory mandate.',
  'Are communication templates, secure channels, and procedural workflows established to execute mandatory breach intimations to both the DPBI and affected Data Principals?', 'Pre-draft bilingual breach notification templates and maintain technical bulk notification channels to alert affected Data Principals without delay.',
  '["EVID-BRC-02", "EVID-SOP-03"]'::jsonb, 'Notifying only the Board while concealing the incident from affected Data Principals violates Section 8(6).',
  'Inspect pre-drafted communication templates for required statutory fields.', 'Failure to intimate breach to Board or Data Principals triggers statutory penalties up to ₹200 Crores.',
  'Configure automated communication playbooks ready to dispatch breach notices to DPBI digital portal and Data Principals.', '["TLI-DPDP-BRC-01"]'::jsonb,
  'TIER_2_200CR'::penalty_tier, 1.25, 17, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-05; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('60ec6d38-3eef-51e5-8562-e51af5d7c227', 'ab68a890-9932-5775-bd04-d18bffdb0415', '236ea7bb-1335-5c80-962d-f0f94c4c9ac5', 'TLI-DPDP-RET-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(7) r/w Rule 10', 'Purpose Fulfillment and Automated Erasure', 'Erase personal data upon consent withdrawal or purpose fulfillment unless required by law.',
  'MANDATORY_STATUTORY'::obligation_type, 'A Data Fiduciary must erase personal data upon consent withdrawal or as soon as purpose fulfillment occurs, unless retention is required by law.',
  'Applies to all systems holding digital personal data.', 'Mandatory statutory duty enforcing storage limitation.',
  'Does the organisation maintain defined retention schedules with automated or verified data purging when the specified purpose expires or consent is withdrawn?', 'Maintain a Data Retention Schedule and execute automated cron jobs / database TTL policies to purge expired personal data.',
  '["EVID-RET-01"]'::jsonb, 'Indefinite data retention policies or failure to purge test/staging databases violate Section 8(7).',
  'Verify database archival routines and data destruction certificates.', 'Retaining data beyond purpose fulfillment breaches Section 8(7) and amplifies breach impact surface.',
  'Deploy automated data lifecycle management (DLM) policies across databases and object storage.', '["TLI-DPDP-CON-02", "TLI-DPDP-RET-02"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 18, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('7ae586ee-6ba2-51c5-90e4-204dba50c3e8', 'ab68a890-9932-5775-bd04-d18bffdb0415', '236ea7bb-1335-5c80-962d-f0f94c4c9ac5', 'TLI-DPDP-RET-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(7)-(8)', 'Statutory Retention Exceptions Register', 'Document and substantiate statutory provisions mandating retention beyond purpose fulfillment.',
  'MANDATORY_STATUTORY'::obligation_type, 'Retention beyond purpose fulfillment is lawful only where explicitly required under applicable laws (e.g. Income Tax Act, PMLA, Companies Act).',
  'Applies to all fiduciaries retaining personal data under statutory mandates.', 'Justification requirement for retained records.',
  'Has the organisation compiled a Legal Retention Register documenting the specific statutory provisions requiring extended retention of records?', 'Maintain a legal citation register linking personal data categories to specific Indian statutory retention mandates.',
  '["EVID-RET-02"]'::jsonb, 'Vague assertions of ''regulatory compliance'' without citing the applicable Indian Act and section fail this control.',
  'Review legal citations against tax, banking, corporate, and labor legislation.', 'Unsubstantiated retention masquerading as legal obligation violates Section 8(7).',
  'Partner with legal counsel to formulate a comprehensive statutory retention schedule mapping data types to specific enactments.', '["TLI-DPDP-RET-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 19, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('0dd4280a-60f3-566a-8c10-de52d926e2dd', 'ab68a890-9932-5775-bd04-d18bffdb0415', '42503c9f-3981-5641-8c1c-b98067825db2', 'TLI-DPDP-DSR-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 11 r/w Rule 14', 'Data Principal Rights: Access and Information Summary', 'Fulfill Data Principal requests for personal data summaries and sharing partner identities.',
  'MANDATORY_STATUTORY'::obligation_type, 'The Data Principal has the right to obtain: (a) summary of personal data being processed, (b) identities of all other Data Fiduciaries and Processors with whom shared, and (c) other prescribed information.',
  'Applies to all Data Fiduciaries processing personal data.', 'Mandatory statutory right under Section 11.',
  'Does the organisation maintain a secure portal and workflow to provide Data Principals with a comprehensive summary of their processed personal data and a list of sharing partners?', 'Deploy a self-service DSAR access portal or request intake workflow capable of compiling personal data summaries within statutory timelines.',
  '["EVID-DSR-01", "EVID-SOP-04"]'::jsonb, 'Requiring Data Principals to visit physical offices or pay excessive fees violates Section 11.',
  'Test the DSAR intake form and inspect sample response summaries.', 'Denying or ignoring valid access requests triggers Data Principal complaints to the DPBI.',
  'Implement an automated DSAR orchestration tool linked to backend user databases.', '["TLI-DPDP-DSR-02", "TLI-DPDP-DSR-03"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 20, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('d1498958-14ae-57ef-a133-730905b6e197', 'ab68a890-9932-5775-bd04-d18bffdb0415', '42503c9f-3981-5641-8c1c-b98067825db2', 'TLI-DPDP-DSR-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 12 r/w Rule 14', 'Data Principal Rights: Correction, Update and Erasure', 'Enable Data Principals to correct inaccurate data, complete incomplete data, and request erasure.',
  'MANDATORY_STATUTORY'::obligation_type, 'A Data Principal has the right to correction of inaccurate data, completion of incomplete data, updating, and erasure of data no longer necessary for purpose or upon consent withdrawal.',
  'Applies to all Data Fiduciaries.', 'Mandatory statutory right under Section 12.',
  'Are procedures and self-service features in place allowing Data Principals to correct, update, complete, or request erasure of their personal data?', 'Provide profile editing features and a verified DSAR workflow to execute corrections and erasures across primary and replica databases.',
  '["EVID-DSR-01"]'::jsonb, 'Refusing erasure requests without citing a valid statutory retention exception violates Section 12(3).',
  'Audit the end-to-end workflow from customer request to downstream database modification.', 'Failure to process correction or erasure requests exposes the fiduciary to regulatory orders.',
  'Build profile self-service editing workflows and establish technical propagation of erasures to Data Processors.', '["TLI-DPDP-FID-02", "TLI-DPDP-RET-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 21, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('da089eef-3841-5f78-adea-938378412427', 'ab68a890-9932-5775-bd04-d18bffdb0415', '42503c9f-3981-5641-8c1c-b98067825db2', 'TLI-DPDP-DSR-03', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 8(8), 13 r/w Rule 11', 'Grievance Redressal Mechanism and Officer Publication', 'Publish Grievance Officer details and maintain an SLA-tracked grievance redressal mechanism.',
  'MANDATORY_STATUTORY'::obligation_type, 'A Data Fiduciary must establish an effective grievance redressal mechanism and publish contact details of DPO or Grievance Officer. Must resolve complaints within prescribed SLA.',
  'Applies universally to all Data Fiduciaries.', 'Mandatory statutory duty.',
  'Has the organisation published the contact details of an authorized Grievance Officer and established an SLA-tracked grievance redressal ticketing system?', 'Publish the Grievance Officer''s name, email, and physical address prominently on websites/apps; maintain a ticketing SLA enforcing resolution within statutory limits.',
  '["EVID-NOT-01", "EVID-SOP-05"]'::jsonb, 'Generic ''support@company.com'' addresses without a designated human officer violate Section 8(8).',
  'Check public privacy notice footer and test grievance ticket routing.', 'Failure to provide grievance redressal allows Data Principals to escalate directly to the DPBI.',
  'Formally designate an India-based Grievance Officer and configure a privacy grievance queue in the ticketing system.', '["TLI-DPDP-NOT-01", "TLI-DPDP-SDF-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 22, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('daf6c3b0-a67c-5034-98ac-055adf23743c', 'ab68a890-9932-5775-bd04-d18bffdb0415', '42503c9f-3981-5641-8c1c-b98067825db2', 'TLI-DPDP-DSR-04', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 14 r/w Rule 15', 'Data Principal Right to Nominate', 'Enable Data Principals to nominate a representative to exercise rights upon death or incapacity.',
  'MANDATORY_STATUTORY'::obligation_type, 'A Data Principal shall have the right to nominate any other individual to exercise rights in the event of death or incapacity.',
  'Applies to user-account and consumer-facing platforms.', 'Mandatory statutory right under Section 14.',
  'Does the organisation provide an account feature or mechanism allowing Data Principals to nominate an individual to manage their personal data in the event of death or incapacity?', 'Introduce a digital nomination feature within account settings allowing users to designate a nominee with contact details.',
  '["EVID-DSR-01", "EVID-SOP-04"]'::jsonb, 'Lacking a nomination mechanism in consumer user accounts breaches Section 14.',
  'Verify account management screens and deceased account policy documentation.', 'Inability to honor lawful nominee claims violates Section 14.',
  'Add a ''Digital Nominee Designation'' section to user account profile settings.', '["TLI-DPDP-DSR-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 23, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('27329e3d-208f-53cb-833c-c7842347cffc', 'ab68a890-9932-5775-bd04-d18bffdb0415', '7886fc84-15a6-5821-8ea6-599309f6804f', 'TLI-DPDP-CHD-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 9(1) r/w Rule 12', 'Verifiable Parental Consent for Children and Disabled', 'Obtain verifiable parental or guardian consent before processing personal data of children or disabled persons.',
  'STATUTORY_EXCEPTION_CONDITIONAL'::obligation_type, 'A Data Fiduciary shall, before processing any personal data of a child (< 18 years) or a person with a disability, obtain verifiable consent of the parent or lawful guardian. Maximum penalty: ₹200 Crores.',
  'Applies to any organisation processing personal data of individuals under 18 years of age or persons with disabilities.', 'Conditional requirement; excludable only if factual proof confirms zero minor data.',
  'Does the organisation maintain an operational age-gating mechanism and a verifiable parental/guardian consent verification process before processing children''s personal data?', 'Deploy neutral age-screens and integrate government-approved parental verification mechanisms (e.g., DigiLocker tokenization, parental OTP verification).',
  '["EVID-CHD-01"]'::jsonb, 'Self-declaration checkboxes (''I am 18 or older'') without verification are insufficient for platforms accessible to minors.',
  'Review user onboarding flow and parental consent verification logs.', 'Processing child data without verifiable parental consent carries statutory penalties up to ₹200 Crores.',
  'Implement a robust age-assurance mechanism and establish a multi-step parental verification workflow.', '["TLI-DPDP-CHD-02", "TLI-DPDP-CON-01"]'::jsonb,
  'TIER_2_200CR'::penalty_tier, 1.25, 24, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-06; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('a161ebe4-48cc-59ef-a3a1-313cc691a9cf', 'ab68a890-9932-5775-bd04-d18bffdb0415', '7886fc84-15a6-5821-8ea6-599309f6804f', 'TLI-DPDP-CHD-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 9(2)-(3)', 'Prohibition on Child Tracking, Profiling and Targeted Ads', 'Enforce technical prohibitions on tracking, behavioural monitoring, and targeted advertising directed at children.',
  'STATUTORY_EXCEPTION_CONDITIONAL'::obligation_type, 'A Data Fiduciary shall not undertake tracking or behavioural monitoring of children or targeted advertising directed at children, nor undertake processing detrimental to child well-being. Maximum penalty: ₹200 Crores.',
  'Applies to entities whose digital platforms or apps are accessed by minors.', 'Mandatory conditional restriction.',
  'Are technical controls enforced to completely disable tracking scripts, behavioural analytics, user profiling, and targeted advertising whenever an account belongs to a minor?', 'Configure advertising SDKs and analytics pipelines to suppress tracking cookies, user profiling, and targeted ad servers for registered minors.',
  '["EVID-CHD-02"]'::jsonb, 'Serving targeted ads to accounts flagged as minors constitutes an immediate violation of Section 9(3).',
  'Audit network traffic and tracking SDK initialisation code for minor user profiles.', 'Direct violation of Section 9(3) subject to Tier 2 statutory penalty (up to ₹200 Crores).',
  'Hardcode a platform-wide privacy switch that disables all advertising identifiers and behavioral pixels for minor user IDs.', '["TLI-DPDP-CHD-01"]'::jsonb,
  'TIER_2_200CR'::penalty_tier, 1.25, 25, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('415117c9-d38e-5b4a-9642-1f1ad5e339da', 'ab68a890-9932-5775-bd04-d18bffdb0415', '612805de-1449-5e6e-b455-408d54116009', 'TLI-DPDP-SDF-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 10(1)-(2)(a)', 'Significant Data Fiduciary Governance (Resident DPO)', 'Appoint an India-resident Data Protection Officer reporting directly to the Board.',
  'SDF_MANDATORY_CONDITIONAL'::obligation_type, 'Significant Data Fiduciaries must appoint an India-based Data Protection Officer (DPO) who represents the fiduciary and reports directly to the Board of Directors or governing body.',
  'Mandatory for notified Significant Data Fiduciaries; advisory for prospective candidates.', 'Conditional on SDF designation or prospective candidacy.',
  'Has the organisation formally appointed an India-resident Data Protection Officer with independent reporting lines directly to the Board of Directors?', 'Issue formal board resolution appointing an India-resident DPO with direct reporting to the Board, adequate resources, and independence.',
  '["EVID-SDF-01"]'::jsonb, 'Designating a non-resident executive or subordinating the DPO to IT/marketing departments violates Section 10(2)(a).',
  'Inspect board minutes, employment contract, and organizational reporting hierarchy.', 'Operating as an SDF without a resident DPO breaches Section 10 obligations.',
  'Formalise the DPO role charter and ensure the designated individual is resident in India and reports to executive governance.', '["TLI-DPDP-SDF-02", "TLI-DPDP-DSR-03"]'::jsonb,
  'TIER_3_150CR'::penalty_tier, 1.0, 26, TRUE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-08; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('2576b1bc-1931-564c-8d1d-7b4a9cec992a', 'ab68a890-9932-5775-bd04-d18bffdb0415', '612805de-1449-5e6e-b455-408d54116009', 'TLI-DPDP-SDF-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 10(2)(b)-(c) r/w Rule 13', 'SDF Impact Assessments (DPIA) and Independent Audits', 'Conduct periodic Data Protection Impact Assessments and engage independent Data Auditors.',
  'SDF_MANDATORY_CONDITIONAL'::obligation_type, 'An SDF must appoint an independent Data Auditor to carry out data audits, and undertake periodic Data Protection Impact Assessments (DPIA).',
  'Mandatory for notified Significant Data Fiduciaries.', 'Conditional on SDF designation.',
  'Does the organisation conduct periodic Data Protection Impact Assessments (DPIAs) for high-risk processing activities and engage an independent Data Auditor for annual compliance audits?', 'Formulate an enterprise DPIA framework and execute formal engagement contracts with external independent privacy auditors.',
  '["EVID-SDF-02"]'::jsonb, 'Internal self-assessments cannot substitute for an independent data audit under Section 10(2)(b).',
  'Review DPIA documentation for high-risk deployments and external auditor findings.', 'Failure to conduct DPIAs or independent audits constitutes a material SDF violation under Section 10.',
  'Adopt an institutional DPIA methodology and establish a procurement schedule for independent annual data audits.', '["TLI-DPDP-SDF-01"]'::jsonb,
  'TIER_3_150CR'::penalty_tier, 1.0, 27, TRUE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-08; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('ff386dac-57c8-5a8e-b813-d4965529aadb', 'ab68a890-9932-5775-bd04-d18bffdb0415', '4fa0b148-6928-5701-8347-c94f4bfc923a', 'TLI-DPDP-XBD-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 16(1) r/w Rule 16', 'Cross-Border Data Transfers and Negative List', 'Enforce controls ensuring personal data is not transferred to blacklisted countries or territories.',
  'STATUTORY_EXCEPTION_CONDITIONAL'::obligation_type, 'The Central Government may restrict transfer of personal data outside India to notified countries/territories (negative list). Fiduciaries must not transfer personal data to blacklisted destinations.',
  'Applies to all organisations transferring digital personal data outside India.', 'Mandatory conditional restriction.',
  'Does the organisation maintain an inventory of all cross-border data flows and enforce controls ensuring personal data is not transferred to blacklisted countries?', 'Maintain a Cross-Border Data Transfer Register documenting destination countries, recipient entities, and technical safeguard mechanisms.',
  '["EVID-XBD-01", "EVID-ROPA-01"]'::jsonb, 'Unmonitored overseas SaaS usage where data destination is unknown violates Section 16.',
  'Audit network gateways, cloud region configurations, and offshore vendor contracts.', 'Unauthorised cross-border transfers to restricted jurisdictions breach Section 16 and trigger statutory sanctions.',
  'Implement technical cloud policies restricting data center provisioning to approved jurisdictions and document all outbound data flows.', '["TLI-DPDP-XBD-02", "TLI-DPDP-PRO-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 28, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-09; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('50225677-c520-5488-887f-9a1dabc4e6d4', 'ab68a890-9932-5775-bd04-d18bffdb0415', '4fa0b148-6928-5701-8347-c94f4bfc923a', 'TLI-DPDP-XBD-02', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Section 16(2) r/w Sectoral', 'Sectoral Data Localization Preservation', 'Comply with higher sectoral data localization mandates preserved under Section 16(2).',
  'STATUTORY_EXCEPTION_CONDITIONAL'::obligation_type, 'Nothing in Section 16(1) shall restrict the applicability of any law providing for a higher degree of protection or restriction on transfer (e.g. RBI payment data localization).',
  'Applies to regulated entities (banks, NBFCs, payment aggregators, insurance providers).', 'Sector-specific statutory preservation clause.',
  'Does the organisation comply with higher sectoral data localization mandates (such as RBI directives requiring payment data to be stored exclusively in India)?', 'Configure financial database clusters and primary transaction processing exclusively within sovereign Indian data centers.',
  '["EVID-XBD-02"]'::jsonb, 'Storing payment system logs exclusively in overseas cloud regions violates RBI directives preserved under Section 16(2).',
  'Review System Audit Reports (SAR) submitted to sectoral regulators (RBI, IRDAI, SEBI).', 'Sectoral localization violations trigger regulatory license suspension alongside DPDPA exposure.',
  'Ensure all payment transaction data and related audit trails reside strictly on domestic Indian servers.', '["TLI-DPDP-XBD-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 29, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Identified in LEG-INT-09; pending legal counsel verification.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,
  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,
  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,
  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,
  legal_review_status, methodology_review_status, review_notes)
VALUES ('c2ab5f10-54e9-5ecc-b4e9-bc6fc56b5091', 'ab68a890-9932-5775-bd04-d18bffdb0415', '5ec22c3b-65ef-5972-b22f-5635e03fbbd6', 'TLI-DPDP-PEN-01', '1.0.0',
  '35da98e6-57ea-5b48-9485-425fdc6aceaa', 'Schedule r/w Section 33', 'Statutory Penalty Deficit Exposure and Sanction Audit', 'Quantify potential statutory financial penalty exposure across statutory tiers and establish mitigating measures.',
  'MANDATORY_STATUTORY'::obligation_type, 'The Schedule establishes five statutory financial penalty tiers up to ₹250 Crores based on breach nature, gravity, duration, repetitive nature, and mitigating measures taken.',
  'Applies universally to all Data Fiduciaries and Processors.', 'Risk quantification and mitigation readiness.',
  'Has the organisation assessed its potential statutory penalty exposure across the five statutory tiers and established mitigating measures recognized under Section 28(2)?', 'Conduct periodic statutory risk modeling quantifying potential penalty liabilities and documenting proactive mitigating measures.',
  '["EVID-RSK-01", "EVID-SEC-01"]'::jsonb, 'Relying solely on cyber insurance without implementing technical mitigations does not satisfy DPBI mitigation criteria.',
  'Check whether compliance deficits in Sections 8(5), 8(6), and 9 are tracked as enterprise board-level risks.', 'Failure to remediate known statutory deficits constitutes a repetitive/aggravated factor under Section 28(2).',
  'Present quarterly DPDP statutory deficit registers to executive leadership and prioritize funding for high-penalty risk gaps.', '["TLI-DPDP-SEC-01", "TLI-DPDP-BRC-02", "TLI-DPDP-CHD-01"]'::jsonb,
  'TIER_4_50CR'::penalty_tier, 1.0, 30, FALSE,
  'PROVISIONAL_RESEARCH_COMPLETE', 'METHODOLOGY_REVIEW_PENDING', 'Awaiting final TLI legal review under DEC-08.')
ON CONFLICT (framework_version_id, code) DO UPDATE SET
  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,
  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,
  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,
  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,
  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;

-- 6. EVIDENCE CATALOGUE (27 CANONICAL EVIDENCE TYPES)
INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('18a0aa3e-e0cd-53b2-93b1-d7112b5de93e', 'EVID-ROPA-01', 'Data Processing Activities Inventory (RoPA)', 'Comprehensive structured inventory mapping personal data flows, processing purposes, legal grounds, storage repositories, processors, and retention periods.',
  '["TLI-DPDP-SCO-01", "TLI-DPDP-LGL-01", "TLI-DPDP-LEG-01", "TLI-DPDP-LEG-02", "TLI-DPDP-XBD-01"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Annual / Major Architecture Change', '["Enterprise data inventory spreadsheet", "Privacy management software export (e.g. OneTrust, TrustArc)", "Internal RoPA database report"]'::jsonb,
  'Enterprise Data Flow Diagrams (DFDs) paired with systems integration matrices.', '["Inspect whether each business unit (HR, IT, Marketing, FinTech) has contributed data flows.", "Verify that each activity lists a specific statutory ground (Section 6 Consent or Section 7 clause).", "Confirm that personal data categories (Identity, Financial, Device) are itemised."]'::jsonb,
  'High-level network topology diagrams that do not identify personal data elements or processing purposes fail this requirement.', 'Sanitize internal database IP addresses and credentials; ensure no live employee or customer records are present.',
  'Retain with assessment working papers for statutory audit lifecycle.', 'Cross-check RoPA entries against the controls evaluated in the assessment to ensure scope completeness.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('e3efd0cb-4f0f-5547-b9db-1507333f1477', 'EVID-NOT-01', 'Pre-Consent Itemised Notice Artifacts', 'Verifiable copies and UI screenshots of standalone pre-consent privacy notices presented to Data Principals at collection touchpoints.',
  '["TLI-DPDP-NOT-01", "TLI-DPDP-DSR-03"]'::jsonb, 'MANDATORY', 'TIER-1 (Public Governance)',
  'Current Live Production', '["High-resolution screenshots of live mobile app registration screens", "Web signup forms with standalone notice text", "Scanned paper onboarding consent sheets"]'::jsonb,
  'Staging/UAT environment walk-through video recordings with code commit hash tags.', '["Check that notice is presented before or at the time of consent capture.", "Verify presence of: (a) itemised personal data list, (b) specified purpose, (c) Section 11 rights description, (d) DPBI complaint procedure, (e) Grievance Officer details."]'::jsonb,
  'Submitting a general website footer link to a 20-page legal policy does not satisfy pre-consent notice requirements.', 'Ensure sample screenshots use dummy/synthetic user inputs (e.g., testuser@example.com).',
  'Historical screenshots must be version-linked to the corresponding notice revision.', 'Scrutinize the notice for bundled marketing consent or coercive language.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('baa2aee4-a24b-50d6-89a2-41cd0a406594', 'EVID-NOT-02', 'Multilingual Notice Mechanism Proof', 'Proof of technical capability allowing Data Principals to access notice contents in English or any of the 22 Eighth Schedule languages.',
  '["TLI-DPDP-NOT-03"]'::jsonb, 'MANDATORY', 'TIER-1 (Public Governance)',
  'Current Live Production', '["Screenshots of live language selector toggle displaying regional languages (Hindi, Tamil, Telugu, Bengali, etc.)", "Certified translation files integrated into CMS repository"]'::jsonb,
  'API documentation and UI walkthrough of localized CMS delivering regional language content based on browser preference.', '["Verify the language toggle provides accessibility across Eighth Schedule languages.", "Review sample regional translations to confirm they convey statutory notices accurately."]'::jsonb,
  'Relying on unconfigured generic third-party browser translation plugins without native platform support fails Section 5(3).', 'None (public UI artifacts).',
  'Maintain records of certified translations alongside release version numbers.', 'Test the toggle mechanism in consumer workflows.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('e2fbc2d7-863a-52c9-8ab1-d790689dff1d', 'EVID-NOT-03', 'Legacy User Grandfathering Notice Plan', 'Documented implementation plan and communication artifacts demonstrating delivery of post-enactment notices to data principals whose consent was acquired prior to commencement.',
  '["TLI-DPDP-NOT-02"]'::jsonb, 'CONDITIONAL', 'TIER-2 (Internal Confidential)',
  'One-time Campaign Record', '["Grandfathering notice campaign execution plan", "Draft email/SMS notification copy", "Email service provider dispatch telemetry logs (aggregated counts)", "Customer portal in-app notice push banners"]'::jsonb,
  'Staged communication rollout schedule approved by legal with pilot cohort delivery proof.', '["Inspect notice content for itemised categories, specified purposes, rights, and grievance contact.", "Confirm that delivery does not alter underlying service access pending principal review.", "Verify delivery tracking telemetry (aggregated counts, delivery success rates)."]'::jsonb,
  'Merely publishing a notice on a static website without dispatching notice directly to legacy users fails Section 5(2).', 'Mask individual recipient email addresses and telephone numbers; use synthetic dispatch samples.',
  'Retain campaign records for statutory audit and enforcement defense lifecycle.', 'Verify whether inactive or dormant user accounts are covered by the grandfathering notice campaign or targeted for erasure.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('28aa483a-28a3-5e6e-9c1e-7cbde4abcb44', 'EVID-CON-01', 'Affirmative Consent Capture UI Flow & Logs', 'Visual proof of unbundled, unticked consent UI and technical schema of immutable consent log receipts.',
  '["TLI-DPDP-CON-01", "TLI-DPDP-CON-03"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Current Live Production', '["UI screenshots showing unticked checkboxes alongside granular purpose toggles", "Database schema and sample JSON payload of a consent audit record (with timestamp, notice version, user ID, IP address)"]'::jsonb,
  'Automated Playwright/Cypress end-to-end consent test execution logs.', '["Verify that checkboxes are unchecked by default (zero dark patterns).", "Confirm that service provision is not conditioned upon consent for optional secondary purposes.", "Inspect consent log schema for timestamp, notice version ID, and affirmative action indicator."]'::jsonb,
  'Pre-ticked boxes or bundled ''I agree to all'' single checkboxes fail Section 6(1).', 'Sample database records must use synthetic user IDs (user_synthetic_001) and masked IP addresses (192.0.2.1).',
  'Consent records must be retained for the life of the processing activity plus statutory limitation periods.', 'Check whether consent can be proven in an adversarial DPBI dispute.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('a7b0fd68-a9a6-5b43-a2cb-89f9fa10de65', 'EVID-CON-02', 'Consent Withdrawal Interface & Workflow', 'Evidence of self-service consent revocation interfaces and backend workflows halting data processing upon withdrawal.',
  '["TLI-DPDP-CON-02"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Current Live Production', '["Screenshots of user account privacy settings showing 1-click consent toggle off", "Backend webhook documentation triggering data de-indexing and processing cessation"]'::jsonb,
  'Video recording of a test user revoking consent in a mobile application with immediate notification receipt.', '["Count clicks/actions required to grant consent vs clicks/actions required to revoke.", "Verify that withdrawal triggers automated message to downstream processors."]'::jsonb,
  'Forcing users to email support or call a contact center to withdraw consent given digitally violates the ''comparable ease'' test.', 'Use test accounts with synthetic profile data.',
  'Retain withdrawal audit logs for statutory compliance verification.', 'Test the withdrawal path in standard consumer accounts.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('0a79f76d-b036-523c-9e90-380d2d2518ee', 'EVID-DPA-01', 'Executed Data Processing Agreements (DPA)', 'Redacted copies of legally executed data processing contracts with key IT vendors, cloud hosts, and sub-processors.',
  '["TLI-DPDP-FID-01", "TLI-DPDP-PRO-01"]'::jsonb, 'MANDATORY', 'TIER-2 (Commercial Confidential)',
  'Valid Active Contract Term', '["Fully executed DPA addenda with cloud infrastructure providers (AWS, Azure, GCP)", "SaaS vendor DPAs (Salesforce, Workday)", "Third-party outsourcing processor contracts"]'::jsonb,
  'Standard Enterprise Service Agreements containing incorporated data protection schedules.', '["Inspect signature blocks for authorized client and vendor execution.", "Verify mandatory Rule 7 clauses: processing scope, confidentiality, technical security, breach notice SLA, audit rights, and sub-processor authorization."]'::jsonb,
  'Unsigned draft templates or standard clickwrap terms that lack breach notification commitments fail Section 8(2).', 'Redact commercial fee schedules and pricing terms. Maintain legal entity names and data protection clauses unredacted.',
  'Retain for the contract duration plus 3 years.', 'Ensure all processors identified in RoPA are covered by executed DPAs.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('f6c60b70-c16a-591c-adca-edb666603e87', 'EVID-SEC-01', 'Information Security Policy & TOMs Architecture', 'Formal board-approved information security policies detailing Technical and Organisational Measures (TOMs) deployed across enterprise assets.',
  '["TLI-DPDP-LGL-01", "TLI-DPDP-LEG-02", "TLI-DPDP-FID-01", "TLI-DPDP-SEC-01", "TLI-DPDP-PEN-01"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Annual Review', '["Approved Information Security Management System (ISMS) policy document", "Access control policy", "Network security architecture diagrams", "Patch management SOPs"]'::jsonb,
  'ISO/IEC 27001:2022 Statement of Applicability (SoA) and audit reports.', '["Verify executive sign-off and approval date.", "Review coverage of access control, vulnerability management, employee offboarding, and physical security."]'::jsonb,
  'Unapproved draft policy documents or policies that exist only on paper without technical enforcement fail this control.', 'Sanitize internal IP schemes, server hostnames, and specific perimeter firewall configurations.',
  'Maintain current version plus immediate preceding baseline.', 'Evaluate whether policies specifically address protection of personal data repositories.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('4476351e-add5-599c-b23b-e7b26d6b7061', 'EVID-SEC-02', 'Cryptographic Architecture & Key Governance', 'Technical architectural specifications documenting encryption at rest, encryption in transit, key lifecycle management, and HSM/KMS configurations.',
  '["TLI-DPDP-SEC-02"]'::jsonb, 'MANDATORY', 'TIER-2 (Restricted Security)',
  'Annual Review', '["Cloud KMS / HSM key rotation configuration screenshots", "TLS 1.3 enforcement policies and cipher suite configurations", "Database column-level encryption configurations"]'::jsonb,
  'SOC 2 Type II report detailing Trust Services Criteria CC6.1, CC6.6, and CC6.7 controls.', '["Verify algorithm strength (e.g., AES-256 for rest, TLS 1.2/1.3 with PFS for transit).", "Inspect automated key rotation schedules (annual or bi-annual).", "Confirm segregation of duties between cryptographic key custodians and database administrators."]'::jsonb,
  'Hardcoded keys in source code repositories or unrotated static master keys invalidate cryptographic assurance.', 'Redact master key IDs, secret material, and cloud account credentials. Retain configuration parameters and cipher names.',
  'Maintain architecture specs for current and immediately preceding baseline.', 'Verify whether cryptographic protections extend to off-site backups, snapshots, and disaster recovery replication targets.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('aec59fa7-72b9-5b83-b00a-73a65709468f', 'EVID-VAPT-01', 'Independent VAPT Audit Executive Summary', 'Executive summary and attestation letter from an independent cybersecurity auditing firm detailing annual VAPT results and vulnerability remediation status.',
  '["TLI-DPDP-SEC-01"]'::jsonb, 'MANDATORY', 'TIER-2 (Restricted Security)',
  'Within Last 12 Months', '["Executive summary of external network and web application penetration test conducted by a CERT-In empaneled or CREST accredited auditor", "Remediation verification letter from external security testing firm"]'::jsonb,
  'Comprehensive automated Dynamic Application Security Testing (DAST) and infrastructure vulnerability scanning summaries paired with internal security review.', '["Check testing scope to ensure personal data applications and databases are covered.", "Verify that all critical and high-severity vulnerabilities have been remediated or have documented mitigations."]'::jsonb,
  'Self-run automated vulnerability scans with unresolved critical CVEs do not satisfy independent verification.', 'Redact exploitable proof-of-concept payload strings and sensitive server credentials. Retain vulnerability counts, severity ratings, and auditor sign-off.',
  'Retain for 3 years to demonstrate continuous security governance.', 'Check specifically whether database exfiltration and unauthorized API access vulnerabilities were tested.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('9f33d6fd-c7a8-5f8c-9a93-0339cba04333', 'EVID-BRC-01', 'Personal Data Breach Incident Response Plan', 'Formal incident response plan establishing 24/7 detection, escalation, containment, and root-cause analysis for personal data security incidents.',
  '["TLI-DPDP-BRC-01"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Annual Review', '["CSIRT charter", "Incident classification matrix", "Step-by-step breach containment playbooks", "Breach escalation contact trees"]'::jsonb,
  'Enterprise Cyber Incident Response Plan containing a discrete Personal Data Breach Annex.', '["Verify inclusion of specific criteria defining a personal data breach under DPDPA Section 2(u).", "Check escalation path to legal, executive management, and DPO."]'::jsonb,
  'Generic IT disaster recovery plans that focus solely on system uptime without privacy triage fail this control.', 'Sanitize personal mobile numbers of crisis team members (retain titles and role designations).',
  'Maintain active version.', 'Verify whether the plan distinguishes between standard operational glitches and personal data breaches.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('8c672111-a06f-597b-8695-efbd63dbcb4f', 'EVID-BRC-02', 'Dual Breach Notification Playbook & Templates', 'Pre-drafted statutory breach notification templates and transmission protocols for intimating the Data Protection Board of India and affected Data Principals.',
  '["TLI-DPDP-BRC-02"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Current Ready State', '["Bilingual notification templates (English + Hindi)", "Bulk notification pipeline architectural specs", "DPBI digital portal dispatch SOP"]'::jsonb,
  'Incident ticketing system workflow configured with pre-populated regulatory notification forms.', '["Confirm templates contain mandatory statutory details: nature of breach, data categories compromised, potential consequences, mitigation steps, and DPO contact.", "Confirm existence of communication channels (bulk email, SMS, postal, portal banner) to reach Data Principals."]'::jsonb,
  'Planning to notify only the regulator while having no mechanism to notify individual Data Principals fails Section 8(6).', 'Fictional/template placeholder text only.',
  'Active document.', 'Check that the notification language is clear, non-technical, and provides actionable mitigation advice to Data Principals.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('b666f2f6-9132-54a8-85c4-1d4ae6816008', 'EVID-RET-01', 'Data Retention Schedule & Automated Purging Proof', 'Enterprise retention schedule defining maximum storage duration per personal data category, supported by automated technical purging configurations.',
  '["TLI-DPDP-RET-01"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Annual policy review; purging logs within last 3 months', '["Data Retention Policy matrix", "Database TTL (Time-To-Live) scripts", "Cloud lifecycle rule configuration screenshots (e.g. S3 expiration policies)", "Automated purging execution logs"]'::jsonb,
  'Third-party certified data destruction certificates paired with quarterly purge review logs.', '["Match retention periods against purposes declared in pre-consent notices.", "Inspect technical configuration (database triggers, cron jobs) proving automated erasure occurs."]'::jsonb,
  'Having a written policy that says ''data will be kept for 3 years'' while database records from 8 years ago remain active and unpurged fails Section 8(7).', 'Sanitize internal database connection strings.',
  'Maintain audit records of purged record counts.', 'Test whether data deletion applies to backups, read-replicas, and development environments.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('490b6dbb-f78b-5f65-938c-0aaf245d5034', 'EVID-RET-02', 'Statutory Retention Exceptions Register', 'Documented register identifying specific statutory enactments requiring retention beyond operational purpose fulfillment, alongside formal legal hold procedures.',
  '["TLI-DPDP-RET-02"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Annual Review', '["Legal hold policy", "Cross-statutory retention schedule citing specific Indian enactments (Companies Act 2013 Sec 128, Income-tax Act 1961 Sec 44AA, PMLA 2002 Sec 12)", "Active legal hold case registers"]'::jsonb,
  'General counsel legal opinion memorandum detailing sector-specific mandatory record retention statutes.', '["Verify each listed retention period cites an explicit primary statutory section, not generic business need.", "Confirm segregation and restricted access controls for data placed under legal hold.", "Verify release workflows triggering immediate erasure once statutory retention expires."]'::jsonb,
  'Citing vague operational convenience or undefined tax audit possibility without specific statutory citations fails Section 8(7).', 'Redact sensitive litigation matter names or privileged dispute details. Retain statutory citations and category mappings.',
  'Retain with legal department records.', 'Cross-check exception register against actual database records flagged for preservation.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('6efabe8b-9572-5290-9a52-8c53c69452e2', 'EVID-DSR-01', 'Data Principal Rights (DSAR) Portal & Logs', 'Operational intake portal, identity verification protocol, and request fulfillment tracking system for processing Data Principal rights.',
  '["TLI-DPDP-DSR-01", "TLI-DPDP-DSR-02", "TLI-DPDP-DSR-04"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Current Live Production', '["Public web intake form screenshots", "Privacy ticketing portal (e.g. Jira Service Management, Zendesk) configured with DSAR categories", "Anonymized completed request tickets"]'::jsonb,
  'Dedicated monitored email intake SOP paired with SLA tracking spreadsheet.', '["Test request intake channels across access, correction, erasure, and nomination.", "Confirm identity verification procedures do not demand excessive additional personal data.", "Verify statutory SLA tracking (resolution within statutory window)."]'::jsonb,
  'Having an email address listed in a privacy policy without any internal ticketing queue or backend fulfillment mechanism fails Section 11.', 'Anonymize all applicant names, emails, and ticket details in submitted operational samples.',
  'Retain DSAR audit records for 3 years to defend against DPBI complaint proceedings.', 'Verify that erasures approved through DSARs propagate downstream to Data Processors.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('976b1a87-82b8-5887-ac2b-df3a9c7365d6', 'EVID-SOP-01', 'Standard Operating Procedure (SOP) Collection', 'Suite of approved departmental standard operating procedures governing day-to-day personal data handling across business units.',
  '["TLI-DPDP-NOT-02", "TLI-DPDP-LEG-01"]'::jsonb, 'CONDITIONAL', 'TIER-2 (Internal Confidential)',
  'Within Last 24 Months', '["Approved SOPs for HR data intake", "Marketing lead acquisition SOPs", "Customer support data access procedures", "Vendor data sharing workflows"]'::jsonb,
  'Centralized corporate policy portal with mandatory employee acknowledgment and reading completion tracking.', '["Confirm documented workflow steps, responsible roles, and escalation thresholds.", "Verify evidence of operational distribution and employee access."]'::jsonb,
  'High-level abstract policies without step-by-step operational workflows do not qualify as SOPs.', 'None beyond internal department codes if proprietary.',
  'Maintain current active revisions.', 'Sample check employee adherence through interviews or audit records during on-site reviews.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('e12da318-4048-52a9-939c-6dd01f35de38', 'EVID-SOP-02', 'Data Quality & Deduplication SOP', 'Documented standard operating procedures and data validation rules ensuring personal data processed is accurate, complete, and consistent.',
  '["TLI-DPDP-FID-02"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Within Last 24 Months', '["ETL data cleansing pipeline documentation", "Master data management (MDM) deduplication rules", "Schema field validation scripts", "Data correction workflows"]'::jsonb,
  'Data governance quality dashboard reports displaying automated data integrity metrics.', '["Inspect data entry validation rules (e.g., regex checks, checksum validation).", "Verify automated deduplication routines across disparate database repositories.", "Confirm that data corrections submitted by Data Principals synchronize across all operational stores."]'::jsonb,
  'Absence of schema validation leading to truncated or corrupted customer profiles violates Section 8(3).', 'Sanitize database field names containing internal secrets; use synthetic record samples.',
  'Active document.', 'Check whether data shared with third-party processors is updated upon principal correction.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('c62321b4-ba49-59c1-8e95-32d1bd985639', 'EVID-SOP-03', 'Breach Escalation & Triage Protocol', 'Operational SOP defining specific technical criteria, severity matrices, and rapid escalation protocols for potential personal data breaches.',
  '["TLI-DPDP-BRC-02"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Annual Review', '["SOC tier-1 to tier-3 escalation playbooks", "Severity classification matrix (P1–P4)", "24/7 on-call rotation schedules"]'::jsonb,
  'PagerDuty/Opsgenie incident escalation policies configured for data privacy security triggers.', '["Verify criteria distinguishing privacy incidents from routine infrastructure alerts.", "Check automated alerting mechanisms to the Data Protection Officer and Legal Counsel.", "Confirm timeline milestones designed to achieve regulatory intimations without undue delay."]'::jsonb,
  'Escalation paths requiring multi-layer bureaucratic approvals before security notification commences violate statutory urgency.', 'Mask personal contact numbers; retain operational role titles.',
  'Active operational procedure.', 'Review tabletop exercise records to verify protocol execution fidelity.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('f15e51aa-aa39-5829-afee-3ee739293c6d', 'EVID-SOP-04', 'DSAR Fulfillment & Identity Verification SOP', 'Step-by-step operating procedure for intake, identity verification, scope determination, data retrieval, redaction, and transmission of Data Principal rights responses.',
  '["TLI-DPDP-DSR-01", "TLI-DPDP-DSR-04"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Annual Review', '["Detailed DSAR handling manual", "Identity verification decision matrix (knowledge-based, OTP, existing session)", "Response letter templates", "Refusal justification procedures"]'::jsonb,
  'Privacy management platform workflow diagram and configuration manual.', '["Confirm that identity verification requires only proportionate information necessary to authenticate the applicant.", "Verify third-party redaction steps ensuring one applicant does not receive another person''s personal data.", "Confirm documentation of grounds and communication workflows when a request is refused."]'::jsonb,
  'Demanding notarized affidavits or physical document submission for online digital users creates an impermissible barrier.', 'Blank templates and sanitized process flows only.',
  'Active operational procedure.', 'Test whether the procedure addresses requests submitted on behalf of deceased or incapacitated principals by lawful nominees under Section 14.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('05f9d362-b765-5a8f-a64f-b3fd46d1d17c', 'EVID-SOP-05', 'Grievance Redressal Ticketing SLA & Escalation', 'Standard operating procedure governing receipt, investigation, resolution, and escalation of complaints submitted under Section 13.',
  '["TLI-DPDP-DSR-03"]'::jsonb, 'MANDATORY', 'TIER-2 (Internal Confidential)',
  'Annual Review', '["Customer grievance handling policy", "Ticketing workflow with automated SLA timers", "Grievance escalation hierarchy", "DPBI referral advisory templates"]'::jsonb,
  'CRM customer support ticketing system SLA configuration and reporting metrics.', '["Verify maximum turnaround time aligns with statutory requirements (prescribed period under Rule 14).", "Confirm inclusion of mandatory statutory advisory informing complainant of their right to escalate unresolved grievances to the DPBI.", "Verify independent review capability for contested complaints."]'::jsonb,
  'Routing privacy complaints to general sales or unmonitored general email queues without tracking or statutory advisory fails Section 13.', 'Template workflows and anonymized aggregate SLA metrics only.',
  'Retain dispute logs for 3 years following resolution.', 'Scrutinize whether resolved complaint notifications clearly inform the Data Principal of their right to appeal to the Board.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('e6567f82-826a-56b2-b9bc-90946c106c11', 'EVID-CHD-01', 'Verifiable Parental Consent Architecture Flow', 'Architectural documentation, flowcharts, and live screenshots demonstrating verified parental or guardian consent before processing children''s data.',
  '["TLI-DPDP-CHD-01"]'::jsonb, 'CONDITIONAL', 'TIER-2 (Internal Confidential)',
  'Current Live Production', '["UI flowchart showing neutral age-screen", "Integration documentation with approved parental verification methods (e.g. DigiLocker parental relationship tokenization, dual-factor parent OTP)", "Sample synthetic verification records"]'::jsonb,
  'Third-party age assurance provider certification (e.g., Yoti, Veratad) integrated into onboarding.', '["Inspect the age-gating mechanism to confirm it cannot be bypassed by merely refreshing the page.", "Verify that consent request is routed to a verifiable parent/guardian before child account activation."]'::jsonb,
  'Relying on an unverified self-declaration checkbox (''I am 18 or older'') without technical verification fails Section 9(1).', 'Use synthetic minor and parent test accounts exclusively. Zero real children''s data.',
  'Retain parental verification tokens for the life of the child account.', 'Scrutinize the age-gating logic for vulnerabilities and dark patterns.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('7c87d30a-b1f9-58b2-a733-35b5803b1768', 'EVID-CHD-02', 'Child Tracking Suppression Technical Proof', 'Technical architectural specifications, code inspection records, and ad-tech configuration proofs demonstrating suppression of tracking, behavioural profiling, and targeted ads for minor accounts.',
  '["TLI-DPDP-CHD-02"]'::jsonb, 'CONDITIONAL', 'TIER-2 (Restricted Security)',
  'Current Live Production', '["Ad-server configuration files disabling retargeting pixel injection for accounts flagged as minors", "SDK initialization logs suppressing analytics tracking", "Database feature flags disabling recommendation algorithms for minor user segments"]'::jsonb,
  'Independent ad-tech audit report certifying zero behavioural tracking on minor account tiers.', '["Inspect frontend source code and network requests for minor accounts to verify absence of third-party tracking pixels.", "Verify ad server bidding request payloads confirm omission of behavioural segments.", "Inspect recommendation engine algorithms to ensure purely contextual, non-profiling logic."]'::jsonb,
  'Disabling ads on mobile apps while continuing behavioural tracking on web platforms violates Section 9(3).', 'Sanitize API keys and internal microservice endpoint URLs.',
  'Architecture baselines maintained per release.', 'Conduct dynamic traffic inspection using developer tools on synthetic minor user profiles.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('6386b574-575d-5635-8dc7-98c9ee657203', 'EVID-SDF-01', 'DPO Appointment Resolution & Reporting Charter', 'Certified copy of the Board of Directors resolution formally appointing an India-resident Data Protection Officer, accompanied by the DPO Governance Charter.',
  '["TLI-DPDP-SDF-01"]'::jsonb, 'CONDITIONAL', 'TIER-2 (Corporate Governance)',
  'Active Appointment Term', '["Extract of Board Meeting Minutes signed by Company Secretary", "DPO Job Charter establishing independent reporting to the Board", "Proof of India residency (e.g. resident employment contract extract)"]'::jsonb,
  'Executive appointment letter signed by CEO and Board Chairman.', '["Verify that the appointed DPO is resident in India.", "Confirm reporting hierarchy connects directly to the Board or governing body, not mid-level IT management.", "Verify that the DPO is empowered with independent authority and access to all processing streams."]'::jsonb,
  'Naming an overseas executive or assigning DPO duties to a marketing lead with conflicting business targets violates Section 10(2)(a).', 'Redact remuneration and personal compensation terms.',
  'Retain for the duration of the appointment plus 5 years.', 'Verify that contact details of the DPO match those published in the public privacy notice under Section 8(8).')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('d67a7e75-3790-5dce-b48f-e743cf24b485', 'EVID-SDF-02', 'DPIA Methodology & Completed Assessments', 'Formal DPIA framework methodology, assessment questionnaires, risk scoring rubrics, and copies of completed DPIA reports for high-risk processing activities.',
  '["TLI-DPDP-SDF-02"]'::jsonb, 'CONDITIONAL', 'TIER-2 (Internal Confidential)',
  'Within Last 12 Months', '["Approved DPIA Policy and Procedure", "Risk scoring matrix", "Completed DPIA reports for major automated processing, AI deployment, or biometrics initiatives", "Documented risk mitigation sign-offs"]'::jsonb,
  'ISO/IEC 27701 privacy risk assessments paired with executive DPIA summary.', '["Confirm DPIA assesses necessity, proportionality, data principal harm, and mitigation measures.", "Verify involvement and formal sign-off of the Data Protection Officer.", "Inspect implementation tracking of mitigation actions identified during the DPIA."]'::jsonb,
  'High-level checklists completed in minutes without technical architecture analysis or risk evaluation fail statutory DPIA requirements.', 'Redact trade secrets or unannounced proprietary product features; retain privacy impact analysis and risk ratings.',
  'Retain for the lifespan of the processing activity plus 5 years.', 'Evaluate whether DPIAs are initiated during design phases (Privacy by Design) or only retrospectively.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('3c111153-85bd-5645-a20a-02d6b8e7769a', 'EVID-XBD-01', 'Cross-Border Data Transfer Inventory', 'Comprehensive technical register detailing all outbound transfers of personal data outside India, including destination countries, transfer mechanisms, cloud hosting regions, and third-party recipients.',
  '["TLI-DPDP-SCO-01", "TLI-DPDP-XBD-01"]'::jsonb, 'CONDITIONAL', 'TIER-2 (Internal Confidential)',
  'Annual Review', '["Cross-border data mapping table", "Cloud region configuration reports (e.g., AWS global infrastructure inventory)", "SaaS vendor data residency matrices", "Network routing configurations"]'::jsonb,
  'Enterprise data flow diagrams explicitly labelling geographic boundaries and transit routes.', '["Match destination countries against Central Government notified negative list / restricted jurisdictions.", "Verify that transfers comply with applicable bilateral or sectoral transfer restrictions.", "Confirm that contractually bound foreign sub-processors adhere to DPDPA equivalent safeguards."]'::jsonb,
  'Assuming data stays in India without verifying actual backup, CDN cache, or analytics processing locations fails this control.', 'Sanitize internal server IPs and subnets; preserve country names and cloud regions.',
  'Active document.', 'Check where database backups, analytics logs, and customer support portal data reside.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('05657e64-ffa4-52a3-bda0-87a9c515b7e4', 'EVID-XBD-02', 'Sectoral Data Localization System Audit Report', 'Formal compliance audit report or regulatory filing attesting to strict domestic data localization mandated by sector-specific regulators (e.g., RBI payment system data directive, IRDAI insurance guidelines).',
  '["TLI-DPDP-XBD-02"]'::jsonb, 'CONDITIONAL', 'TIER-2 (Regulatory Audit)',
  'Within Last 12 Months', '["CERT-In empaneled System Audit Report (SAR) on RBI Storage of Payment System Data", "IRDAI data storage compliance certificate", "TRAI telecom data storage attestation"]'::jsonb,
  'Internal audit report signed by Chief Information Security Officer (CISO) and statutory auditors verifying domestic storage.', '["Confirm end-to-end data processing and storage resides strictly on servers physically located in India.", "Verify that cross-border processing for fraud detection or settlement adheres strictly to sectoral turnaround and deletion windows.", "Inspect auditor opinion and attestation signature blocks."]'::jsonb,
  'Claiming DPDPA Section 16 allows unrestricted transfers while ignoring strict RBI/IRDAI domestic storage mandates is legally invalid.', 'Redact commercial audit fee figures. Retain audit scope, findings, and auditor attestation.',
  'Retain for statutory regulatory retention period (minimum 5 years).', 'Cross-check with sectoral regulatory requirements applicable to the client''s industry.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,
  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,
  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)
VALUES ('320a50f7-0f4b-57a7-9fc6-a254e38efde5', 'EVID-RSK-01', 'Enterprise Statutory Penalty Deficit Exposure Risk', 'Executive-level risk exposure register quantifying organizational financial liability across the five Schedule penalty brackets based on identified compliance gaps.',
  '["TLI-DPDP-PEN-01"]'::jsonb, 'MANDATORY', 'TIER-2 (Corporate Risk)',
  'Bi-annual Executive Review', '["Enterprise risk register privacy addendum", "Board Audit Committee compliance presentation", "Executive gap analysis exposure dashboard", "TLI Gap Analysis Report executive briefing"]'::jsonb,
  'Chief Risk Officer (CRO) quarterly regulatory liability assessment memo.', '["Verify quantification of maximum exposure across statutory penalty brackets (₹250 Cr, ₹200 Cr, ₹150 Cr, ₹50 Cr, ₹10,000).", "Confirm linkage between unmitigated operational deficits and statutory exposure tiers.", "Verify reporting to Board Audit Committee or Chief Executive Officer."]'::jsonb,
  'Highlighting operational risks without quantifying statutory financial liability fails to drive board-level remediation.', 'Redact unapproved future budget allocations. Retain risk scores and exposure figures.',
  'Retain for 3 years.', 'Cross-reference the exposure model with the output of the TLI Provisional Scoring and Risk Engine.')
ON CONFLICT (evidence_type_id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,
  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,
  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;

