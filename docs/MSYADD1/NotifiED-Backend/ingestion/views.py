import json
import requests
import google.generativeai as genai
import secrets
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from pydantic import BaseModel, ValidationError
from typing import Optional


# ============================================================

# CONFIGURATION

# ============================================================


genai.configure(api_key=settings.GEMINI_API_KEY)


# ============================================================

# 2. ADMIN TEAM APPROVED EVENT INGESTION

# ============================================================


def fetch_approved_events(request):

    """
    Fetch approved events from the Admin team's Supabase.

    Each approved event is converted into raw text and placed
    into NotifiED's source_content table with a pending status.
    Gemini will interpret it in the next stage.

    """
    # --------------------------------------------------------

    # Get approved events from Admin team's Supabase

    # --------------------------------------------------------



    try:

        admin_response = requests.get(

            f"{settings.ADMIN_SUPABASE_URL}/rest/v1/events",

            headers={

                "apikey": settings.ADMIN_SUPABASE_KEY,

                "Authorization": (

                    f"Bearer {settings.ADMIN_SUPABASE_KEY}"

                ),

            },

            params={

                "select": "*",

                "status": "eq.approved",

            },

            timeout=10,

        )



    except requests.RequestException as error:

        return JsonResponse({

            "error": "Could not connect to Admin Supabase",

            "detail": str(error),

        }, status=500)



    if admin_response.status_code != 200:

        return JsonResponse({

            "error": "Failed to fetch approved events",

            "status": admin_response.status_code,

            "detail": admin_response.text,

        }, status=500)



    events = admin_response.json()



    inserted = []

    skipped = []

    errors = []



    # Headers for OUR NotifiED Supabase

    notified_headers = {

        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,

        "Authorization": (

            f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"

        ),

        "Content-Type": "application/json",

        "Prefer": "return=representation",

    }



    # --------------------------------------------------------

    # Process each approved Admin event

    # --------------------------------------------------------



    for event in events:



        event_id = event.get("event_id")



        # Example:

        # admin_event_13

        source_reference = f"admin_event_{event_id}"



        # ----------------------------------------------------

        # Check if we already imported this Admin event

        # ----------------------------------------------------



        try:

            existing_response = requests.get(

                f"{settings.SUPABASE_URL}/rest/v1/source_content",

                headers=notified_headers,

                params={

                    "select": "source_content_id",

                    "source_reference": (

                        f"eq.{source_reference}"

                    ),

                },

                timeout=10,

            )



        except requests.RequestException as error:

            errors.append({

                "event_id": event_id,

                "title": event.get("title"),

                "detail": str(error),

            })

            continue



        if existing_response.status_code != 200:

            errors.append({

                "event_id": event_id,

                "title": event.get("title"),

                "status": existing_response.status_code,

                "detail": existing_response.text,

            })

            continue



        existing_rows = existing_response.json()



        # Skip duplicates

        if existing_rows:

            skipped.append({

                "event_id": event_id,

                "title": event.get("title"),

            })

            continue



        # ----------------------------------------------------

        # Convert Admin event into raw text

        # ----------------------------------------------------



        registration_link = (

            event.get("external_registration_link")

            or event.get("registration_link")

            or ""

        )



        raw_text = (

            f"Title: {event.get('title') or ''}\n"

            f"Organization: {event.get('organization') or ''}\n"

            f"Description: {event.get('description') or ''}\n"

            f"Event Date: {event.get('event_date') or ''}\n"

            f"Start Time: {event.get('start_time') or ''}\n"

            f"End Time: {event.get('end_time') or ''}\n"

            f"Venue: {event.get('venue') or ''}\n"

            f"Registration Link: {registration_link}"

        )



        payload = {

            "source_type": "text",

            "source_reference": source_reference,

            "raw_text": raw_text,

            "processing_status": "pending",

        }



        # ----------------------------------------------------

        # Insert into OUR source_content

        # ----------------------------------------------------



        try:

            insert_response = requests.post(

                f"{settings.SUPABASE_URL}/rest/v1/source_content",

                headers=notified_headers,

                json=payload,

                timeout=10,

            )



        except requests.RequestException as error:

            errors.append({

                "event_id": event_id,

                "title": event.get("title"),

                "detail": str(error),

            })

            continue



        if insert_response.status_code in (200, 201):



            inserted.append({

                "event_id": event_id,

                "title": event.get("title"),

            })



        else:



            errors.append({

                "event_id": event_id,

                "title": event.get("title"),

                "status": insert_response.status_code,

                "detail": insert_response.text,

            })



    return JsonResponse({

        "approved_events_found": len(events),

        "inserted_count": len(inserted),

        "skipped_count": len(skipped),

        "error_count": len(errors),

        "inserted": inserted,

        "skipped": skipped,

        "errors": errors,

    })





