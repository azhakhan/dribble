"""
Dedicated service for query execution operations.
Handles query runs, version management, and result processing.
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.db import get_db
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

    async def execute_query_version(self, query_version_id: UUID, db_session: Session) -> str:
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
            query_version = self._get_query_version_with_source(query_version_id, db_session)

            if not query_version:
                raise ValueError(f"Query version {query_version_id} not found")

            # Create query run record
            query_run = self._create_query_run(
                query_version_id, query_version.query.source_id, db_session
            )

            # Create and submit task
            task_data = self.task_service.create_query_execution_task(
                query_version_id=str(query_version_id),
                source_id=str(query_version.query.source_id),
                query_run_id=str(query_run.id),
                sql=query_version.sql,
                worker_session_id=str(query_version.query.source_id),  # Use source_id for now
            )

            # Submit to worker queue
            # TODO: In future, use different queues per database type
            queue_name = "query_tasks"
            task_id = await self.task_service.submit_task(task_data, queue_name)

            # Update query run with task ID
            self._update_query_run_task_id(query_run.id, task_id, db_session)

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

    async def cancel_query_execution(self, query_run_id: UUID, db_session: Session) -> bool:
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
            query_run = self._get_query_run_with_source(query_run_id, db_session)
            if not query_run:
                raise ValueError(f"Query run {query_run_id} not found")

            # Create cancel task
            cancel_task = self.task_service.create_query_cancel_task(
                query_run_id=str(query_run_id),
                worker_session_id=str(query_run.source_id),  # Use source_id for now
            )

            # Submit to worker queue
            # TODO: In future, use different queues per database type
            queue_name = "query_tasks"
            await self.task_service.submit_task(cancel_task, queue_name)

            # Update query run status
            self._update_query_run_status(query_run_id, "cancelled", db_session)

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
            # Create a new database session for this operation
            db_session = next(get_db())
            try:
                # Find query run by task ID
                query_run = self._get_query_run_by_task_id(task_id, db_session)
                if not query_run:
                    logger.warning(f"Query run not found for task {task_id}")
                    return

                # Update query run based on status
                if status == TaskStatus.COMPLETED:
                    self._update_query_run_success(query_run.id, result_data, db_session)
                elif status == TaskStatus.FAILED:
                    self._update_query_run_error(query_run.id, error, db_session)
                elif status == TaskStatus.CANCELLED:
                    self._update_query_run_status(query_run.id, "cancelled", db_session)

                db_session.commit()
                logger.info(f"Query run {query_run.id} updated for task {task_id}")
            finally:
                db_session.close()

        except Exception as e:
            logger.error(f"Failed to handle task completion {task_id}: {e}")

    def _get_query_version_with_source(
        self, query_version_id: UUID, db_session: Session
    ) -> Optional[QueryVersion]:
        """Get query version with related source data."""
        return (
            db_session.query(QueryVersion)
            .filter(QueryVersion.id == query_version_id)
            .join(QueryVersion.query)
            .join(Source)
            .first()
        )

    def _create_query_run(
        self, query_version_id: UUID, source_id: UUID, db_session: Session
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
        db_session.flush()
        return query_run

    def _update_query_run_task_id(
        self, query_run_id: UUID, task_id: str, db_session: Session
    ) -> None:
        """Update query run with task ID."""
        db_session.query(QueryRun).filter(QueryRun.id == query_run_id).update({"task_id": task_id})
        db_session.commit()

    def _update_query_run_status(
        self, query_run_id: UUID, status: str, db_session: Session
    ) -> None:
        """Update query run status."""
        db_session.query(QueryRun).filter(QueryRun.id == query_run_id).update(
            {"status": status, "updated_at": datetime.utcnow()}
        )
        db_session.commit()

    def _update_query_run_success(
        self, query_run_id: UUID, result_data: Optional[dict], db_session: Session
    ) -> None:
        """Update query run with successful result."""
        update_data = {
            "status": "completed",
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow(),
        }

        if result_data:
            update_data["result"] = result_data
            if "row_count" in result_data:
                update_data["row_count"] = result_data["row_count"]
            if "execution_time_ms" in result_data:
                update_data["execution_time_ms"] = result_data["execution_time_ms"]

        db_session.query(QueryRun).filter(QueryRun.id == query_run_id).update(update_data)
        db_session.commit()

    def _update_query_run_error(
        self, query_run_id: UUID, error: Optional[str], db_session: Session
    ) -> None:
        """Update query run with error."""
        update_data = {
            "status": "failed",
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow(),
        }

        if error:
            update_data["error"] = error

        db_session.query(QueryRun).filter(QueryRun.id == query_run_id).update(update_data)
        db_session.commit()

    def _get_query_run_with_source(
        self, query_run_id: UUID, db_session: Session
    ) -> Optional[QueryRun]:
        """Get query run with related source data."""
        return db_session.query(QueryRun).filter(QueryRun.id == query_run_id).join(Source).first()

    def _get_query_run_by_task_id(self, task_id: str, db_session: Session) -> Optional[QueryRun]:
        """Get query run by task ID."""
        return db_session.query(QueryRun).filter(QueryRun.task_id == task_id).first()
