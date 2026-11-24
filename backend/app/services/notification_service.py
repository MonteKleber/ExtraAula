from sqlalchemy.orm import Session

from app.models.models import Notification


def notify(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    kind: str = "INFO",
    link: str | None = None,
) -> Notification:
    item = Notification(
        user_id=user_id,
        title=title,
        message=message,
        kind=kind,
        link=link,
    )
    db.add(item)
    return item
