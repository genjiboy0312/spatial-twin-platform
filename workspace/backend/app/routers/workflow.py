from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Building, WorkflowProgress
from app.schemas import WorkflowRead, WorkflowUpdate

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


def _split_steps(raw_steps: str) -> list[str]:
    return [step for step in raw_steps.split(",") if step]


def _join_steps(steps: list[str]) -> str:
    return ",".join(dict.fromkeys(steps))


@router.get("/{building_id}", response_model=WorkflowRead)
def get_workflow(building_id: int, db: Session = Depends(get_db)) -> WorkflowRead:
    progress = db.scalar(select(WorkflowProgress).where(WorkflowProgress.building_id == building_id))
    if progress is None:
        return WorkflowRead(building_id=building_id, current_step="projects", completed_steps=[])
    return WorkflowRead(
        building_id=building_id,
        current_step=progress.current_step,
        completed_steps=_split_steps(progress.completed_steps),
    )


@router.patch("/{building_id}", response_model=WorkflowRead)
def update_workflow(building_id: int, payload: WorkflowUpdate, db: Session = Depends(get_db)) -> WorkflowRead:
    if db.get(Building, building_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")

    progress = db.scalar(select(WorkflowProgress).where(WorkflowProgress.building_id == building_id))
    if progress is None:
        progress = WorkflowProgress(building_id=building_id)
        db.add(progress)
    if payload.current_step is not None:
        progress.current_step = payload.current_step
    if payload.completed_steps is not None:
        progress.completed_steps = _join_steps(payload.completed_steps)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workflow reference") from exc
    db.refresh(progress)
    return WorkflowRead(
        building_id=building_id,
        current_step=progress.current_step,
        completed_steps=_split_steps(progress.completed_steps),
    )