# ============================================================

# 3. GEMINI AI DATA STRUCTURE

# ============================================================



class InterpretedPost(BaseModel):

    type: str

    title: str

    description: Optional[str] = None

    organization_name: Optional[str] = None

    event_date: Optional[str] = None

    start_time: Optional[str] = None

    location: Optional[str] = None

    priority: Optional[str] = "medium"





# ============================================================

# 4. GEMINI PROMPT

# ============================================================



PROMPT_TEMPLATE = """

You are interpreting campus information for the NotifiED application.



The input may contain official information from an approved campus event

or information collected from another campus source.



Your tasks:



1. Classify the content as either "event" or "announcement".



2. Extract the information into the required structure.



3. Do NOT change explicit factual information from the source.



4. Preserve the following information when it is explicitly provided:

   - title

   - organization

   - event date

   - start time

   - location



5. Determine an appropriate priority based on the content.



6. Do not invent information that is not provided.



Respond ONLY with valid JSON.



Do not include Markdown.

Do not include explanations.



Use exactly this structure:



{{

    "type": "event",

    "title": "string",

    "description": "string or null",

    "organization_name": "string or null",

    "event_date": "YYYY-MM-DD or null",

    "start_time": "HH:MM or null",

    "location": "string or null",

    "priority": "medium"

}}



"type" must be one of:

- event

- announcement



"priority" must be one of:

- low

- medium

- high



Raw campus information:



{raw_text}

"""



# ============================================================
# 5. GEMINI AI PROCESSING
# ============================================================

def _notified_headers(prefer_representation=False):
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    if prefer_representation:
        headers["Prefer"] = "return=representation"

    return headers


