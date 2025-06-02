from sqlalchemy import Column, DateTime, String, JSON, ForeignKey, Integer
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.dialects.postgresql import UUID
import enum
import uuid
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    sources = relationship("Source", back_populates="workspace")
    workers = relationship("Worker", back_populates="workspace")
    created_at = Column(DateTime, default=datetime.now)


class RoleEnum(enum.Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class WorkspaceUser(Base):
    __tablename__ = "workspace_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(SqlEnum(RoleEnum), nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class Source(Base):
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    dbtype = Column(String, nullable=False)
    creds = Column(JSON, nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    workspace = relationship("Workspace", back_populates="sources")
    queries = relationship("Query", back_populates="source")
    workers = relationship("Worker", back_populates="source")
    created_at = Column(DateTime, default=datetime.now)


class Query(Base):
    __tablename__ = "queries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    query = Column(String, nullable=False)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False)
    source = relationship("Source", back_populates="queries")
    created_at = Column(DateTime, default=datetime.now)


class Worker(Base):
    __tablename__ = "workers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False)
    source = relationship("Source", back_populates="workers")
    container_id = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    host = Column(String, nullable=False)
    status = Column(String, nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    workspace = relationship("Workspace", back_populates="workers")
    created_at = Column(DateTime, default=datetime.now)
