import os
from app.core.db import SessionLocal
from app.models import User, Workspace, WorkspaceUser


def ensure_user_and_workspace():
    if os.getenv("ENVIRONMENT") == "development":
        db = SessionLocal()
        try:
            user_workspace = db.query(WorkspaceUser).first()
            if not user_workspace:
                # create workspace
                workspace = Workspace(name="Default Workspace")
                db.add(workspace)
                db.commit()
                db.refresh(workspace)
                # create user
                user = User(name="Admin", email="admin@example.com")
                db.add(user)
                db.commit()
                db.refresh(user)
                # create user workspace
                user_workspace = WorkspaceUser(
                    user_id=user.id, workspace_id=workspace.id, role="admin"
                )
                db.add(user_workspace)
                db.commit()
                db.refresh(user_workspace)
        finally:
            db.close()