def process_source_content(row):
    """
    Process exactly ONE source_content row.

    The automatic webhook uses this function so simultaneous approvals
    do not process the same list of pending rows.
    """

    source_content_id = row.get("source_content_id")
    raw_text = row.get("raw_text", "")

    if not source_content_id:
        return {
            "status": "invalid_source_row",
            "error": "source_content_id is missing",
        }

    headers = _notified_headers()

    if row.get("processing_status") == "processed":
        return {
            "source_content_id": source_content_id,
            "status": "already_processed",
        }

    # Claim this row. Only a row that is still pending can be claimed.
    # This prevents two requests from processing the same source row.
    try:
        claim_response = requests.patch(
            f"{settings.SUPABASE_URL}/rest/v1/source_content",
            headers={
                **headers,
                "Prefer": "return=representation",
            },
            params={
                "source_content_id": f"eq.{source_content_id}",
                "processing_status": "eq.pending",
            },
            json={
                "processing_status": "processing"
            },
            timeout=10,
        )
    except requests.RequestException as error:
        return {
            "source_content_id": source_content_id,
            "status": "claim_connection_error",
            "error": str(error),
        }

    if claim_response.status_code not in (200, 204):
        return {
            "source_content_id": source_content_id,
            "status": "claim_failed",
            "http_status": claim_response.status_code,
            "detail": claim_response.text,
        }

    claimed_rows = claim_response.json() if claim_response.content else []

    if not claimed_rows:
        return {
            "source_content_id": source_content_id,
            "status": "already_claimed_or_not_pending",
        }

    model = genai.GenerativeModel("gemini-3.1-flash-lite")
    prompt = PROMPT_TEMPLATE.format(raw_text=raw_text)

    try:
        gemini_response = model.generate_content(prompt)
        cleaned = gemini_response.text.strip()

        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]

        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        cleaned = cleaned.strip()

        parsed_json = json.loads(cleaned)
        structured = InterpretedPost(**parsed_json)

    except (ValidationError, json.JSONDecodeError) as error:
        try:
            requests.patch(
                f"{settings.SUPABASE_URL}/rest/v1/source_content",
                headers=headers,
                params={"source_content_id": f"eq.{source_content_id}"},
                json={"processing_status": "failed"},
                timeout=10,
            )
        except requests.RequestException:
            pass

        return {
            "source_content_id": source_content_id,
            "status": "invalid_ai_response",
            "error": str(error),
        }

    except Exception as error:
        # Temporary Gemini/API errors are retryable.
        try:
            requests.patch(
                f"{settings.SUPABASE_URL}/rest/v1/source_content",
                headers=headers,
                params={"source_content_id": f"eq.{source_content_id}"},
                json={"processing_status": "pending"},
                timeout=10,
            )
        except requests.RequestException:
            pass

        return {
            "source_content_id": source_content_id,
            "status": "gemini_error",
            "error": str(error),
        }

    content_type = structured.type.lower()

    if content_type not in ("event", "announcement"):
        try:
            requests.patch(
                f"{settings.SUPABASE_URL}/rest/v1/source_content",
                headers=headers,
                params={"source_content_id": f"eq.{source_content_id}"},
                json={"processing_status": "failed"},
                timeout=10,
            )
        except requests.RequestException:
            pass

        return {
            "source_content_id": source_content_id,
            "status": "invalid_type",
            "type": structured.type,
        }

    table = "event" if content_type == "event" else "announcement"

    # Code-level duplicate check.
    try:
        duplicate_response = requests.get(
            f"{settings.SUPABASE_URL}/rest/v1/{table}",
            headers=headers,
            params={
                "select": "source_content_id",
                "source_content_id": f"eq.{source_content_id}",
                "limit": "1",
            },
            timeout=10,
        )
    except requests.RequestException as error:
        try:
            requests.patch(
                f"{settings.SUPABASE_URL}/rest/v1/source_content",
                headers=headers,
                params={"source_content_id": f"eq.{source_content_id}"},
                json={"processing_status": "pending"},
                timeout=10,
            )
        except requests.RequestException:
            pass

        return {
            "source_content_id": source_content_id,
            "status": "duplicate_check_connection_error",
            "error": str(error),
        }

    if duplicate_response.status_code == 200 and duplicate_response.json():
        try:
            requests.patch(
                f"{settings.SUPABASE_URL}/rest/v1/source_content",
                headers=headers,
                params={"source_content_id": f"eq.{source_content_id}"},
                json={"processing_status": "processed"},
                timeout=10,
            )
        except requests.RequestException:
            pass

        return {
            "source_content_id": source_content_id,
            "table": table,
            "status": "already_inserted",
        }

    payload = {
        "source_content_id": source_content_id,
        "organization_name":
            structured.organization_name
            or row.get("source_reference"),
        "title": structured.title,
        "priority": structured.priority or "medium",
    }

    if table == "event":
        payload["description"] = structured.description
        payload["event_date"] = structured.event_date
        payload["start_time"] = structured.start_time
        payload["location"] = structured.location
    else:
        payload["content"] = structured.description

    try:
        insert_response = requests.post(
            f"{settings.SUPABASE_URL}/rest/v1/{table}",
            headers=_notified_headers(prefer_representation=True),
            json=payload,
            timeout=10,
        )
    except requests.RequestException as error:
        try:
            requests.patch(
                f"{settings.SUPABASE_URL}/rest/v1/source_content",
                headers=headers,
                params={"source_content_id": f"eq.{source_content_id}"},
                json={"processing_status": "pending"},
                timeout=10,
            )
        except requests.RequestException:
            pass

        return {
            "source_content_id": source_content_id,
            "status": "insert_connection_error",
            "error": str(error),
        }

    if insert_response.status_code not in (200, 201):
        try:
            requests.patch(
                f"{settings.SUPABASE_URL}/rest/v1/source_content",
                headers=headers,
                params={"source_content_id": f"eq.{source_content_id}"},
                json={"processing_status": "pending"},
                timeout=10,
            )
        except requests.RequestException:
            pass

        return {
            "source_content_id": source_content_id,
            "table": table,
            "status": "insert_failed",
            "http_status": insert_response.status_code,
            "detail": insert_response.text,
        }

    try:
        update_response = requests.patch(
            f"{settings.SUPABASE_URL}/rest/v1/source_content",
            headers=headers,
            params={"source_content_id": f"eq.{source_content_id}"},
            json={"processing_status": "processed"},
            timeout=10,
        )
        update_success = update_response.status_code in (200, 204)
    except requests.RequestException:
        update_success = False

    return {
        "source_content_id": source_content_id,
        "table": table,
        "status":
            "processed"
            if update_success
            else "inserted_but_status_update_failed",
    }


