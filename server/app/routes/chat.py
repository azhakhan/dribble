from fastapi import APIRouter, Depends
from app.dependencies import get_current_workspace
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import ChatSession, ChatMessage, MessageTypeEnum, ChatRoleEnum
from app.schemas.chat import (
    ChatMessagesResponse,
    ChatMessageResponse,
    ChatSessionsResponse,
    ChatSessionResponse,
)
from uuid import UUID
from fastapi import HTTPException


router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions", response_model=ChatSessionsResponse)
async def get_sessions(
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    chat_sessions = db.query(ChatSession).filter_by(workspace_id=workspace.id).all()

    return ChatSessionsResponse(
        sessions=[ChatSessionResponse.model_validate(session) for session in chat_sessions],
        total_count=len(chat_sessions),
    )


@router.get("/messages/{session_id}", response_model=ChatMessagesResponse)
async def get_messages(
    session_id: UUID,
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    # Get the session to validate access
    session = db.query(ChatSession).filter_by(id=session_id, workspace_id=workspace.id).first()

    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Get messages from the database, ordered by position
    db_messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.role.in_([ChatRoleEnum.user, ChatRoleEnum.assistant]),
            ChatMessage.chat_session_id == session_id,
            ChatMessage.message_type == MessageTypeEnum.message,
        )
        .order_by(ChatMessage.position)
        .all()
    )

    # Filter and transform messages for client consumption
    client_messages = []

    for db_message in db_messages:
        client_messages.append(
            ChatMessageResponse(
                role=db_message.role.value,
                content=db_message.content,
                sql_query=db_message.sql_query,
                created_at=db_message.created_at,
            )
        )

    return ChatMessagesResponse(
        messages=client_messages, session_id=session_id, total_count=len(client_messages)
    )
