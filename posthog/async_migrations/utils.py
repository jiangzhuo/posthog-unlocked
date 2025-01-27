from datetime import datetime
from typing import Optional

from constance import config
from django.db import transaction

from posthog.async_migrations.definition import AsyncMigrationOperation
from posthog.async_migrations.setup import DEPENDENCY_TO_ASYNC_MIGRATION
from posthog.celery import app
from posthog.constants import AnalyticsDBMS
from posthog.models.async_migration import AsyncMigration, MigrationStatus


def execute_op(op: AsyncMigrationOperation, uuid: str, rollback: bool = False):
    """
    Execute the fn or rollback_fn
    """
    op.rollback_fn(uuid) if rollback else op.fn(uuid)


def execute_op_clickhouse(sql: str, query_id: str, timeout_seconds: int):
    from ee.clickhouse.client import sync_execute

    sync_execute(f"/* {query_id} */ " + sql, settings={"max_execution_time": timeout_seconds})


def execute_op_postgres(sql: str, query_id: str):
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(f"/* {query_id} */ " + sql)


def process_error(migration_instance: AsyncMigration, error: Optional[str], rollback: bool = True):
    update_async_migration(
        migration_instance=migration_instance,
        status=MigrationStatus.Errored,
        last_error=error or "",
        finished_at=datetime.now(),
    )

    if not rollback or getattr(config, "ASYNC_MIGRATIONS_DISABLE_AUTO_ROLLBACK"):
        return

    from posthog.async_migrations.runner import attempt_migration_rollback

    attempt_migration_rollback(migration_instance)


def can_resume_migration(migration_instance: AsyncMigration):
    from posthog.async_migrations.runner import is_current_operation_resumable

    if not is_current_operation_resumable(migration_instance):
        return False, "Can't resume a migration because the current operation isn't resumable"
    return True, ""


def trigger_migration(migration_instance: AsyncMigration, fresh_start: bool = True):
    from posthog.tasks.async_migrations import run_async_migration

    task = run_async_migration.delay(migration_instance.name, fresh_start)

    update_async_migration(
        migration_instance=migration_instance, celery_task_id=str(task.id),
    )


def force_stop_migration(
    migration_instance: AsyncMigration, error: str = "Force stopped by user", rollback: bool = True
):
    """
    In theory this is dangerous, as it can cause another task to be lost
    `revoke` with `terminate=True` kills the process that's working on the task
    and there's no guarantee the task will not already be done by the time this happens.
    See: https://docs.celeryproject.org/en/stable/reference/celery.app.control.html#celery.app.control.Control.revoke
    However, this is generally ok for us because:
    1. Given these are long-running migrations, it is statistically unlikely it will complete during in between
    this call and the time the process is killed
    2. Our Celery tasks are not essential for the functioning of PostHog, meaning losing a task is not the end of the world
    """

    app.control.revoke(migration_instance.celery_task_id, terminate=True)
    process_error(migration_instance, error, rollback=rollback)


def rollback_migration(migration_instance: AsyncMigration, force: bool = False):
    from posthog.async_migrations.runner import attempt_migration_rollback

    attempt_migration_rollback(migration_instance, force=force)


def complete_migration(migration_instance: AsyncMigration):
    update_async_migration(
        migration_instance=migration_instance,
        status=MigrationStatus.CompletedSuccessfully,
        finished_at=datetime.now(),
        progress=100,
    )

    from posthog.async_migrations.runner import run_next_migration

    next_migration = DEPENDENCY_TO_ASYNC_MIGRATION.get(migration_instance.name)

    if next_migration:
        run_next_migration(next_migration)


def mark_async_migration_as_running(migration_instance: AsyncMigration):
    update_async_migration(
        migration_instance=migration_instance,
        last_error="",
        current_query_id="",
        progress=0,
        current_operation_index=0,
        status=MigrationStatus.Running,
        started_at=datetime.now(),
        finished_at=None,
    )


def update_async_migration(
    migration_instance: AsyncMigration,
    last_error: Optional[str] = None,
    current_query_id: Optional[str] = None,
    celery_task_id: Optional[str] = None,
    progress: Optional[int] = None,
    current_operation_index: Optional[int] = None,
    status: Optional[int] = None,
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
    lock_row: bool = True,
):
    def execute_update():
        instance = migration_instance
        if lock_row:
            instance = AsyncMigration.objects.select_for_update().get(pk=migration_instance.pk)
        else:
            instance.refresh_from_db()
        if last_error is not None:
            instance.last_error = last_error
        if current_query_id is not None:
            instance.current_query_id = current_query_id
        if celery_task_id is not None:
            instance.celery_task_id = celery_task_id
        if progress is not None:
            instance.progress = progress
        if current_operation_index is not None:
            instance.current_operation_index = current_operation_index
        if status is not None:
            instance.status = status
        if started_at is not None:
            instance.started_at = started_at
        if finished_at is not None:
            instance.finished_at = finished_at
        instance.save()

    if lock_row:
        with transaction.atomic():
            execute_update()
    else:
        execute_update()