def process_pending_content():
    """
    Manual/recovery processor.

    Finds all pending source_content rows and processes each one
    individually through process_source_content().
    """

    headers = _notified_headers()

    try:
        pending_response = requests.get(
            f"{settings.SUPABASE_URL}/rest/v1/source_content",
            headers=headers,
            params={
                "select": "*",
                "processing_status": "eq.pending",
            },
            timeout=10,
        )
    except requests.RequestException as error:
        return JsonResponse({
            "error": "Could not connect to NotifiED Supabase",
            "detail": str(error),
        }, status=500)

    if pending_response.status_code != 200:
        return JsonResponse({
            "error": "Failed to retrieve pending content",
            "status": pending_response.status_code,
            "detail": pending_response.text,
        }, status=500)

    pending_rows = pending_response.json()

    results = [
        process_source_content(row)
        for row in pending_rows
    ]

    processed_count = len([
        result
        for result in results
        if result.get("status") in (
            "processed",
            "already_inserted",
            "already_processed",
        )
    ])

    return JsonResponse({
        "pending_found": len(pending_rows),
        "processed_count": processed_count,
        "results": results,
    })


# ============================================================

# 6. MANUAL AI INTERPRETATION ENDPOINT

# ============================================================



def interpret_pending_content(request):

    """

    Manual endpoint for processing pending content.



    This keeps /ingestion/interpret/ working for testing

    and manual retries.



    Later, the webhook can call process_pending_content()

    automatically.

    """



    return process_pending_content()

# ============================================================

# 7. ADMIN EVENT WEBHOOK

# ============================================================



@csrf_exempt

@require_POST

