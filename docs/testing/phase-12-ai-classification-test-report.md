# Phase 12 AI Classification Test Report

Date: 2026-11-15

Status: complete and verified.

## Automated verification completed

- Python classifier tests: 5 passed.
- Python Ruff: passed.
- Python strict mypy: passed.
- Node API tests: 15 files, 35 tests passed.
- Node and React strict TypeScript checks: passed.
- Provider allow-list, invalid category, duplicate category, timeout fallback, immutable recommendation storage, and override-reason rules are covered.

## Live fallback verification completed

| Case | Result |
|---|---|
| AI service readiness without key | `configuration_required` |
| Direct classify call without key | `503` |
| Citizen complaint submission | `201` |
| Initial complaint classification state | `PENDING` |
| Complaint remains stored after AI failure | Passed |
| Background attempt stored | `FAILED` |
| Stored failure code | `AI_PROVIDER_NOT_CONFIGURED` |
| Complaint appears in Administrator review queue | Passed |
| Migration 008 ledger and table | Passed |
| Administrator manual fallback review | `200` |
| Final classification state | `APPROVED` |
| Immutable decision | `MANUAL`, override recorded |
| Reviewed complaint removed from queue | Passed |
| Duplicate review | `409` |
| Citizen review-queue access | `403` |
| Department Account review-queue access | `403` |

The test created one clearly named `Phase 12 AI fallback verification` complaint in the local development database.

## Remaining verification

No Phase 12 implementation verification remains. Formal model-accuracy evaluation remains unavailable until a suitable labelled dataset is approved.

No model-accuracy claim is made because no suitable labelled evaluation dataset has been approved.

## Provider compatibility correction

The first configured live call returned `400 INVALID_ARGUMENT` because the SDK serialized Pydantic `additionalProperties` through the older `response_schema` field. The same validated Pydantic JSON Schema was accepted through `response_json_schema`, which is now used by the implementation. The API key and selected model were independently confirmed valid without exposing the key.

## Live Gemini verification

| Synthetic complaint | Gemini recommendation | Human decision | Result |
|---|---|---|---|
| Uncollected household waste | Solid Waste Management | Approved | Final category approved and mapped department assigned |
| Broken public streetlight | Street/Public Lighting | Intentionally overridden to Building | Override reason stored; original recommendation preserved |

For both samples, the initial failed attempt and later valid attempt remain as separate immutable `ai_recommendations` rows, and one immutable `classification_reviews` row records the final decision. The test demonstrates workflow integrity, not general model accuracy.
