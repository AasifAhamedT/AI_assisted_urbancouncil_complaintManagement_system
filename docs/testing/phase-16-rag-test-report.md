# Phase 16 RAG Test Report

Status: complete and verified.

## Automated coverage

Final regression totals: 58 API tests, 2 frontend tests, and 7 RAG service tests passed. API/web production builds, Ruff, strict mypy, dependency checks, PowerShell parsing, and diff checks also passed.

- Express query schema accepts only a bounded question and rejects extra private-complaint fields.
- Administrator upload metadata is strict and bounded.
- Upload validation rejects executable types and mismatched filename/media/signature combinations.
- The authenticated actor ID, not a client-supplied identity, is forwarded for document audit.
- Unauthenticated document management returns `401`.
- FastAPI ingestion records a ready version, checksum, chunk count, current version, and active state.
- Deactivation removes the document from vector retrieval and marks it inactive without deleting audit history.
- Weak retrieval support returns the fixed abstention.
- Valid grounded output returns source/version/location citations.
- Invented model citation IDs are rejected and converted to abstention.
- Missing provider configuration returns a structured `503` without exposing secrets.
- Ruff and strict mypy pass for the RAG service.

## Live API verification

The private Gemini configuration reported `ready`, and the Phase 16 verification script completed successfully:

| Check | Result |
|---|---|
| RAG reachable and provider configured | Passed |
| Unauthenticated query | `401` |
| Department Account query | `403` |
| Citizen document-management access | `403` |
| Version 1 ingestion | `READY`, active, grounded citation returned |
| Unsupported private-information question | Abstained with no citations |
| Version 2 ingestion | `READY`; revised `B-17` facts used |
| Deactivated document | No longer supported new answers |
| Version 3 reactivation | Active and grounded |
| Version history | Three versions returned to Administrator |

The verification fixtures are explicitly synthetic academic content and state that they are not official Council procedure, policy, contact information, or public notices.

## Browser verification

- Citizen mobile chatbot returned `INDIGO-517` from the active version with document title, version, location, and excerpt.
- Administrator desktop governance showed active version 3, `READY`, chunk count, and all three version-history records.
- Citizen navigation exposed the document guide; Administrator navigation exposed knowledge governance.
- No horizontal overflow was detected at either tested viewport.
- No browser console errors or warnings were observed.
- Screenshots: [Citizen grounded answer](phase-16-browser-chatbot.png) and [Administrator version governance](phase-16-browser-knowledge.png).

## Test data note

One clearly labelled `Phase 16 Academic Verification Notice` remains active in the local authorized-document store with three traceable versions. No hard deletion was performed. The content contains no real complaint, resident, credential, or Council-policy data.
