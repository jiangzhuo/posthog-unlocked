import logging
import time
from typing import Any, Dict, List

from celery import shared_task
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db.models import F
from django.utils import timezone

from posthog.constants import INSIGHT_STICKINESS
from posthog.models import Cohort
from posthog.utils import is_clickhouse_enabled

logger = logging.getLogger(__name__)

MAX_AGE_MINUTES = 15


def calculate_cohorts() -> None:
    # This task will be run every minute
    # Every minute, grab a few cohorts off the list and execute them
    for cohort in (
        Cohort.objects.filter(
            deleted=False,
            is_calculating=False,
            last_calculation__lte=timezone.now() - relativedelta(minutes=MAX_AGE_MINUTES),
            errors_calculating__lte=20,
        )
        .exclude(is_static=True)
        .order_by(F("last_calculation").asc(nulls_first=True))[0 : settings.CALCULATE_X_COHORTS_PARALLEL]
    ):
        if is_clickhouse_enabled():
            calculate_cohort_ch.delay(cohort.id)
        else:
            calculate_cohort.delay(cohort.id)


@shared_task(ignore_result=True, max_retries=1)
def calculate_cohort(cohort_id: int) -> None:
    start_time = time.time()
    cohort = Cohort.objects.get(pk=cohort_id)
    cohort.calculate_people()

    logger.info("Calculating cohort {} took {:.2f} seconds".format(cohort.pk, (time.time() - start_time)))


@shared_task(ignore_result=True, max_retries=2)
def calculate_cohort_ch(cohort_id: int) -> None:
    if is_clickhouse_enabled():
        cohort: Cohort = Cohort.objects.get(pk=cohort_id)
        cohort.calculate_people_ch()


@shared_task(ignore_result=True, max_retries=1)
def calculate_cohort_from_list(cohort_id: int, items: List[str]) -> None:
    start_time = time.time()
    cohort = Cohort.objects.get(pk=cohort_id)

    cohort.insert_users_by_list(items)
    logger.info("Calculating cohort {} from CSV took {:.2f} seconds".format(cohort.pk, (time.time() - start_time)))


@shared_task(ignore_result=True, max_retries=1)
def insert_cohort_from_insight_filter(cohort_id: int, filter_data: Dict[str, Any]) -> None:
    if is_clickhouse_enabled():
        from ee.clickhouse.views.cohort import insert_cohort_actors_into_ch, insert_cohort_people_into_pg

        cohort = Cohort.objects.get(pk=cohort_id)

        insert_cohort_actors_into_ch(cohort, filter_data)
        insert_cohort_people_into_pg(cohort=cohort)
