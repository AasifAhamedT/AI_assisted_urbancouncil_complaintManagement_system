# AI Complaint Classification Design

## Purpose and decision boundary

The classifier is advisory. Gemini analyzes only the complaint title, complaint description, and the active category allow-list supplied by the backend. It cannot create categories, select a Department, authorize a user, or make the final administrative decision.

The Node API remains responsible for:

- verifying that the recommended category is still active;
- preserving every original recommendation or failure record;
- requiring Administrator review;
- resolving the final category through the configurable category-to-department mapping;
- recording the final review and any override reason;
- keeping complaint submission durable if AI is unavailable.

## Components

- `ClassificationStrategy`: provider-independent Python protocol.
- `GeminiClassifier`: Google GenAI SDK implementation.
- `ClassificationService` (Python): validates the provider output against the request allow-list.
- `AiClassifierClient` (Node): timeout-controlled REST adapter for the internal service.
- `ClassificationService` (Node): stores attempts, exposes the review queue, and applies Administrator decisions.
- `ai_recommendations`: immutable provider attempt records.
- `classification_reviews`: immutable final human-decision records.
- `complaints.category_id` and `assigned_department_id`: current final operational values.

## Structured provider contract

The Gemini request uses Pydantic structured output and low temperature. The model returns:

- recommended active category identifier;
- concise explanation;
- optional confidence estimate;
- ambiguity indicator;
- clarification indicator and optional question.

The confidence value is always displayed as an **uncalibrated model estimate**. It is not presented as measured accuracy or a statistically validated probability.

## Failure behavior

The following become immutable failed/invalid recommendation records and keep the complaint in Administrator review:

- provider not configured;
- timeout or network failure;
- rate limit or provider error;
- invalid structured response;
- unsupported or inactive category;
- no active categories.

Complaint creation returns successfully before background classification finishes. A classification failure never deletes, duplicates, or rolls back the complaint.

## Privacy and security

- The Gemini key exists only in the local AI-service environment.
- The browser and Node API never receive the key.
- Only complaint title, description, and active category definitions are sent for classification.
- Raw SDK objects are not stored. `raw_response` contains only the already validated, sanitized model fields.
- Only Administrators may access review APIs or make final decisions.

## Accuracy limitation

No labelled evaluation dataset is currently available. The project therefore makes no model-accuracy claim. Realistic behavior tests validate contracts and safety fallbacks, not predictive accuracy.
