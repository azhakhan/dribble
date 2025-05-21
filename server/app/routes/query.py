from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/query", tags=["query"])


# @router.post("/")
# async def query(request: QueryRequest):
#     return query_controller(request)
