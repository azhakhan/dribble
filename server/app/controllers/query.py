from models import Source
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from schemas.query import QueryRequest


def query_controller(request: QueryRequest, db: Session):
    # get source from request
    source = db.query(Source).filter_by(id=request.database_id).first()
    if not source:
        raise Exception("Source not found")

    # connect to db
    if source.dbtype == "postgres":
        engine = create_engine(source.creds)
        with engine.connect() as conn:
            result = conn.execute(text(request.query))
            return result.fetchall()
