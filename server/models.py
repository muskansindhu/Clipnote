from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime


class Video(SQLModel, table=True):
    id: str = Field(primary_key=True)
    video_url: Optional[str]
    video_title: Optional[str]
    fav: bool = Field(default=False)

    notes: List["Note"] = Relationship(back_populates="video")
    labels: List["VideoLabel"] = Relationship(back_populates="video")


class Note(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    video_timestamp: Optional[str]
    note: Optional[str]
    video_id: str = Field(foreign_key="video.id")

    video: Optional[Video] = Relationship(back_populates="notes")


class Label(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    label: Optional[str]

    videos: List["VideoLabel"] = Relationship(back_populates="label")


class VideoLabel(SQLModel, table=True):
    yt_video_id: str = Field(foreign_key="video.id", primary_key=True)
    label_id: int = Field(foreign_key="label.id", primary_key=True)

    video: Optional[Video] = Relationship(back_populates="labels")
    label: Optional[Label] = Relationship(back_populates="videos")
