"""add is_platform_admin to users

Revision ID: 1812b93a9a50
Revises: 97181897e5f0
Create Date: 2026-06-09 18:01:54.777198

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '1812b93a9a50'
down_revision: Union[str, None] = '97181897e5f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_platform_admin to users — existing rows default to False (non-admin)
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'is_platform_admin',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('is_platform_admin')