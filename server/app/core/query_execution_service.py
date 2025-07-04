"""
Dedicated service for query execution operations.
Handles query runs, version management, and result processing.
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_async_session
from app.core.task_service import TaskService
from app.core.task_types import (
    TaskStatus,
    TaskStatusUpdate,
    TaskType,
)
from app.models import QueryRun, QueryVersion, Source

logger = logging.getLogger(__name__)


class QueryExecutionService:
    """
    Service for managing query execution with proper separation of concerns.
    """

    def __init__(self, task_service: TaskService):
        self.task_service = task_service

    async def execute_query_version(self, query_version_id: UUID, db_session: AsyncSession) -> str:
        """
        Execute a query version and return the task ID.

        Args:
            query_version_id: ID of the query version to execute
            db_session: Database session

        Returns:
            Task ID
        """
        try:
            # Get query version with related data
            query_version = await self._get_query_version_with_source(query_version_id, db_session)

            if not query_version:
                raise ValueError(f"Query version {query_version_id} not found")

            # Create query run record
            query_run = await self._create_query_run(
                query_version_id, query_version.query.source_id, db_session
            )

            # Create and submit task
            task_data = self.task_service.create_query_execution_task(
                query_version_id=str(query_version_id),
                source_id=str(query_version.query.source_id),
                query_run_id=str(query_run.id),
                sql=query_version.sql,
                worker_session_id=query_version.query.source.worker_session_id,
            )

            # Submit to appropriate worker queue
            queue_name = f"queue_{query_version.query.source.type}"
            task_id = await self.task_service.submit_task(task_data, queue_name)

            # Update query run with task ID
            await self._update_query_run_task_id(query_run.id, task_id, db_session)

            # Publish initial status
            await self.task_service.publish_status_update(
                TaskStatusUpdate(
                    task_id=task_id,
                    status=TaskStatus.PENDING,
                    task_type=TaskType.QUERY_EXECUTION,
                    message="Query execution queued",
                )
            )

            logger.info(f"Query execution started: {task_id}")
            return task_id

        except Exception as e:
            logger.error(f"Failed to execute query version {query_version_id}: {e}")
            raise

    async def cancel_query_execution(self, query_run_id: UUID, db_session: AsyncSession) -> bool:
        """
        Cancel a running query execution.

        Args:
            query_run_id: ID of the query run to cancel
            db_session: Database session

        Returns:
            True if cancellation was successful
        """
        try:
            # Get query run
            query_run = await self._get_query_run_with_source(query_run_id, db_session)
            if not query_run:
                raise ValueError(f"Query run {query_run_id} not found")

            # Create cancel task
            cancel_task = self.task_service.create_query_cancel_task(
                query_run_id=str(query_run_id), worker_session_id=query_run.source.worker_session_id
            )

            # Submit to worker queue
            queue_name = f"queue_{query_run.source.type}"
            await self.task_service.submit_task(cancel_task, queue_name)

            # Update query run status
            await self._update_query_run_status(query_run_id, "cancelled", db_session)

            logger.info(f"Query cancellation requested: {query_run_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to cancel query {query_run_id}: {e}")
            return False

    async def handle_task_completion(
        self,
        task_id: str,
        status: TaskStatus,
        result_data: Optional[dict] = None,
        error: Optional[str] = None,
    ) -> None:
        """
        Handle task completion and update database accordingly.

        Args:
            task_id: Task identifier
            status: Final task status
            result_data: Task result data
            error: Error message if failed
        """
        try:
            async with get_async_session() as db_session:
                # Find query run by task ID
                query_run = await self._get_query_run_by_task_id(task_id, db_session)
                if not query_run:
                    logger.warning(f"Query run not found for task {task_id}")
                    return

                # Update query run based on status
                if status == TaskStatus.COMPLETED:
                    await self._update_query_run_success(query_run.id, result_data, db_session)
                elif status == TaskStatus.FAILED:
                    await self._update_query_run_error(query_run.id, error, db_session)
                elif status == TaskStatus.CANCELLED:
                    await self._update_query_run_status(query_run.id, "cancelled", db_session)

                await db_session.commit()
                logger.info(f"Query run {query_run.id} updated for task {task_id}")

        except Exception as e:
            logger.error(f"Failed to handle task completion {task_id}: {e}")

    async def _get_query_version_with_source(
        self, query_version_id: UUID, db_session: AsyncSession
    ) -> Optional[QueryVersion]:
        """Get query version with related source data."""
        result = await db_session.execute(
            select(QueryVersion)
            .where(QueryVersion.id == query_version_id)
            .join(QueryVersion.query)
            .join(Source)
        )
        return result.scalar_one_or_none()

    async def _create_query_run(
        self, query_version_id: UUID, source_id: UUID, db_session: AsyncSession
    ) -> QueryRun:
        """Create a new query run record."""
        query_run = QueryRun(
            id=uuid4(),
            query_version_id=query_version_id,
            source_id=source_id,
            status="running",
            created_at=datetime.utcnow(),
        )
        db_session.add(query_run)
        await db_session.flush()
        return query_run

    async def _update_query_run_task_id(
        self, query_run_id: UUID, task_id: str, db_session: AsyncSession
    ) -> None:
        """Update query run with task ID."""
        await db_session.execute(
            update(QueryRun).where(QueryRun.id == query_run_id).values(task_id=task_id)
        )

    async def _update_query_run_status(
        self, query_run_id: UUID, status: str, db_session: AsyncSession
    ) -> None:
        """Update query run status."""
        await db_session.execute(
            update(QueryRun)
            .where(QueryRun.id == query_run_id)
            .values(status=status, updated_at=datetime.utcnow())
        )

    async def _update_query_run_success(
        self, query_run_id: UUID, result_data: Optional[dict], db_session: AsyncSession
    ) -> None:
        """Update query run with successful result."""
        update_values = {
            "status": "completed",
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow(),
        }

        if result_data:
            update_values.update(
                {
                    "row_count": result_data.get("row_count"),
                    "execution_time_ms": result_data.get("execution_time_ms"),
                }
            )

        await db_session.execute(
            update(QueryRun).where(QueryRun.id == query_run_id).values(**update_values)
        )

    async def _update_query_run_error(
        self, query_run_id: UUID, error: Optional[str], db_session: AsyncSession
    ) -> None:
        """Update query run with error."""
        await db_session.execute(
            update(QueryRun)
            .where(QueryRun.id == query_run_id)
            .values(
                status="failed",
                error=error,
                updated_at=datetime.utcnow(),
                completed_at=datetime.utcnow(),
            )
        )

    async def _get_query_run_with_source(
        self, query_run_id: UUID, db_session: AsyncSession
    ) -> Optional[QueryRun]:
        """Get query run with related source data."""
        result = await db_session.execute(
            select(QueryRun).where(QueryRun.id == query_run_id).join(Source)
        )
        return result.scalar_one_or_none()

    async def _get_query_run_by_task_id(
        self, task_id: str, db_session: AsyncSession
    ) -> Optional[QueryRun]:
        """Get query run by task ID."""
        result = await db_session.execute(select(QueryRun).where(QueryRun.task_id == task_id))
        return result.scalar_one_or_none()
