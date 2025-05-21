from fastapi import FastAPI
import os

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/env")
def read_env():
    return {"AZ_KEY": os.getenv("AZ_KEY"), "AZ_SECRET": "still works!"}
