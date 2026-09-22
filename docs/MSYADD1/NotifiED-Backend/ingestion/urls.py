from django.urls import path
from . import views

urlpatterns = [
    path(
        'approved-events/',
        views.fetch_approved_events,
        name='fetch_approved_events'
    ),

    path(
        'interpret/',
        views.interpret_pending_content,
        name='interpret_pending_content'
    ),

    path(
        'webhook/admin-event/',
        views.admin_event_webhook,
        name='admin_event_webhook'
    ),
    path(
    'retry-pending/',
    views.retry_pending_content,
    name='retry_pending_content'
),
]