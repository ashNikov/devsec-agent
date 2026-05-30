"""Add role to invitations

Revision ID: ff798a52a770
Revises: 5a7bb6040492
Create Date: 2026-05-30 15:32:32.289888

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff798a52a770'
down_revision: Union[str, None] = '5a7bb6040492'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invitations', sa.Column('role', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('invitations', 'role')
