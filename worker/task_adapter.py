"""
Task adapter to handle both old and new task formats.
Provides backward compatibility during migration.
"""

import logging
import uuid
from typing import Dict, Any

logger = logging.getLogger(__name__)


def adapt_task_data(task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Adapt new typed task format to old worker format.

    Args:
        task_data: Raw task data from Redis

    Returns:
        Adapted task data compatible with worker
    """
    # Handle task_type mapping
    task_type = task_data.get("task_type", "")

    # Map new task types to old ones
    type_mapping = {
        "source_connect": "connect",
        "source_test": "test_db",
        "query_execution": "execute",
        "query_cancel": "cancel",
    }

    # If it's a new typed task, adapt it
    if task_type in type_mapping:
        logger.debug(f"Adapting new task type {task_type} to {type_mapping[task_type]}")

        # Create adapted task data
        # Ensure we always have an id field
        task_id = task_data.get("task_id") or task_data.get("id") or str(uuid.uuid4())
        adapted = {"task_type": type_mapping[task_type], "id": task_id}

        # Extract fields from connection_params if present
        connection_params = task_data.get("connection_params", {})

        # Handle source_connect and source_test tasks
        if task_type in ["source_connect", "source_test"]:
            adapted["source_id"] = task_data.get("source_id")

            # Extract fields from connection_params
            adapted["dbtype"] = connection_params.get("dbtype")
            adapted["creds"] = connection_params.get("creds")
            adapted["role"] = connection_params.get("role", "reader")

            # Handle special actions for source_connect
            action = connection_params.get("action")
            if action == "disconnect":
                adapted["task_type"] = "disconnect"
            elif action == "list":
                adapted["task_type"] = "connected"
            elif action == "schema":
                adapted["task_type"] = "schema"

        # Handle query execution tasks
        elif task_type == "query_execution":
            adapted["source_id"] = task_data.get("source_id")
            adapted["sql"] = task_data.get("sql")
            adapted["query_run_id"] = task_data.get("query_run_id")
            adapted["role"] = "reader"  # Default role for queries

        # Handle query cancel tasks
        elif task_type == "query_cancel":
            adapted["query_run_id"] = task_data.get("query_run_id")

        return adapted

    # If it's already in old format, return as-is
    return task_data


def get_original_task_type(old_task_type: str) -> str:
    """
    Convert old task type back to new typed format for results.

    Args:
        old_task_type: Old format task type

    Returns:
        New typed task type string
    """
    # Reverse mapping
    reverse_mapping = {
        "connect": "source_connect",
        "test_db": "source_test",
        "execute": "query_execution",
        "cancel": "query_cancel",
        "disconnect": "source_connect",
        "connected": "source_connect",
        "schema": "source_connect",
    }

    return reverse_mapping.get(old_task_type, old_task_type)
