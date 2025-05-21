"""create uuid-ossp extension

Revision ID: 5ffe9445b063
Revises:
Create Date: 2025-05-21 14:43:09.015523

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5ffe9445b063"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')


def downgrade():
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp";')
