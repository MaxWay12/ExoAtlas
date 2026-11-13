import os
from pathlib import Path


def database_url() -> str:
    return os.environ["DATABASE_URL"]


def create_schema(connection) -> None:
    schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
    connection.execute(schema)
