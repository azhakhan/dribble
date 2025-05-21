from fastapi import Depends, HTTPException
from app.models import User, Workspace
from app.core.db import get_db
from sqlalchemy.orm import Session
import os


def get_current_user(db: Session = Depends(get_db)) -> User:
    # decode token, get user from db, etc.
    if os.getenv("ENVIRONMENT") == "development":
        user = db.query(User).first()
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return user
    else:
        raise HTTPException(status_code=401, detail="Not authenticated")


def get_current_workspace(db: Session = Depends(get_db)) -> Workspace:
    if os.getenv("ENVIRONMENT") == "development":
        workspace = db.query(Workspace).first()
        if not workspace:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return workspace
    else:
        raise HTTPException(status_code=401, detail="Not authenticated")
