from typing import Dict, Any, Optional
from dataclasses import dataclass
from uuid import UUID


@dataclass
class ChatResponse:
    """Structured response from LLM chat"""

    content: str
    sql_query: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    query_id: Optional[UUID] = None
    updated_query_id: Optional[UUID] = None


@dataclass
class ContextQuery:
    """Context query with metadata"""

    query_id: UUID
    query_version_id: Optional[UUID]
    name: str
    sql: str
    source_id: UUID
    source_name: str
    active: bool = False
