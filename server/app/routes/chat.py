from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from app.core.db import get_db
from sqlalchemy.orm import Session, joinedload
from app.models import (
    ChatSession,
    ChatMessage,
    MessageTypeEnum,
    ChatRoleEnum,
    Query,
    ChatContext,
)
from app.schemas.chat import (
    ChatMessagesResponse,
    ChatMessageResponse,
    ChatSessionsResponse,
    ChatSessionResponse,
    ChatLLMRequest,
    ChatLLMResponse,
)
from app.controllers.chat import ChatService


router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions/", response_model=ChatSessionsResponse)
async def get_sessions(
    db: Session = Depends(get_db),
):
    chat_sessions = db.query(ChatSession).all()

    return ChatSessionsResponse(
        sessions=[ChatSessionResponse.model_validate(session) for session in chat_sessions],
        total_count=len(chat_sessions),
    )


@router.get("/messages/{session_id}/", response_model=ChatMessagesResponse)
async def get_messages(
    session_id: UUID,
    db: Session = Depends(get_db),
):
    # Get the session to validate access
    chat_session = db.query(ChatSession).filter_by(id=session_id).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Get messages from the database, ordered by position
    db_messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.role.in_([ChatRoleEnum.user, ChatRoleEnum.assistant]),
            ChatMessage.chat_session_id == chat_session.id,
            ChatMessage.message_type == MessageTypeEnum.message,
        )
        .options(
            joinedload(ChatMessage.context).joinedload(ChatContext.query).joinedload(Query.versions)
        )
        .order_by(ChatMessage.position)
        .all()
    )

    # Filter and transform messages for client consumption
    client_messages = []

    for db_message in db_messages:
        # Transform context data
        context_data = None
        if db_message.context:
            context_data = [
                {
                    "query_id": str(ctx.query_id),
                    "query_version_id": str(ctx.query_version_id) if ctx.query_version_id else None,
                    "active": ctx.active,
                }
                for ctx in db_message.context
            ]

        client_messages.append(
            ChatMessageResponse(
                role=db_message.role.value,
                content=db_message.content,
                sql_query=db_message.sql_query,
                context=context_data,
                created_at=db_message.created_at,
            )
        )

    return ChatMessagesResponse(
        messages=client_messages, session_id=session_id, total_count=len(client_messages)
    )


@router.post("/")
async def chat(
    request: ChatLLMRequest,
    db: Session = Depends(get_db),
):
    try:
        # Initialize chat service
        service = ChatService(db)

        # Process chat request (service handles session/message creation)
        response = await service.chat(request)

        return ChatLLMResponse(
            content=response.content,
            sql_query=response.sql_query,
            metadata=response.metadata,
            query_id=response.query_id,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
