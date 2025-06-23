from fastapi import HTTPException
from sqlalchemy.orm import Session, Query
from sqlalchemy.exc import IntegrityError
from typing import Type, TypeVar, Any
from uuid import UUID

T = TypeVar("T")


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

    query = db.query(model).filter_by(id=id)
    if hasattr(model, "deleted_at"):
        query = query.filter(model.deleted_at.is_(None))
    obj = query.first()
    if not obj:
        raise HTTPException(status_code=404, detail=error_message)
    return obj


def get_or_404_by_field(
    db: Session, model: Type[T], field: str, value: Any, error_message: str = None
) -> T:
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

    query = db.query(model).filter(getattr(model, field) == value)
    if hasattr(model, "deleted_at"):
        query = query.filter(model.deleted_at.is_(None))
    obj = query.first()
    if not obj:
        raise HTTPException(status_code=404, detail=error_message)
    return obj


def safe_delete(db: Session, obj: Any) -> dict:
    """
    Safely delete an object and commit the transaction.
    Uses soft delete if the model supports it, otherwise hard delete.

    Args:
        db: Database session
        obj: Object to delete

    Returns:
        Success message dictionary

    Raises:
        HTTPException: 500 if there's a database constraint violation
    """
    try:
        if hasattr(obj, "soft_delete"):
            obj.soft_delete()
            db.commit()
            db.refresh(obj)
        else:
            db.delete(obj)
            db.commit()
        return {"message": f"{obj.__class__.__name__} deleted successfully"}
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database constraint violation: {str(e)}"
        ) from e


def safe_create(db: Session, obj: Any) -> Any:
    """
    Safely create an object and commit the transaction.

    Args:
        db: Database session
        obj: Object to create

    Returns:
        The created object (refreshed)

    Raises:
        HTTPException: 500 if there's a database constraint violation
    """
    try:
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database constraint violation: {str(e)}"
        ) from e


def safe_update(db: Session, obj: Any) -> Any:
    """
    Safely update an object and commit the transaction.

    Args:
        db: Database session
        obj: Object to update

    Returns:
        The updated object (refreshed)

    Raises:
        HTTPException: 500 if there's a database constraint violation
    """
    try:
        db.commit()
        db.refresh(obj)
        return obj
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database constraint violation: {str(e)}"
        ) from e


def filter_soft_deleted(query: Query) -> Query:
    """
    Filter out soft-deleted records from a query.
    Only applies to models that have a deleted_at column.
    """
    model = query.column_descriptions[0]["type"]
    if hasattr(model, "deleted_at"):
        return query.filter(model.deleted_at.is_(None))
    return query


def soft_delete_record(db, record):
    """
    Soft delete a record by setting its deleted_at timestamp.
    """
    if hasattr(record, "soft_delete"):
        record.soft_delete()
        db.commit()
        db.refresh(record)
    else:
        raise ValueError(f"Model {type(record)} does not support soft delete")


def restore_record(db, record):
    """
    Restore a soft-deleted record by clearing its deleted_at timestamp.
    """
    if hasattr(record, "restore"):
        record.restore()
        db.commit()
        db.refresh(record)
    else:
        raise ValueError(f"Model {type(record)} does not support soft delete")


def get_by_id_active(db, model: Type, id: Any):
    """
    Get a record by ID, filtering out soft-deleted records.
    """
    query = db.query(model).filter_by(id=id)
    if hasattr(model, "deleted_at"):
        query = query.filter(model.deleted_at.is_(None))
    return query.first()


def get_by_field_active(db, model: Type, field: str, value: Any):
    """
    Get a record by field value, filtering out soft-deleted records.
    """
    query = db.query(model).filter(getattr(model, field) == value)
    if hasattr(model, "deleted_at"):
        query = query.filter(model.deleted_at.is_(None))
    return query.first()


def get_all_active(db, model: Type, **filters):
    """
    Get all active (non-soft-deleted) records for a model.
    """
    query = db.query(model)

    # Apply filters
    for field, value in filters.items():
        query = query.filter(getattr(model, field) == value)

    # Filter out soft-deleted records
    if hasattr(model, "deleted_at"):
        query = query.filter(model.deleted_at.is_(None))

    return query.all()
