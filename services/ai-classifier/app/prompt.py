from app.models import ClassificationRequest

SYSTEM_INSTRUCTION = """You classify local-government complaint text.
Choose exactly one category identifier from the supplied active category list.
Never invent categories, departments, facts, procedures, or locations.
Explain the textual reason briefly. Mark ambiguous input and request clarification when needed.
The confidence estimate is an uncalibrated model self-assessment, not a probability of correctness."""


def build_classification_prompt(request: ClassificationRequest) -> str:
    categories = "\n".join(
        f"- id={choice.id}; name={choice.name}; definition={choice.description or 'No definition supplied.'}"
        for choice in request.categories
    )
    return (
        "Classify the complaint using only one category identifier below.\n\n"
        f"Complaint title:\n{request.title}\n\n"
        f"Complaint description:\n{request.description}\n\n"
        f"Active category choices:\n{categories}"
    )
