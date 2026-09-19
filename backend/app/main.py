from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import Base, engine
from app.routers import concepts, generations, graph, images

Base.metadata.create_all(bind=engine)

images_dir = settings.data_dir_path / "images"
images_dir.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    images_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Visual Brainstorming Graph API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(graph.router)
app.include_router(concepts.router)
app.include_router(images.router)
app.include_router(generations.router)

app.mount("/images", StaticFiles(directory=str(images_dir)), name="images")
