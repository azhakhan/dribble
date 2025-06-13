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
    QueryVersion,
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
from app.controllers.chat import ChatService, ChatResponse
from app.core.db_utils import get_or_404, safe_create


router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions", response_model=ChatSessionsResponse)
async def get_sessions(
    db: Session = Depends(get_db),
):
    chat_sessions = db.query(ChatSession).all()

    return ChatSessionsResponse(
        sessions=[ChatSessionResponse.model_validate(session) for session in chat_sessions],
        total_count=len(chat_sessions),
    )


@router.get("/messages/{session_id}", response_model=ChatMessagesResponse)
async def get_messages(
    session_id: UUID,
    db: Session = Depends(get_db),
):
    # Get the session to validate access
    chat_session = get_or_404(db, ChatSession, session_id, "Chat session not found")

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


@router.post("/")
async def chat(
    request: ChatLLMRequest,
    db: Session = Depends(get_db),
):
    chat_session = db.query(ChatSession).filter_by(id=request.session_id).first()
    if not chat_session:
        chat_session = safe_create(
            db,
            ChatSession(
                id=request.session_id,
                source_id=request.source_id,
                llm_id=request.llm_id,
            ),
        )

    # create a new chat message
    chat_message = safe_create(
        db,
        ChatMessage(
            role=ChatRoleEnum.user,
            content=request.message,
            chat_session_id=request.session_id,
            message_type=MessageTypeEnum.message,
        ),
    )

    # for each context, get the query and query version
    for context in request.context:
        query = get_or_404(db, Query, context.query_id, "Query not found")
        query_version = get_or_404(
            db, QueryVersion, context.query_version_id, "Query version not found"
        )
        safe_create(
            db,
            ChatContext(
                message_id=chat_message.id,
                query_id=query.id,
                query_version_id=query_version.id,
                active=context.active,
            ),
        )

    try:
        service = ChatService(chat_session, db)

        # Return regular response
        response = await service.chat(request)
        if isinstance(response, ChatResponse):
            return ChatLLMResponse(
                content=response.content,
                sql_query=response.sql_query,
                metadata=response.metadata,
                query_id=response.query_id,
            )
        else:
            raise HTTPException(status_code=500, detail="Unexpected response type")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