def admin_event_webhook(request):

    """

    Receive an event update from the Admin team's Supabase.



    If the event is approved:

    1. Check for duplicates.

    2. Insert it into source_content.

    3. Automatically run AI interpretation.

    """



    # --------------------------------------------------------
    # Verify webhook secret
    # --------------------------------------------------------

    received_secret = request.headers.get("X-Webhook-Secret")

    if not received_secret:
        return JsonResponse({
            "error": "Missing webhook secret"
        }, status=401)

    configured_secret = getattr(settings, "ADMIN_WEBHOOK_SECRET", None)

    if not configured_secret:
        return JsonResponse({
            "error": "Webhook secret is not configured"
        }, status=500)

    if not secrets.compare_digest(
        received_secret,
        configured_secret
    ):
        return JsonResponse({
            "error": "Invalid webhook secret"
        }, status=403)


    # --------------------------------------------------------

    # Read webhook JSON

    # --------------------------------------------------------



    try:

        webhook_data = json.loads(request.body)



    except json.JSONDecodeError:

        return JsonResponse({

            "error": "Invalid JSON"

        }, status=400)



    # Supabase Database Webhooks normally place the changed

    # database row inside "record".

    event = webhook_data.get("record")



    if not event:

        return JsonResponse({

            "error": "Webhook does not contain an event record"

        }, status=400)



    # --------------------------------------------------------

    # Only process approved events

    # --------------------------------------------------------



    if event.get("status") != "approved":

        return JsonResponse({

            "message": "Event ignored because it is not approved"

        })



    event_id = event.get("event_id")



    if not event_id:

        return JsonResponse({

            "error": "Event does not contain event_id"

        }, status=400)



    source_reference = f"admin_event_{event_id}"



    headers = {

        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,

        "Authorization": (

            f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"

        ),

        "Content-Type": "application/json",

        "Prefer": "return=representation",

    }



    # --------------------------------------------------------

    # Check if this event was already imported

    # --------------------------------------------------------



    try:

        existing_response = requests.get(

            f"{settings.SUPABASE_URL}/rest/v1/source_content",

            headers=headers,

            params={

                "select": "source_content_id",

                "source_reference": f"eq.{source_reference}",

            },

            timeout=10,

        )



    except requests.RequestException as error:

        return JsonResponse({

            "error": "Could not check existing source content",

            "detail": str(error),

        }, status=500)



    if existing_response.status_code != 200:

        return JsonResponse({

            "error": "Failed to check existing source content",

            "detail": existing_response.text,

        }, status=500)



    if existing_response.json():

        return JsonResponse({

            "message": "Event already imported",

            "event_id": event_id,

            "source_reference": source_reference,

        })



    # --------------------------------------------------------

    # Convert Admin event into raw campus information

    # --------------------------------------------------------



    registration_link = (

        event.get("external_registration_link")

        or event.get("registration_link")

        or ""

    )



    raw_text = (

        f"Title: {event.get('title') or ''}\n"

        f"Organization: {event.get('organization') or ''}\n"

        f"Description: {event.get('description') or ''}\n"

        f"Event Date: {event.get('event_date') or ''}\n"

        f"Start Time: {event.get('start_time') or ''}\n"

        f"End Time: {event.get('end_time') or ''}\n"

        f"Venue: {event.get('venue') or ''}\n"

        f"Registration Link: {registration_link}"

    )



    payload = {

        "source_type": "text",

        "source_reference": source_reference,

        "raw_text": raw_text,

        "processing_status": "pending",

    }



    # --------------------------------------------------------

    # Insert into NotifiED source_content

    # --------------------------------------------------------



    try:

        insert_response = requests.post(

            f"{settings.SUPABASE_URL}/rest/v1/source_content",

            headers=headers,

            json=payload,

            timeout=10,

        )



    except requests.RequestException as error:

        return JsonResponse({

            "error": "Could not insert source content",

            "detail": str(error),

        }, status=500)



    if insert_response.status_code not in (200, 201):

        return JsonResponse({

            "error": "Failed to insert source content",

            "status": insert_response.status_code,

            "detail": insert_response.text,

        }, status=500)



    # --------------------------------------------------------

    # Automatically start Gemini processing

    # --------------------------------------------------------



    try:
        inserted_rows = insert_response.json()
    except ValueError:
        inserted_rows = []

    if not inserted_rows:
        return JsonResponse({
            "error": "Source content was inserted but its row was not returned",
            "event_id": event_id,
            "source_reference": source_reference,
        }, status=500)

    inserted_row = inserted_rows[0]
    ai_result = process_source_content(inserted_row)



    return JsonResponse({

        "message": "Approved event received",

        "event_id": event_id,

        "source_reference": source_reference,

        "ai_processing": ai_result,

    }, status=201)
# ============================================================
# 8. AUTOMATIC PENDING RETRY ENDPOINT
# ============================================================

@csrf_exempt
@require_POST
def retry_pending_content(request):
    """
    Automatically retry source_content rows that are still pending.

    Intended to be called by a scheduler.
    """

    received_secret = request.headers.get("X-Webhook-Secret")

    if not received_secret:
        return JsonResponse({
            "error": "Missing webhook secret"
        }, status=401)

    configured_secret = getattr(
        settings,
        "ADMIN_WEBHOOK_SECRET",
        None
    )

    if not configured_secret:
        return JsonResponse({
            "error": "Webhook secret is not configured"
        }, status=500)

    if not secrets.compare_digest(
        received_secret,
        configured_secret
    ):
        return JsonResponse({
            "error": "Invalid webhook secret"
        }, status=403)

    return process_pending_content()