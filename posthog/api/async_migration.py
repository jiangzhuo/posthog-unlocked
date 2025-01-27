from rest_framework import response, serializers, viewsets
from rest_framework.decorators import action

from posthog.api.routing import StructuredViewSetMixin
from posthog.async_migrations.runner import MAX_CONCURRENT_ASYNC_MIGRATIONS, is_posthog_version_compatible
from posthog.async_migrations.utils import (
    can_resume_migration,
    force_stop_migration,
    rollback_migration,
    trigger_migration,
)
from posthog.models.async_migration import AsyncMigration, MigrationStatus, get_all_running_async_migrations
from posthog.permissions import StaffUser


class AsyncMigrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AsyncMigration
        fields = [
            "id",
            "name",
            "description",
            "progress",
            "status",
            "current_operation_index",
            "current_query_id",
            "celery_task_id",
            "started_at",
            "finished_at",
            "last_error",
            "posthog_max_version",
            "posthog_min_version",
        ]
        read_only_fields = [
            "id",
            "name",
            "description",
            "progress",
            "status",
            "current_operation_index",
            "current_query_id",
            "celery_task_id",
            "started_at",
            "finished_at",
            "last_error",
            "posthog_max_version",
            "posthog_min_version",
        ]


class AsyncMigrationsViewset(StructuredViewSetMixin, viewsets.ModelViewSet):
    queryset = AsyncMigration.objects.all()
    permission_classes = [StaffUser]
    serializer_class = AsyncMigrationSerializer

    @action(methods=["POST"], detail=True)
    def trigger(self, request, **kwargs):
        if len(get_all_running_async_migrations()) >= MAX_CONCURRENT_ASYNC_MIGRATIONS:
            return response.Response(
                {
                    "success": False,
                    "error": f"No more than {MAX_CONCURRENT_ASYNC_MIGRATIONS} async migration can run at once.",
                },
                status=400,
            )

        migration_instance = self.get_object()

        if not is_posthog_version_compatible(
            migration_instance.posthog_min_version, migration_instance.posthog_max_version
        ):
            return response.Response(
                {
                    "success": False,
                    "error": f"Can't run migration. Minimum PostHog version: {migration_instance.posthog_min_version}. Maximum PostHog version: {migration_instance.posthog_max_version}",
                },
                status=400,
            )

        migration_instance.status = MigrationStatus.Starting
        migration_instance.save()

        trigger_migration(migration_instance)
        return response.Response({"success": True}, status=200)

    @action(methods=["POST"], detail=True)
    def resume(self, request, **kwargs):
        migration_instance = self.get_object()
        if migration_instance.status != MigrationStatus.Errored:
            return response.Response(
                {"success": False, "error": "Can't resume a migration that isn't in errored state",}, status=400,
            )
        resumable, error = can_resume_migration(migration_instance)
        if not resumable:
            return response.Response({"success": False, "error": error,}, status=400,)
        trigger_migration(migration_instance, fresh_start=False)
        return response.Response({"success": True}, status=200)

    def _force_stop(self, rollback: bool):
        migration_instance = self.get_object()
        if migration_instance.status != MigrationStatus.Running:
            return response.Response(
                {"success": False, "error": "Can't stop a migration that isn't running.",}, status=400,
            )
        force_stop_migration(migration_instance, rollback=rollback)
        return response.Response({"success": True}, status=200)

    # DANGEROUS! Can cause another task to be lost
    @action(methods=["POST"], detail=True)
    def force_stop(self, request, **kwargs):
        return self._force_stop(rollback=True)

    # DANGEROUS! Can cause another task to be lost
    @action(methods=["POST"], detail=True)
    def force_stop_without_rollback(self, request, **kwargs):
        return self._force_stop(rollback=False)

    @action(methods=["POST"], detail=True)
    def rollback(self, request, **kwargs):
        migration_instance = self.get_object()
        if migration_instance.status != MigrationStatus.Errored:
            return response.Response(
                {"success": False, "error": "Can't rollback a migration that isn't in errored state.",}, status=400,
            )

        rollback_migration(migration_instance)
        return response.Response({"success": True}, status=200)

    @action(methods=["POST"], detail=True)
    def force_rollback(self, request, **kwargs):
        migration_instance = self.get_object()
        if migration_instance.status != MigrationStatus.CompletedSuccessfully:
            return response.Response(
                {"success": False, "error": "Can't force rollback a migration that did not complete successfully.",},
                status=400,
            )

        rollback_migration(migration_instance)
        return response.Response({"success": True}, status=200)
