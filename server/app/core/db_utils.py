from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import Type, TypeVar, Any
from uuid import UUID

T = TypeVar('T')


def get_or_404(db: Session, model: Type[T], id: UUID, error_message: str = None) -> T:
    """
    Get an object by ID or raise 404 HTTPException if not found.
    
    Args:
        db: Database session
        model: SQLAlchemy model class
        id: UUID of the object to fetch
        error_message: Custom error message (defaults to model name)
    
    Returns:
        The found object
        
    Raises:
        HTTPException: 404 if object not found
    """
    error_message = error_message or f"{model.__name__} not found"
    
    obj = db.query(model).filter_by(id=id).first()
    if not obj:
        raise HTTPException(status_code=404, detail=error_message)
    return obj


def get_or_404_by_field(db: Session, model: Type[T], field: str, value: Any, error_message: str = None) -> T:
    """
    Get an object by a specific field or raise 404 HTTPException if not found.
    
    Args:
        db: Database session
        model: SQLAlchemy model class
        field: Field name to filter by
        value: Value to filter for
        error_message: Custom error message (defaults to model name)
    
    Returns:
        The found object
        
    Raises:
        HTTPException: 404 if object not found
    """
    error_message = error_message or f"{model.__name__} not found"
    
    obj = db.query(model).filter(getattr(model, field) == value).first()
    if not obj:
        raise HTTPException(status_code=404, detail=error_message)
    return obj


def safe_delete(db: Session, obj: Any) -> dict:
    """
    Safely delete an object and commit the transaction.
    
    Args:
        db: Database session
        obj: Object to delete
        
    Returns:
        Success message dictionary
    """
    db.delete(obj)
    db.commit()
    return {"message": f"{obj.__class__.__name__} deleted successfully"}


def safe_create(db: Session, obj: Any) -> Any:
    """
    Safely create an object and commit the transaction.
    
    Args:
        db: Database session
        obj: Object to create
        
    Returns:
        The created object (refreshed)
    """
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def safe_update(db: Session, obj: Any) -> Any:
    """
    Safely update an object and commit the transaction.
    
    Args:
        db: Database session
        obj: Object to update
        
    Returns:
        The updated object (refreshed)
    """
    db.commit()
    db.refresh(obj)
    return obj