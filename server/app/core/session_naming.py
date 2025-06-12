import logging
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session, sessionmaker
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.db import engine
from app.models import ChatSession, ChatMessage, LLM, MessageTypeEnum, ChatRoleEnum
from app.core.encryption import decrypt_password
from openai import OpenAI
import asyncio
import re

logger = logging.getLogger(__name__)

# Create a session factory for the background task
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class SimpleNamingLLMProvider:
    """Simplified LLM provider for session naming that doesn't use JSON format"""

    def __init__(self, llm: LLM):
        self.llm = llm
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize the OpenAI client"""
        if self.llm.name == "openai":
            self.client = OpenAI(api_key=decrypt_password(self.llm.api_key))
        else:
            # For now, only support OpenAI for naming
            raise NotImplementedError(
                f"LLM provider {self.llm.name} not supported for session naming"
            )

    async def generate_name(self, messages: List[dict]) -> Optional[str]:
        """Generate a session name using the LLM"""
        try:
            response = self.client.chat.completions.create(
                model=self.llm.model,
                messages=messages,
                temperature=0.7,
                max_tokens=60,  # Keep it short for naming
                top_p=1,
                # No JSON format for simple naming
            )

            content = response.choices[0].message.content
            if content:
                return content.strip()
            return None

        except Exception as e:
            logger.error(f"Error calling LLM for session naming: {e}")
            return None


class SessionNamingService:
    def __init__(self):
        self.scheduler = BackgroundScheduler()

    def start(self):
        """Start the background scheduler"""
        if not self.scheduler.running:
            self.scheduler.add_job(
                func=self._process_unnamed_sessions,
                trigger="interval",
                minutes=1,
                id="session_naming_task",
                max_instances=1,  # Prevent overlapping executions
                coalesce=True,  # If missed executions pile up, run only the latest
            )
            self.scheduler.start()
            logger.info("Session naming background task started")

    def stop(self):
        """Stop the background scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("Session naming background task stopped")

    def _process_unnamed_sessions(self):
        """Process all unnamed sessions that meet the criteria for naming"""
        try:
            db = SessionLocal()
            try:
                # Find all unnamed sessions
                unnamed_sessions = db.query(ChatSession).filter(ChatSession.name.is_(None)).all()

                # Filter sessions that should be named
                sessions_to_name = [
                    chat_session
                    for chat_session in unnamed_sessions
                    if self._should_name_session(db, chat_session)
                ]

                if not sessions_to_name:
                    return

                # Get the default LLM
                default_llm = (
                    db.query(LLM)
                    .filter(LLM.default == True)  # noqa
                    .first()
                )

                if not default_llm:
                    logger.warning("No default LLM found")
                    return

                # Only support OpenAI for now
                if default_llm.name != "openai":
                    logger.warning(
                        f"Session naming only supports OpenAI LLMs, got {default_llm.name}"
                    )
                    return

                # Process all sessions
                for chat_session in sessions_to_name:
                    asyncio.run(self._generate_session_name(db, chat_session, default_llm))

                db.commit()

            except Exception as e:
                db.rollback()
                logger.error(f"Error in session naming task: {e}")
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Failed to create database session in naming task: {e}")

    def _should_name_session(self, db: Session, chat_session: ChatSession) -> bool:
        """Check if a session should be named based on age or message count"""
        # Check if session is older than 5 minutes
        five_minutes_ago = datetime.now() - timedelta(minutes=5)
        if chat_session.created_at < five_minutes_ago:
            return True

        # Check if session has >= 4 user/assistant messages
        message_count = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.chat_session_id == chat_session.id,
                ChatMessage.message_type == MessageTypeEnum.message,
                ChatMessage.role.in_([ChatRoleEnum.user, ChatRoleEnum.assistant]),
            )
            .count()
        )

        return message_count >= 4

    async def _generate_session_name(
        self, db: Session, chat_session: ChatSession, default_llm: LLM
    ):
        """Generate a name for the session using the provided LLM"""
        try:
            # Get all user/assistant messages for context
            db_messages = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.chat_session_id == chat_session.id,
                    ChatMessage.message_type == MessageTypeEnum.message,
                    ChatMessage.role.in_([ChatRoleEnum.user, ChatRoleEnum.assistant]),
                )
                .order_by(ChatMessage.position)
                .all()
            )

            if not db_messages:
                logger.warning(f"No messages found for session {chat_session.id}")
                return

            # Convert to OpenAI format
            openai_messages = []

            # Add naming prompt
            naming_prompt = """Based on the following conversation, generate a short and descriptive name for this chat session. The name should:
- Be maximum 60 characters
- Capture the main topic or purpose of the conversation
- Be clear and concise
- Not include quotes or special formatting

Important: Respond with only the name, nothing else! Do not include explanation or formalities, like "Here's the name" or "Certainly, the name is" or Purpose/Explanation sections."""

            openai_messages.append({"role": "system", "content": naming_prompt})

            # Add conversation messages
            for msg in db_messages:
                openai_messages.append({"role": msg.role.value, "content": msg.content})

            # Create naming provider and get name
            provider = SimpleNamingLLMProvider(default_llm)
            name = await provider.generate_name(openai_messages)

            if name:
                # Clean up the name
                # only keep alphanumeric characters and spaces
                name = re.sub(r"[^a-zA-Z0-9\s]", "", name)

                # Update session name
                chat_session.name = name
                logger.info(f"Generated name '{name}' for session {chat_session.id}")
            else:
                logger.warning(f"No name generated for session {chat_session.id}")

        except Exception as e:
            logger.error(f"Error generating name for session {chat_session.id}: {e}")


# Global instance
session_naming_service = SessionNamingService()


def start_session_naming():
    """Start the session naming background task"""
    logger.info("Starting session naming background task")
    session_naming_service.start()


def stop_session_naming():
    """Stop the session naming background task"""
    logger.info("Stopping session naming background task")
    session_naming_service.stop()
